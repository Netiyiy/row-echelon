import { createClient } from "npm:@supabase/supabase-js@2";

const LEADERBOARD_TIMEZONE = "America/Los_Angeles";
const DEFAULT_LIMIT = 10;
const SESSION_IDLE_MS = 30 * 60 * 1000;
const SCORING = Object.freeze({
  A: 165,
  P: 1.22,
  B: 7,
  C: 1.25,
});
const BLOCKED_NAME_FRAGMENTS = Object.freeze([
  "fuck", "fuk", "phuck", "shit", "bitch", "cunt", "pussy", "whore",
  "slut", "penis", "vagina", "nigger", "nigga", "faggot", "retard", "porn",
]);
const BLOCKED_NAME_WORDS = new Set([
  "ass", "cock", "dick", "rape", "sex",
]);
const BLOCKED_ABBREVIATION_PATTERNS = Object.freeze([
  /(?:f|ph)(?:[uiovx]?c+k|[uiovx]+k|k(?:ing|in|ed|er|ers|s))/,
  /s+h+i?t+(?:ing|ed|y|s)?/,
  /b+i?t+c+h+/,
  /c+[uov]?n+t+/,
  /p+u?s+s+y+/,
  /w+h+o?r+e+/,
  /s+l+u?t+/,
  /p+o?r+n+/,
]);
const LEET_SUBSTITUTIONS: Record<string, string> = Object.freeze({
  "0": "o", "1": "i", "2": "z", "3": "e", "4": "a",
  "5": "s", "6": "g", "7": "t", "8": "b", "9": "g",
});

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "Content-Type, Authorization",
  "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
};

class HttpError extends Error {
  status: number;

  constructor(status: number, message: string) {
    super(message);
    this.status = status;
  }
}

function secretKey() {
  const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
  if (serviceKey) return serviceKey;

  const secretKeys = Deno.env.get("SUPABASE_SECRET_KEYS");
  if (secretKeys) {
    return JSON.parse(secretKeys).default as string;
  }

  throw new Error("Missing Supabase secret key.");
}

const supabase = createClient(Deno.env.get("SUPABASE_URL")!, secretKey(), {
  auth: {
    persistSession: false,
  },
});

type PlayerRow = {
  id: string;
  name: string;
  created_at: string;
  token_hash: string;
  last_active_at: string;
  total_solved: number;
};

type LeaderboardPlayer = {
  name: string;
  totalSolved: number;
};

type DailyScoreRow = {
  score_date: string;
  player_id: string;
  solved: number;
  total_score: number;
  total_steps: number;
  total_time: number;
  best_steps: number | null;
  best_level: number;
  last_level: number;
  updated_at: string;
};

function json(data: unknown, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: {
      ...corsHeaders,
      "Content-Type": "application/json; charset=utf-8",
      "Cache-Control": "no-store",
    },
  });
}

function publicPlayer(player: PlayerRow) {
  return {
    id: player.id,
    name: player.name,
    createdAt: Date.parse(player.created_at),
    totalSolved: Number(player.total_solved) || 0,
  };
}

function normalizeName(value: unknown) {
  return String(value || "").trim().replace(/\s+/g, " ");
}

function moderationText(value: unknown) {
  return String(value || "")
    .normalize("NFKC")
    .toLowerCase()
    .replace(/[0-9]/g, (character) => LEET_SUBSTITUTIONS[character]);
}

function isBlockedName(name: string) {
  const moderated = moderationText(name);
  const compact = moderated.replace(/[^a-z]/g, "");
  const compactForms = [...new Set([
    compact,
    compact.replace(/([a-z])\1+/g, "$1"),
    compact.replace(/([a-z])\1{2,}/g, "$1$1"),
  ])];
  const wordForms = moderated
    .split(/[^a-z]+/)
    .filter(Boolean)
    .flatMap((word) => [word, word.replace(/([a-z])\1+/g, "$1")]);
  return compactForms.some((form) =>
    BLOCKED_NAME_FRAGMENTS.some((term) => form.includes(term))
      || BLOCKED_ABBREVIATION_PATTERNS.some((pattern) => pattern.test(form)),
  ) || wordForms.some((word) => BLOCKED_NAME_WORDS.has(word));
}

