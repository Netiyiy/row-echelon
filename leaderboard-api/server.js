const crypto = require("node:crypto");
const fs = require("node:fs/promises");
const http = require("node:http");
const path = require("node:path");
const { URL } = require("node:url");

const PORT = Number(process.env.PORT || 8787);
const DATA_FILE = process.env.DATA_FILE || path.join(__dirname, "data", "db.json");
const LEADERBOARD_TIMEZONE = process.env.LEADERBOARD_TIMEZONE || "America/Los_Angeles";
const CORS_ORIGIN = process.env.CORS_ORIGIN || "*";
const DEFAULT_LIMIT = 10;
const SESSION_IDLE_MS = Number(process.env.SESSION_IDLE_MS || 30 * 60 * 1000);
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

let writeQueue = Promise.resolve();

class HttpError extends Error {
  constructor(status, message) {
    super(message);
    this.status = status;
  }
}

function tokenHash(token) {
  return crypto.createHash("sha256").update(token).digest("hex");
}

function publicPlayer(player) {
  return {
    id: player.id,
    name: player.name,
    createdAt: player.createdAt,
  };
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

async function readDb() {
  try {
    const raw = await fs.readFile(DATA_FILE, "utf8");
    const db = JSON.parse(raw);
    return {
      players: Array.isArray(db.players) ? db.players : [],
      dailyScores: Array.isArray(db.dailyScores) ? db.dailyScores : [],
    };
  } catch (error) {
    if (error.code !== "ENOENT") throw error;
    return { players: [], dailyScores: [] };
  }
}

async function writeDb(db) {
  await fs.mkdir(path.dirname(DATA_FILE), { recursive: true });
  const tempFile = `${DATA_FILE}.${process.pid}.tmp`;
  await fs.writeFile(tempFile, `${JSON.stringify(db, null, 2)}\n`);
  await fs.rename(tempFile, DATA_FILE);
}

function updateDb(callback) {
  writeQueue = writeQueue.catch(() => undefined).then(async () => {
    const db = await readDb();
    try {
      const result = await callback(db);
      await writeDb(db);
      return result;
    } catch (error) {
      if (error.persistDb) await writeDb(db);
      throw error;
    }
  });
  return writeQueue;
}

function normalizeName(value) {
  return String(value || "").trim().replace(/\s+/g, " ");
}

function moderationText(value) {
  const substitutions = { "0": "o", "1": "i", "3": "e", "4": "a", "5": "s", "7": "t", "8": "b", "9": "g" };
  return String(value || "")
    .toLowerCase()
    .replace(/[01345789]/g, (character) => substitutions[character]);
}

function isBlockedName(name) {
  const moderated = moderationText(name);
  const compact = moderated.replace(/[^a-z]/g, "");
  const words = moderated.split(/[^a-z]+/).filter(Boolean);
  return BLOCKED_NAME_FRAGMENTS.some((term) => compact.includes(term))
    || words.some((word) => BLOCKED_NAME_WORDS.has(word));
}

function validateName(name) {
  if (name.length < 2 || name.length > 18) {
    throw new HttpError(400, "Name must be 2-18 characters.");
  }
  if (!/^[a-zA-Z0-9 _-]+$/.test(name)) {
    throw new HttpError(400, "Use only letters, numbers, spaces, _ or -.");
  }
  if (isBlockedName(name)) {
    throw new HttpError(400, "Choose a different username.");
  }
}

function bearerToken(request) {
  const header = request.headers.authorization || "";
  const match = header.match(/^Bearer\s+(.+)$/i);
  return match ? match[1] : null;
}

function playerLastActiveAt(player) {
  return Number(player.lastActiveAt) || Number(player.createdAt) || 0;
}

function playerSessionExpired(player, now = Date.now()) {
  return now - playerLastActiveAt(player) >= SESSION_IDLE_MS;
}

function playerSessionReleased(player) {
  return Boolean(player.sessionEndedAt) || String(player.tokenHash || "").startsWith("ended:");
}

function releasePlayerSession(player) {
  player.tokenHash = `ended:${player.id}`;
  player.sessionEndedAt = Date.now();
}

function mergeDailyScore(target, source) {
  target.solved = (Number(target.solved) || 0) + (Number(source.solved) || 0);
  target.totalScore = (Number(target.totalScore) || 0) + (Number(source.totalScore) || 0);
  target.totalSteps = (Number(target.totalSteps) || 0) + (Number(source.totalSteps) || 0);
  target.totalTime = (Number(target.totalTime) || 0) + (Number(source.totalTime) || 0);
  const bestSteps = [target.bestSteps, source.bestSteps]
    .map(Number)
    .filter((value) => Number.isFinite(value) && value > 0);
  target.bestSteps = bestSteps.length ? Math.min(...bestSteps) : null;
  target.bestLevel = Math.max(Number(target.bestLevel) || 0, Number(source.bestLevel) || 0);
  if ((Number(source.updatedAt) || 0) >= (Number(target.updatedAt) || 0)) {
    target.lastLevel = Number(source.lastLevel) || 0;
  }
  target.updatedAt = Math.max(Number(target.updatedAt) || 0, Number(source.updatedAt) || 0);
}

function consolidateUsernameProfiles(db, name, now = Date.now()) {
  const nameKey = name.toLowerCase();
  const matches = db.players.filter((player) => player.name.toLowerCase() === nameKey);
  if (!matches.length) return null;

  matches.forEach((player) => {
    if (!playerSessionReleased(player) && playerSessionExpired(player, now)) {
      releasePlayerSession(player);
    }
  });

  matches.sort((left, right) => {
    const leftActive = playerSessionReleased(left) ? 1 : 0;
    const rightActive = playerSessionReleased(right) ? 1 : 0;
    return leftActive - rightActive
      || Number(left.createdAt) - Number(right.createdAt)
      || String(left.id).localeCompare(String(right.id));
  });
  const canonical = matches[0];
  const duplicateIds = new Set(matches.slice(1).map((player) => player.id));

  [...db.dailyScores].forEach((score) => {
    if (!duplicateIds.has(score.playerId)) return;
    const target = db.dailyScores.find((candidate) =>
      candidate.playerId === canonical.id && candidate.date === score.date,
    );
    if (target) {
      mergeDailyScore(target, score);
      db.dailyScores.splice(db.dailyScores.indexOf(score), 1);
    } else {
      score.playerId = canonical.id;
    }
  });
  db.players = db.players.filter((player) => !duplicateIds.has(player.id));
  return canonical;
}

function requirePlayer(db, request) {
  const token = bearerToken(request);
  if (!token) throw new HttpError(401, "Missing player token.");
  const hash = tokenHash(token);
  const player = db.players.find((candidate) => candidate.tokenHash === hash);
  if (!player) throw new HttpError(401, "Invalid player token.");
  if (playerSessionExpired(player)) {
    releasePlayerSession(player);
    const error = new HttpError(401, "Session timed out after 30 minutes of inactivity.");
    error.persistDb = true;
    throw error;
  }
  player.lastActiveAt = Date.now();
  return player;
}

function calculateScore({ level, steps, timeSeconds }) {
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

function rankedEntries(db, date, currentPlayerId = null) {
  const byPlayer = new Map(db.players.map((player) => [player.id, player]));
  return db.dailyScores
    .filter((score) => score.date === date && byPlayer.has(score.playerId))
    .map((score) => ({
      playerId: score.playerId,
      name: byPlayer.get(score.playerId).name,
      solved: Number(score.solved) || 0,
      totalScore: Number(score.totalScore) || 0,
      totalSteps: Number(score.totalSteps) || 0,
      totalTime: Number(score.totalTime) || 0,
      bestSteps: score.bestSteps,
      bestLevel: Number(score.bestLevel) || Number(score.lastLevel) || 0,
      updatedAt: Number(score.updatedAt) || 0,
      isCurrentPlayer: score.playerId === currentPlayerId,
    }))
    .sort((left, right) =>
      right.totalScore - left.totalScore
      || right.solved - left.solved
      || left.totalSteps - right.totalSteps
      || left.totalTime - right.totalTime
      || left.updatedAt - right.updatedAt,
    )
    .map((entry, index) => ({
      ...entry,
      rank: index + 1,
    }));
}

function leaderboardPayload(db, { date = todayKey(), currentPlayerId = null, limit = DEFAULT_LIMIT } = {}) {
  const ranked = rankedEntries(db, date, currentPlayerId);
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

async function readJson(request) {
  const chunks = [];
  let size = 0;
  for await (const chunk of request) {
    size += chunk.length;
    if (size > 20_000) throw new HttpError(413, "Request body is too large.");
    chunks.push(chunk);
  }
  if (!chunks.length) return {};
  try {
    return JSON.parse(Buffer.concat(chunks).toString("utf8"));
  } catch {
    throw new HttpError(400, "Invalid JSON body.");
  }
}

function send(response, status, data = {}) {
  response.writeHead(status, {
    "Access-Control-Allow-Origin": CORS_ORIGIN,
    "Access-Control-Allow-Headers": "Content-Type, Authorization",
    "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
    "Content-Type": "application/json; charset=utf-8",
    "Cache-Control": "no-store",
  });
  response.end(JSON.stringify(data));
}

async function createAccount(request) {
  const body = await readJson(request);
  const name = normalizeName(body.name);
  validateName(name);

  return updateDb(async (db) => {
    const existing = consolidateUsernameProfiles(db, name);
    if (existing && !playerSessionReleased(existing)) {
      const error = new HttpError(409, "Username is taken.");
      error.persistDb = true;
      throw error;
    }

    const token = crypto.randomBytes(32).toString("base64url");
    if (existing) {
      existing.tokenHash = tokenHash(token);
      existing.lastActiveAt = Date.now();
      delete existing.sessionEndedAt;
      return {
        player: publicPlayer(existing),
        token,
        resumed: true,
      };
    }

    const player = {
      id: crypto.randomUUID(),
      name,
      tokenHash: tokenHash(token),
      createdAt: Date.now(),
      lastActiveAt: Date.now(),
    };
    db.players.push(player);
    return {
      player: publicPlayer(player),
      token,
      resumed: false,
    };
  });
}

async function endSession(request) {
  return updateDb(async (db) => {
    const player = requirePlayer(db, request);
    releasePlayerSession(player);
    return { ok: true };
  });
}

async function getLeaderboard(request, url) {
  return updateDb(async (db) => {
    let currentPlayerId = null;
    if (bearerToken(request)) {
      currentPlayerId = requirePlayer(db, request).id;
    }
    const limit = Math.min(50, Math.max(1, Number(url.searchParams.get("limit")) || DEFAULT_LIMIT));
    return leaderboardPayload(db, { currentPlayerId, limit });
  });
}

async function keepSessionAlive(request) {
  return updateDb(async (db) => {
    requirePlayer(db, request);
    return { ok: true, idleTimeoutSeconds: SESSION_IDLE_MS / 1000 };
  });
}

async function completeLevel(request) {
  const body = await readJson(request);
  const level = Number(body.level);
  const steps = Number(body.steps);
  const timeSeconds = Number(body.timeSeconds);
  if (!Number.isInteger(level) || level < 1) throw new HttpError(400, "Invalid level.");
  if (!Number.isInteger(steps) || steps < 1) throw new HttpError(400, "Invalid steps.");
  if (!Number.isFinite(timeSeconds) || timeSeconds < 1) {
    throw new HttpError(400, "Invalid completion time.");
  }

  return updateDb(async (db) => {
    const player = requirePlayer(db, request);
    const date = todayKey();
    const previous = leaderboardPayload(db, { date, currentPlayerId: player.id });
    const previousRank = previous.playerEntry?.rank || null;
    const previousScore = previous.playerEntry?.totalScore || 0;
    const scoreBreakdown = calculateScore({
      level,
      steps,
      timeSeconds: Math.ceil(timeSeconds),
    });

    let score = db.dailyScores.find((entry) => entry.date === date && entry.playerId === player.id);
    if (!score) {
      score = {
        date,
        playerId: player.id,
        solved: 0,
        totalScore: 0,
        totalSteps: 0,
        totalTime: 0,
        bestSteps: null,
        bestLevel: 0,
        lastLevel: 0,
        updatedAt: Date.now(),
      };
      db.dailyScores.push(score);
    }

    score.solved = (Number(score.solved) || 0) + 1;
    score.totalScore = (Number(score.totalScore) || 0) + scoreBreakdown.score;
    score.totalSteps = (Number(score.totalSteps) || 0) + steps;
    score.totalTime = (Number(score.totalTime) || 0) + scoreBreakdown.timeSeconds;
    score.bestSteps = score.bestSteps == null
      ? steps
      : Math.min(Number(score.bestSteps) || steps, steps);
    score.bestLevel = Math.max(Number(score.bestLevel) || 0, level);
    score.lastLevel = level;
    score.updatedAt = Date.now();

    const payload = leaderboardPayload(db, { date, currentPlayerId: player.id });
    const rank = payload.playerEntry?.rank || null;
    return {
      ...payload,
      previousRank,
      previousScore,
      scoreBreakdown,
      rank,
      rankImproved: Boolean(previousRank && rank && rank < previousRank),
    };
  });
}

async function handleRequest(request, response) {
  response.setHeader("Access-Control-Allow-Origin", CORS_ORIGIN);
  response.setHeader("Access-Control-Allow-Headers", "Content-Type, Authorization");
  response.setHeader("Access-Control-Allow-Methods", "GET, POST, OPTIONS");

  if (request.method === "OPTIONS") {
    response.writeHead(204);
    response.end();
    return;
  }

  const url = new URL(request.url, `http://${request.headers.host}`);

  if (request.method === "GET" && url.pathname === "/health") {
    send(response, 200, {
      ok: true,
      date: todayKey(),
      timezone: LEADERBOARD_TIMEZONE,
      scoring: SCORING,
      sessionIdleTimeoutSeconds: SESSION_IDLE_MS / 1000,
    });
    return;
  }
  if (request.method === "POST" && url.pathname === "/api/accounts") {
    send(response, 201, await createAccount(request));
    return;
  }
  if (request.method === "GET" && url.pathname === "/api/leaderboard") {
    send(response, 200, await getLeaderboard(request, url));
    return;
  }
  if (request.method === "POST" && url.pathname === "/api/complete") {
    send(response, 200, await completeLevel(request));
    return;
  }
  if (request.method === "POST" && url.pathname === "/api/logout") {
    send(response, 200, await endSession(request));
    return;
  }
  if (request.method === "POST" && url.pathname === "/api/session") {
    send(response, 200, await keepSessionAlive(request));
    return;
  }

  throw new HttpError(404, "Not found.");
}

const server = http.createServer((request, response) => {
  handleRequest(request, response).catch((error) => {
    const status = error.status || 500;
    send(response, status, {
      error: status === 500 ? "Server error." : error.message,
    });
    if (status === 500) console.error(error);
  });
});

server.listen(PORT, () => {
  console.log(`Row Echelon leaderboard API running on http://localhost:${PORT}`);
});
