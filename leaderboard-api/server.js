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
  writeQueue = writeQueue.then(async () => {
    const db = await readDb();
    const result = await callback(db);
    await writeDb(db);
    return result;
  });
  return writeQueue;
}

function normalizeName(value) {
  return String(value || "").trim().replace(/\s+/g, " ");
}

function validateName(name) {
  if (name.length < 2 || name.length > 18) {
    throw new HttpError(400, "Name must be 2-18 characters.");
  }
  if (!/^[a-zA-Z0-9 _-]+$/.test(name)) {
    throw new HttpError(400, "Use only letters, numbers, spaces, _ or -.");
  }
}

function bearerToken(request) {
  const header = request.headers.authorization || "";
  const match = header.match(/^Bearer\s+(.+)$/i);
  return match ? match[1] : null;
}

function requirePlayer(db, request) {
  const token = bearerToken(request);
  if (!token) throw new HttpError(401, "Missing player token.");
  const hash = tokenHash(token);
  const player = db.players.find((candidate) => candidate.tokenHash === hash);
  if (!player) throw new HttpError(401, "Invalid player token.");
  return player;
}

function rankedEntries(db, date, currentPlayerId = null) {
  const byPlayer = new Map(db.players.map((player) => [player.id, player]));
  return db.dailyScores
    .filter((score) => score.date === date && byPlayer.has(score.playerId))
    .map((score) => ({
      playerId: score.playerId,
      name: byPlayer.get(score.playerId).name,
      solved: score.solved,
      totalSteps: score.totalSteps,
      bestSteps: score.bestSteps,
      updatedAt: score.updatedAt,
      isCurrentPlayer: score.playerId === currentPlayerId,
    }))
    .sort((left, right) =>
      right.solved - left.solved
      || left.totalSteps - right.totalSteps
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
    const taken = db.players.some((player) => player.name.toLowerCase() === name.toLowerCase());
    if (taken) throw new HttpError(409, "That player name is already taken.");

    const token = crypto.randomBytes(32).toString("base64url");
    const player = {
      id: crypto.randomUUID(),
      name,
      tokenHash: tokenHash(token),
      createdAt: Date.now(),
    };
    db.players.push(player);
    return {
      player: publicPlayer(player),
      token,
    };
  });
}

async function getLeaderboard(request, url) {
  const db = await readDb();
  let currentPlayerId = null;
  if (bearerToken(request)) {
    currentPlayerId = requirePlayer(db, request).id;
  }
  const limit = Math.min(50, Math.max(1, Number(url.searchParams.get("limit")) || DEFAULT_LIMIT));
  return leaderboardPayload(db, { currentPlayerId, limit });
}

async function completeLevel(request) {
  const body = await readJson(request);
  const level = Number(body.level);
  const steps = Number(body.steps);
  if (!Number.isInteger(level) || level < 1) throw new HttpError(400, "Invalid level.");
  if (!Number.isInteger(steps) || steps < 1) throw new HttpError(400, "Invalid steps.");

  return updateDb(async (db) => {
    const player = requirePlayer(db, request);
    const date = todayKey();
    const previous = leaderboardPayload(db, { date, currentPlayerId: player.id });
    const previousRank = previous.playerEntry?.rank || null;

    let score = db.dailyScores.find((entry) => entry.date === date && entry.playerId === player.id);
    if (!score) {
      score = {
        date,
        playerId: player.id,
        solved: 0,
        totalSteps: 0,
        bestSteps: null,
        lastLevel: 0,
        updatedAt: Date.now(),
      };
      db.dailyScores.push(score);
    }

    score.solved += 1;
    score.totalSteps += steps;
    score.bestSteps = score.bestSteps === null ? steps : Math.min(score.bestSteps, steps);
    score.lastLevel = level;
    score.updatedAt = Date.now();

    const payload = leaderboardPayload(db, { date, currentPlayerId: player.id });
    const rank = payload.playerEntry?.rank || null;
    return {
      ...payload,
      previousRank,
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
    send(response, 200, { ok: true, date: todayKey(), timezone: LEADERBOARD_TIMEZONE });
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