function validateName(name: string) {
  if (name.length < 2 || name.length > 18) {
    throw new HttpError(400, "Name must be 2-18 characters.");
  }
  if (isBlockedName(name)) {
    throw new HttpError(400, "Choose a different username.");
  }
  if (!/^[a-zA-Z0-9 _-]+$/.test(name)) {
    throw new HttpError(400, "Use only letters, numbers, spaces, _ or -.");
  }
}

function todayKey(date = new Date()) {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone: LEADERBOARD_TIMEZONE,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(date);
  const values = Object.fromEntries(parts.map((part) => [part.type, part.value]));
  return `${values.year}-${values.month}-${values.day}`;
}

function calculateScore({
  level,
  steps,
  timeSeconds,
}: {
  level: number;
  steps: number;
  timeSeconds: number;
}) {
  const levelReward = SCORING.A * (level ** SCORING.P);
  const stepPenalty = SCORING.B * steps;
  const timePenalty = SCORING.C * timeSeconds;
  return {
    level,
    steps,
    timeSeconds,
    levelReward: Math.round(levelReward),
    stepPenalty: Math.round(stepPenalty),
    timePenalty: Math.round(timePenalty),
    score: Math.max(0, Math.round(levelReward - stepPenalty - timePenalty)),
    coefficients: SCORING,
  };
}

async function sha256Hex(text: string) {
  const data = new TextEncoder().encode(text);
  const hash = await crypto.subtle.digest("SHA-256", data);
  return [...new Uint8Array(hash)]
    .map((byte) => byte.toString(16).padStart(2, "0"))
    .join("");
}

function randomToken() {
  const bytes = new Uint8Array(32);
  crypto.getRandomValues(bytes);
  const binary = [...bytes].map((byte) => String.fromCharCode(byte)).join("");
  return btoa(binary).replaceAll("+", "-").replaceAll("/", "_").replaceAll("=", "");
}

function bearerToken(request: Request) {
  const header = request.headers.get("Authorization") || "";
  const match = header.match(/^Bearer\s+(.+)$/i);
  return match ? match[1] : null;
}

function playerLastActiveAt(player: PlayerRow) {
  return Date.parse(player.last_active_at || player.created_at) || 0;
}

function playerSessionExpired(player: PlayerRow, now = Date.now()) {
  return now - playerLastActiveAt(player) >= SESSION_IDLE_MS;
}

function playerSessionReleased(player: PlayerRow) {
  return player.token_hash.startsWith("ended:");
}

function playerSessionActive(player: PlayerRow, now = Date.now()) {
  return !playerSessionReleased(player) && !playerSessionExpired(player, now);
}

async function releasePlayerSession(player: PlayerRow) {
  const releasedKey = `ended:${player.id}`;
  const { error } = await supabase
    .from("row_echelon_players")
    .update({
      token_hash: releasedKey,
    })
    .eq("id", player.id)
    .eq("token_hash", player.token_hash);

  if (error) throw error;
}

async function requirePlayer(request: Request) {
  const token = bearerToken(request);
  if (!token) throw new HttpError(401, "Missing player token.");

  const tokenHash = await sha256Hex(token);
  const { data, error } = await supabase
    .from("row_echelon_players")
    .select("id,name,created_at,token_hash,last_active_at,total_solved")
    .eq("token_hash", tokenHash)
    .maybeSingle();

  if (error) throw error;
  if (!data) throw new HttpError(401, "Invalid player token.");
  const player = data as PlayerRow;
  if (playerSessionExpired(player)) {
    await releasePlayerSession(player);
    throw new HttpError(401, "Session timed out after 30 minutes of inactivity.");
  }

  const lastActiveAt = new Date().toISOString();
  const { error: touchError } = await supabase
    .from("row_echelon_players")
    .update({ last_active_at: lastActiveAt })
    .eq("id", player.id)
    .eq("token_hash", player.token_hash);

  if (touchError) throw touchError;
  return { ...player, last_active_at: lastActiveAt };
}

function rankRows(
  rows: DailyScoreRow[],
  playersById: Map<string, LeaderboardPlayer>,
  currentPlayerId: string | null,
) {
  return rows
    .map((row) => ({
      playerId: row.player_id,
      name: playersById.get(row.player_id)?.name || "Player",
      solved: playersById.get(row.player_id)?.totalSolved || 0,
      totalScore: Number(row.total_score) || 0,
      totalSteps: Number(row.total_steps) || 0,
      totalTime: Number(row.total_time) || 0,
      bestSteps: row.best_steps,
      bestLevel: Number(row.best_level) || Number(row.last_level) || 0,
      updatedAt: Date.parse(row.updated_at) || 0,
      isCurrentPlayer: row.player_id === currentPlayerId,
    }))
    .sort((left, right) =>
      right.totalScore - left.totalScore
      || right.solved - left.solved
      || left.totalSteps - right.totalSteps
      || left.totalTime - right.totalTime
      || left.updatedAt - right.updatedAt,
    )
    .map((entry, index) => ({ ...entry, rank: index + 1 }));
}

async function leaderboardPayload({
  date = todayKey(),
  currentPlayerId = null,
  limit = DEFAULT_LIMIT,
}: {
  date?: string;
  currentPlayerId?: string | null;
  limit?: number;
} = {}) {
  const { data, error } = await supabase
    .from("row_echelon_daily_scores")
    .select(`
      score_date,
      player_id,
      solved,
      total_score,
      total_steps,
      total_time,
      best_steps,
      best_level,
      last_level,
      updated_at
    `)
    .eq("score_date", date)
    .gt("total_score", 0);

  if (error) throw error;

  const rows = (data || []) as DailyScoreRow[];
  const playerIds = [...new Set(rows.map((row) => row.player_id))];
  const playersById = new Map<string, LeaderboardPlayer>();

  if (playerIds.length) {
    const { data: players, error: playersError } = await supabase
      .from("row_echelon_players")
      .select("id,name,total_solved")
      .in("id", playerIds);

    if (playersError) throw playersError;
    for (const player of players || []) {
      playersById.set(player.id, {
        name: player.name,
        totalSolved: Number(player.total_solved) || 0,
      });
    }
  }

  const ranked = rankRows(rows, playersById, currentPlayerId);
  const leaderboard = ranked.slice(0, limit);
  const playerEntry = currentPlayerId
    ? ranked.find((entry) => entry.playerId === currentPlayerId) || null
    : null;

  return {
    date,
    leaderboard,
    playerEntry,
  };
}

async function readJson(request: Request) {
  try {
    return await request.json();
  } catch {
    return {};
  }
}

async function createAccount(request: Request) {
  const body = await readJson(request);
  const name = normalizeName(body.name);
  validateName(name);

  const nameKey = name.toLowerCase();
  const { data: existing, error: existingError } = await supabase
    .from("row_echelon_players")
    .select("id,name,created_at,token_hash,last_active_at,total_solved")
    .eq("name_key", nameKey)
    .maybeSingle();

  if (existingError) throw existingError;
  if (existing && playerSessionActive(existing as PlayerRow)) {
    throw new HttpError(409, "Username is taken.");
  }

  const token = randomToken();
  const tokenHash = await sha256Hex(token);
  const lastActiveAt = new Date().toISOString();

  if (existing) {
    const existingPlayer = existing as PlayerRow;
    const { data: claimed, error: claimError } = await supabase
      .from("row_echelon_players")
      .update({
        token_hash: tokenHash,
        last_active_at: lastActiveAt,
      })
      .eq("id", existingPlayer.id)
      .eq("token_hash", existingPlayer.token_hash)
      .select("id,name,created_at,token_hash,last_active_at,total_solved")
      .maybeSingle();

    if (claimError) throw claimError;
    if (!claimed) throw new HttpError(409, "Username is taken.");

    return json({
      player: publicPlayer(claimed as PlayerRow),
      token,
      resumed: true,
    });
  }

  const { data, error } = await supabase
    .from("row_echelon_players")
    .insert({
      name,
      name_key: nameKey,
      token_hash: tokenHash,
      last_active_at: lastActiveAt,
    })
    .select("id,name,created_at,total_solved")
    .single();

  if (error) {
    if (error.code === "23505") {
      throw new HttpError(409, "Username is taken.");
    }
    throw error;
  }

  return json({
    player: publicPlayer(data as PlayerRow),
    token,
    resumed: false,
  }, 201);
}

async function endSession(request: Request) {
  const player = await requirePlayer(request);
  await releasePlayerSession(player);
  return json({ ok: true });
}

async function keepSessionAlive(request: Request) {
  await requirePlayer(request);
  return json({
    ok: true,
    idleTimeoutSeconds: SESSION_IDLE_MS / 1000,
  });
}

async function getLeaderboard(request: Request, url: URL) {
  let currentPlayerId: string | null = null;
  if (bearerToken(request)) {
    currentPlayerId = (await requirePlayer(request)).id;
  }

  const limit = Math.min(50, Math.max(1, Number(url.searchParams.get("limit")) || DEFAULT_LIMIT));
  return json(await leaderboardPayload({ currentPlayerId, limit }));
}

async function completeLevel(request: Request) {
  const body = await readJson(request);
  const level = Number(body.level);
  const steps = Number(body.steps);
  const timeSeconds = Number(body.timeSeconds);

  if (!Number.isInteger(level) || level < 1) throw new HttpError(400, "Invalid level.");
  if (!Number.isInteger(steps) || steps < 1) throw new HttpError(400, "Invalid steps.");
  if (!Number.isFinite(timeSeconds) || timeSeconds < 1) {
    throw new HttpError(400, "Invalid completion time.");
  }

  const player = await requirePlayer(request);
  const date = todayKey();
  const previous = await leaderboardPayload({ date, currentPlayerId: player.id });
  const previousRank = previous.playerEntry?.rank || null;
  const previousScore = previous.playerEntry?.totalScore || 0;
  const scoreBreakdown = calculateScore({
    level,
    steps,
    timeSeconds: Math.ceil(timeSeconds),
  });

  const { data: current, error: currentError } = await supabase
    .from("row_echelon_daily_scores")
    .select("*")
    .eq("score_date", date)
    .eq("player_id", player.id)
    .maybeSingle();

  if (currentError) throw currentError;

  if (current) {
    const next = {
      solved: (Number(current.solved) || 0) + 1,
      total_score: (Number(current.total_score) || 0) + scoreBreakdown.score,
      total_steps: (Number(current.total_steps) || 0) + steps,
      total_time: (Number(current.total_time) || 0) + scoreBreakdown.timeSeconds,
      best_steps: current.best_steps == null
        ? steps
        : Math.min(Number(current.best_steps) || steps, steps),
      best_level: Math.max(Number(current.best_level) || 0, level),
      last_level: level,
      updated_at: new Date().toISOString(),
    };

    const { error } = await supabase
      .from("row_echelon_daily_scores")
      .update(next)
      .eq("score_date", date)
      .eq("player_id", player.id);

    if (error) throw error;
  } else {
    const { error } = await supabase
      .from("row_echelon_daily_scores")
      .insert({
        score_date: date,
        player_id: player.id,
        solved: 1,
        total_score: scoreBreakdown.score,
        total_steps: steps,
        total_time: scoreBreakdown.timeSeconds,
        best_steps: steps,
        best_level: level,
        last_level: level,
        updated_at: new Date().toISOString(),
      });

    if (error) throw error;
  }

  const payload = await leaderboardPayload({ date, currentPlayerId: player.id });
  const rank = payload.playerEntry?.rank || null;
  return json({
    ...payload,
    previousRank,
    previousScore,
    scoreBreakdown,
    rank,
    rankImproved: Boolean(previousRank && rank && rank < previousRank),
  });
}

function routePath(url: URL) {
  return url.pathname
    .replace(/^\/functions\/v1\/row-echelon-api/, "")
    .replace(/^\/row-echelon-api/, "")
    || "/";
}

Deno.serve(async (request) => {
  try {
    if (request.method === "OPTIONS") {
      return new Response(null, {
        status: 204,
        headers: corsHeaders,
      });
    }

    const url = new URL(request.url);
    const path = routePath(url);

    if (request.method === "GET" && path === "/health") {
      return json({
        ok: true,
        date: todayKey(),
        timezone: LEADERBOARD_TIMEZONE,
        scoring: SCORING,
        sessionIdleTimeoutSeconds: SESSION_IDLE_MS / 1000,
      });
    }
    if (request.method === "POST" && path === "/api/accounts") {
      return await createAccount(request);
    }
    if (request.method === "GET" && path === "/api/leaderboard") {
      return await getLeaderboard(request, url);
    }
    if (request.method === "POST" && path === "/api/complete") {
      return await completeLevel(request);
    }
    if (request.method === "POST" && path === "/api/logout") {
      return await endSession(request);
    }
    if (request.method === "POST" && path === "/api/session") {
      return await keepSessionAlive(request);
    }

    throw new HttpError(404, "Not found.");
  } catch (error) {
    const status = error instanceof HttpError ? error.status : 500;
    if (status === 500) console.error(error);
    const message = error instanceof Error ? error.message : "Request failed.";
    return json({
      error: status === 500 ? "Server error." : message,
    }, status);
  }
});
