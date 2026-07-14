class Fraction {
  constructor(numerator, denominator = 1) {
    if (!Number.isInteger(numerator) || !Number.isInteger(denominator) || denominator === 0) {
      throw new Error("Invalid fraction");
    }

    const sign = denominator < 0 ? -1 : 1;
    const divisor = Fraction.gcd(numerator, denominator);
    this.numerator = (sign * numerator) / divisor;
    this.denominator = (sign * denominator) / divisor;
  }

  static gcd(first, second) {
    let left = Math.abs(first);
    let right = Math.abs(second);
    while (right !== 0) {
      [left, right] = [right, left % right];
    }
    return Math.max(1, left);
  }

  static parse(text) {
    const compact = String(text).replaceAll(" ", "");
    if (!compact) return null;

    if (compact.includes("/")) {
      const parts = compact.split("/");
      if (parts.length !== 2) return null;
      const numerator = Number(parts[0]);
      const denominator = Number(parts[1]);
      if (!Number.isInteger(numerator) || !Number.isInteger(denominator) || denominator === 0) {
        return null;
      }
      return new Fraction(numerator, denominator);
    }

    if (compact.includes(".")) {
      const sign = compact.startsWith("-") ? -1 : 1;
      const unsigned = compact.replace(/^[+-]/, "");
      const parts = unsigned.split(".");
      if (parts.length !== 2 || !/^\d*$/.test(parts[0]) || !/^\d+$/.test(parts[1])) {
        return null;
      }
      const denominator = 10 ** parts[1].length;
      const whole = Number(parts[0] || "0");
      const decimal = Number(parts[1]);
      return new Fraction(sign * (whole * denominator + decimal), denominator);
    }

    const integer = Number(compact);
    return Number.isInteger(integer) ? new Fraction(integer) : null;
  }

  get isZero() {
    return this.numerator === 0;
  }

  add(other) {
    return new Fraction(
      this.numerator * other.denominator + other.numerator * this.denominator,
      this.denominator * other.denominator,
    );
  }

  multiply(other) {
    return new Fraction(
      this.numerator * other.numerator,
      this.denominator * other.denominator,
    );
  }

  divide(other) {
    return new Fraction(
      this.numerator * other.denominator,
      this.denominator * other.numerator,
    );
  }

  clone() {
    return new Fraction(this.numerator, this.denominator);
  }

  toString() {
    return this.denominator === 1
      ? String(this.numerator)
      : `${this.numerator}/${this.denominator}`;
  }
}

const $ = (selector) => document.querySelector(selector);
const $$ = (selector) => [...document.querySelectorAll(selector)];
const wait = (duration) => new Promise((resolve) => window.setTimeout(resolve, duration));
const randomInt = (minimum, maximum) =>
  Math.floor(Math.random() * (maximum - minimum + 1)) + minimum;
const choose = (values) => values[randomInt(0, values.length - 1)];
const nonZeroSmallInt = () => choose([-3, -2, -1, 1, 2, 3]);
const fraction = (value) => new Fraction(value);
const cloneMatrix = (matrix) => matrix.map((row) => row.map((value) => value.clone()));
const LEADERBOARD_LIMIT = 10;
const SESSION_KEY = "rowEchelonPlayerSession";
const SCORING = Object.freeze({
  A: 165,
  P: 1.22,
  B: 7,
  C: 1.25,
});
const SUPABASE_API_BASE_URL =
  "https://fkoupqflxcwyofsbgjgw.functions.supabase.co/row-echelon-api";

function configuredApiBaseUrl() {
  const queryApi = new URLSearchParams(window.location.search).get("api");
  if (queryApi) {
    localStorage.setItem("rowEchelonApiBaseUrl", queryApi);
  }
  const defaultApi = window.location.hostname === "localhost"
    || window.location.hostname === "127.0.0.1"
    ? "http://localhost:8787"
    : SUPABASE_API_BASE_URL;
  return (
    window.ROW_ECHELON_API_BASE_URL
    || queryApi
    || localStorage.getItem("rowEchelonApiBaseUrl")
    || defaultApi
  ).replace(/\/$/, "");
}

const API_BASE_URL = configuredApiBaseUrl();

function formatTime(seconds) {
  const totalSeconds = Math.max(0, Math.floor(seconds));
  const minutes = Math.floor(totalSeconds / 60);
  const remainder = String(totalSeconds % 60).padStart(2, "0");
  return `${minutes}:${remainder}`;
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

class GameAudio {
  constructor() {
    this.backgroundVolume = 0.3;
    this.duckedBackgroundVolume = 0.1;
    this.background = new Audio("assets/audio/row_echelon_music.mp3");
    this.background.loop = true;
    this.background.preload = "auto";
    this.background.volume = this.backgroundVolume;
    this.effects = new Set();
    this.fadeFrame = null;
    this.restoreTimer = null;
  }

  startMusic() {
    if (!this.background.paused) return;
    this.background.play().catch(() => {});
  }

  play(effect) {
    this.startMusic();
    const isCelebration = effect === "complete" || effect === "rank";
    const fileName = effect === "rank" ? "complete" : effect;
    const extension = isCelebration ? "mp3" : "wav";
    const player = new Audio(`assets/audio/ui_${fileName}.${extension}`);
    player.volume = effect === "complete" ? 0.68 : effect === "rank" ? 0.46 : 0.55;
    this.effects.add(player);
    player.addEventListener("ended", () => {
      this.effects.delete(player);
      if (isCelebration) {
        this.fadeBackgroundTo(this.backgroundVolume, 800);
      }
    });
    if (isCelebration) {
      this.duckMusic();
    }
    player.play().catch(() => {});
  }

  duckMusic() {
    window.clearTimeout(this.restoreTimer);
    this.fadeBackgroundTo(this.duckedBackgroundVolume, 350);
    this.restoreTimer = window.setTimeout(() => {
      this.fadeBackgroundTo(this.backgroundVolume, 800);
    }, 6200);
  }

  fadeBackgroundTo(targetVolume, duration) {
    if (this.fadeFrame) window.cancelAnimationFrame(this.fadeFrame);
    const startVolume = this.background.volume;
    const startedAt = performance.now();

    const tick = (now) => {
      const progress = Math.min(1, (now - startedAt) / duration);
      this.background.volume = startVolume + (targetVolume - startVolume) * progress;
      if (progress < 1) {
        this.fadeFrame = window.requestAnimationFrame(tick);
      } else {
        this.fadeFrame = null;
      }
    };
    this.fadeFrame = window.requestAnimationFrame(tick);
  }
}

const audio = new GameAudio();
const state = {
  level: 1,
  matrix: [],
  originalMatrix: [],
  history: [],
  mode: "add",
  factor: fraction(-1),
  selectedRow: null,
  isSolved: false,
  steps: 0,
  bestSteps: Number(localStorage.getItem("rowEchelonBestSteps")) || null,
  levelStartedAt: 0,
  elapsedSeconds: 0,
  timerId: null,
  resultAnimationToken: 0,
  resultScoreBreakdown: null,
  lastLeaderboardResult: null,
  playerSession: loadPlayerSession(),
  leaderboard: [],
  playerEntry: null,
  leaderboardDate: "",
  leaderboardMessage: "",
  leaderboardVisible: false,
  accountMessage: "",
  celebrationToken: 0,
  settingsOpen: false,
};

function loadPlayerSession() {
  try {
    const session = JSON.parse(localStorage.getItem(SESSION_KEY) || "null");
    if (!session?.token || !session?.player?.id || !session?.player?.name) return null;
    return session;
  } catch {
    return null;
  }
}

function savePlayerSession(session) {
  state.playerSession = session;
  localStorage.setItem(SESSION_KEY, JSON.stringify(session));
}

function clearPlayerSession() {
  state.playerSession = null;
  localStorage.removeItem(SESSION_KEY);
}

function signedIn() {
  return Boolean(state.playerSession?.token);
}

function isAuthError(error) {
  return error?.status === 401 || /token|session/i.test(error?.message || "");
}

async function apiRequest(path, { method = "GET", body, auth = false } = {}) {
  const headers = { "Content-Type": "application/json" };
  if (auth && state.playerSession?.token) {
    headers.Authorization = `Bearer ${state.playerSession.token}`;
  }

  let response;
  try {
    response = await fetch(`${API_BASE_URL}${path}`, {
      method,
      headers,
      body: body ? JSON.stringify(body) : undefined,
    });
  } catch {
    throw new Error("Backend is not reachable yet.");
  }
  const data = await response.json().catch(() => ({}));
  if (!response.ok) {
    const requestError = new Error(data.error || `Request failed (${response.status})`);
    requestError.status = response.status;
    throw requestError;
  }
  return data;
}

function intMatrix(values) {
  return values.map((row) => row.map(fraction));
}

function randomEchelonMatrix() {
  return intMatrix([
    [1, nonZeroSmallInt(), nonZeroSmallInt(), randomInt(-4, 4)],
    [0, 1, nonZeroSmallInt(), randomInt(-4, 4)],
    [0, 0, 1, randomInt(-4, 4)],
  ]);
}

function generateMatrix(level) {
  for (let attempt = 0; attempt < 80; attempt += 1) {
    const candidate = randomEchelonMatrix();
    const scrambleCount = Math.min(4 + Math.floor(level / 2), 10);

    for (let step = 0; step < scrambleCount; step += 1) {
      if (step > 0 && step % 4 === 0 && Math.random() < 0.5) {
        const first = randomInt(0, candidate.length - 1);
        let second = randomInt(0, candidate.length - 1);
        while (second === first) second = randomInt(0, candidate.length - 1);
        [candidate[first], candidate[second]] = [candidate[second], candidate[first]];
      } else {
        const source = randomInt(0, candidate.length - 1);
        let target = randomInt(0, candidate.length - 1);
        while (target === source) target = randomInt(0, candidate.length - 1);
        const amount = fraction(choose([-3, -2, -1, 1, 2, 3]));
        candidate[target] = candidate[target].map((value, column) =>
          value.add(amount.multiply(candidate[source][column])),
        );
      }
    }

    const valuesStayReadable = candidate
      .flat()
      .every((value) => Math.abs(value.numerator) <= 60);
    if (valuesStayReadable && !isGameSolved(candidate)) return candidate;
  }

  return intMatrix([
    [1, 2, -1, 3],
    [0, 1, 2, -1],
    [0, 0, 1, 4],
  ]);
}

function isOne(value) {
  return value.numerator === 1 && value.denominator === 1;
}

function isGameSolved(matrix) {
  if (!matrix.length) return false;
  const coefficientColumns = matrix[0].length - 1;
  if (matrix.length !== coefficientColumns) return false;

  return matrix.every((row, rowIndex) =>
    row.slice(0, coefficientColumns).every((value, columnIndex) =>
      columnIndex === rowIndex ? isOne(value) : value.isZero,
    ),
  );
}

function reducedRowEchelonForm(source) {
  const values = cloneMatrix(source);
  const columnCount = values[0].length;
  let pivotRow = 0;

  for (let column = 0; column < columnCount && pivotRow < values.length; column += 1) {
    const sourceRow = values.findIndex((row, index) => index >= pivotRow && !row[column].isZero);
    if (sourceRow === -1) continue;
    [values[pivotRow], values[sourceRow]] = [values[sourceRow], values[pivotRow]];

    const pivot = values[pivotRow][column];
    values[pivotRow] = values[pivotRow].map((value) => value.divide(pivot));
    for (let row = 0; row < values.length; row += 1) {
      if (row === pivotRow) continue;
      const amount = values[row][column];
      if (amount.isZero) continue;
      values[row] = values[row].map((value, targetColumn) =>
        value.add(fraction(-1).multiply(amount).multiply(values[pivotRow][targetColumn])),
      );
    }
    pivotRow += 1;
  }
  return values;
}

function currentElapsedSeconds() {
  if (!state.levelStartedAt) return state.elapsedSeconds;
  return Math.max(0, Math.floor((performance.now() - state.levelStartedAt) / 1000));
}

function updateTimerLabel(seconds = currentElapsedSeconds()) {
  $("#timer-label").textContent = `TIME ${formatTime(seconds)}`;
}

function clearLevelTimer() {
  if (state.timerId) {
    window.clearInterval(state.timerId);
    state.timerId = null;
  }
  state.levelStartedAt = 0;
}

function startLevelTimer() {
  clearLevelTimer();
  state.elapsedSeconds = 0;
  state.levelStartedAt = performance.now();
  updateTimerLabel(0);
  state.timerId = window.setInterval(() => {
    if (state.isSolved) return;
    state.elapsedSeconds = currentElapsedSeconds();
    updateTimerLabel(state.elapsedSeconds);
  }, 250);
}

function stopLevelTimer() {
  if (state.levelStartedAt) {
    state.elapsedSeconds = Math.max(
      1,
      Math.ceil((performance.now() - state.levelStartedAt) / 1000),
    );
  }
  clearLevelTimer();
  updateTimerLabel(state.elapsedSeconds);
  return state.elapsedSeconds;
}

function updateScoreLabels() {
  $("#current-score").textContent = `STEPS ${state.steps}`;
  updateTimerLabel(state.isSolved ? state.elapsedSeconds : currentElapsedSeconds());
}

function renderAccount() {
  const hasPlayer = signedIn();
  $("#account-gate").hidden = hasPlayer;
  $(".game-shell").classList.toggle("account-locked", !hasPlayer);
  $("#player-label").textContent = hasPlayer ? state.playerSession.player.name : "NO PLAYER";
  $("#account-message").textContent = state.accountMessage;
}

function renderSettings() {
  $("#settings-button").classList.toggle("active", state.settingsOpen);
  $("#settings-menu").hidden = !state.settingsOpen;
  $("#logout-button").disabled = !signedIn();
}

function leaderboardRows() {
  const rows = [...state.leaderboard];
  if (
    state.playerEntry
    && !rows.some((entry) => entry.playerId === state.playerEntry.playerId)
  ) {
    rows.push({ isGap: true });
    rows.push(state.playerEntry);
  }
  return rows;
}

function renderLeaderboard({ rankImproved = false, previousRank = null } = {}) {
  const screen = $("#results-screen");
  screen.hidden = !state.leaderboardVisible;
  if (!state.leaderboardVisible) {
    screen.classList.remove("visible", "exiting");
  }
  $(".game-shell").classList.toggle("leaderboard-visible", state.leaderboardVisible);

  $("#leaderboard-date").textContent = state.leaderboardDate
    ? `TODAY ${state.leaderboardDate}`
    : "TODAY";
  $("#leaderboard-message").textContent = state.leaderboardMessage;

  const rows = leaderboardRows();
  const list = $("#leaderboard-list");
  if (!signedIn()) {
    list.replaceChildren();
    $("#leaderboard-message").textContent = "Create a player to compete.";
    return;
  }
  if (!rows.length) {
    const empty = document.createElement("li");
    empty.className = "leaderboard-empty";
    empty.textContent = "No scores yet today.";
    list.replaceChildren(empty);
    return;
  }

  list.replaceChildren(
    ...rows.map((entry) => {
      const row = document.createElement("li");
      if (entry.isGap) {
        row.className = "leaderboard-gap";
        row.textContent = "...";
        return row;
      }

      row.className = `leaderboard-row${entry.isCurrentPlayer ? " current-player" : ""}`;
      if (rankImproved && entry.isCurrentPlayer && previousRank && previousRank > entry.rank) {
        row.classList.add("rank-up");
        row.style.setProperty("--rank-shift", `${Math.min(previousRank - entry.rank, 6) * 38}px`);
      }

      const rank = document.createElement("span");
      rank.className = "leaderboard-rank";
      rank.textContent = `#${entry.rank}`;

      const name = document.createElement("span");
      name.className = "leaderboard-name";
      name.textContent = entry.name;

      const solved = document.createElement("span");
      solved.className = "leaderboard-solved";
      solved.textContent = `${entry.solved} solved`;

      const score = document.createElement("span");
      score.className = "leaderboard-score";
      score.textContent = `${entry.totalScore ?? 0} pts`;

      row.append(rank, name, score, solved);
      return row;
    }),
  );
}

function setLeaderboardData(data, renderOptions = {}) {
  state.leaderboard = Array.isArray(data.leaderboard) ? data.leaderboard : [];
  state.playerEntry = data.playerEntry || null;
  state.leaderboardDate = data.date || "";
  if (!renderOptions.skipRender) {
    renderLeaderboard(renderOptions);
  }
}

function renderRankSummary(result = {}) {
  const breakdown = result.scoreBreakdown || state.resultScoreBreakdown;
  const totalScore = result.totalScore ?? state.playerEntry?.totalScore ?? breakdown?.score ?? 0;
  const summary = $("#rank-summary");

  if (result.offline) {
    summary.textContent = "Score is local until the backend is online.";
    return;
  }
  if (result.rankImproved && result.previousRank && result.rank) {
    summary.textContent = `Rank up #${result.previousRank} -> #${result.rank}`;
    return;
  }
  if (result.rank) {
    summary.textContent = `Rank #${result.rank} • ${totalScore} total pts`;
    return;
  }
  summary.textContent = "Leaderboard is updating.";
}

function prepareResultCard(result = {}) {
  const breakdown = result.scoreBreakdown || state.resultScoreBreakdown;
  state.resultScoreBreakdown = breakdown;
  state.lastLeaderboardResult = result;

  $$("#results-screen [data-result-item]").forEach((item) => {
    item.classList.remove("revealed");
  });
  $$("#results-screen .leaderboard-row, #results-screen .leaderboard-empty, #results-screen .leaderboard-gap")
    .forEach((item) => item.classList.remove("revealed"));

  $("#result-score").textContent = "0";
  $("#result-reward").textContent = "+0";
  $("#result-step-penalty").textContent = "-0";
  $("#result-time-penalty").textContent = "-0";
  $("#result-level-stats").textContent =
    `L${breakdown.level} • ${breakdown.steps} steps • ${formatTime(breakdown.timeSeconds)}`;

  renderRankSummary(result);
  renderLeaderboard({
    rankImproved: result.rankImproved,
    previousRank: result.previousRank,
  });
}

function animateNumber(element, to, {
  duration = 680,
  prefix = "",
  suffix = "",
  token = state.resultAnimationToken,
} = {}) {
  return new Promise((resolve) => {
    const startedAt = performance.now();
    const target = Number(to) || 0;

    const tick = (now) => {
      if (token !== state.resultAnimationToken) {
        resolve();
        return;
      }

      const progress = Math.min(1, (now - startedAt) / duration);
      const eased = 1 - ((1 - progress) ** 3);
      element.textContent = `${prefix}${Math.round(target * eased)}${suffix}`;

      if (progress < 1) {
        window.requestAnimationFrame(tick);
      } else {
        element.textContent = `${prefix}${Math.round(target)}${suffix}`;
        resolve();
      }
    };

    window.requestAnimationFrame(tick);
  });
}

async function animateResults(result, token) {
  const breakdown = result.scoreBreakdown || state.resultScoreBreakdown;
  const items = $$("#results-screen [data-result-item]");
  const [reward, stepPenalty, timePenalty, stats] = items;

  await wait(190);
  if (token !== state.resultAnimationToken) return;
  reward.classList.add("revealed");
  await animateNumber($("#result-reward"), breakdown.levelReward, { prefix: "+", token });

  await wait(110);
  if (token !== state.resultAnimationToken) return;
  stepPenalty.classList.add("revealed");
  await animateNumber($("#result-step-penalty"), breakdown.stepPenalty, { prefix: "-", token });

  await wait(110);
  if (token !== state.resultAnimationToken) return;
  timePenalty.classList.add("revealed");
  await animateNumber($("#result-time-penalty"), breakdown.timePenalty, { prefix: "-", token });

  await wait(110);
  if (token !== state.resultAnimationToken) return;
  stats.classList.add("revealed");

  await wait(180);
  if (token !== state.resultAnimationToken) return;
  await animateNumber($("#result-score"), breakdown.score, { duration: 900, token });

  const rows = $$("#results-screen .leaderboard-row, #results-screen .leaderboard-empty, #results-screen .leaderboard-gap");
  for (const row of rows) {
    if (token !== state.resultAnimationToken) return;
    row.classList.add("revealed");
    await wait(90);
  }
}

async function showResults(result, celebrationToken) {
  state.leaderboardVisible = true;
  state.resultAnimationToken += 1;
  const animationToken = state.resultAnimationToken;
  prepareResultCard(result);

  const screen = $("#results-screen");
  screen.hidden = false;
  screen.classList.remove("exiting");
  window.requestAnimationFrame(() => {
    screen.classList.add("visible");
  });

  if (result.rankImproved) {
    audio.play("rank");
    launchLeaderboardConfetti();
  }

  await animateResults(result, animationToken);
  if (celebrationToken !== state.celebrationToken) return;
}

async function goToNextLevel() {
  if (!state.leaderboardVisible) return;
  const token = ++state.resultAnimationToken;
  const screen = $("#results-screen");
  screen.classList.add("exiting");
  screen.classList.remove("visible");
  $(".game-shell").classList.add("results-next");

  await wait(460);
  if (token !== state.resultAnimationToken) return;

  state.leaderboardVisible = false;
  state.lastLeaderboardResult = null;
  state.resultScoreBreakdown = null;
  $(".game-shell").classList.remove("leaderboard-visible", "results-next");
  $(".game-shell").classList.add("play-entering");
  screen.hidden = true;
  startLevel(state.level + 1);
  window.requestAnimationFrame(() => {
    $(".game-shell").classList.remove("play-entering");
  });
}

async function refreshLeaderboard() {
  if (!signedIn()) {
    renderLeaderboard();
    return;
  }
  try {
    const data = await apiRequest(`/api/leaderboard?limit=${LEADERBOARD_LIMIT}`, { auth: true });
    state.leaderboardMessage = "Rank is based on total points today.";
    setLeaderboardData(data);
  } catch (error) {
    if (isAuthError(error)) {
      clearPlayerAndLock("Session expired. Choose a name to play.");
      startLevel(1);
      return;
    }
    state.leaderboardMessage = `Leaderboard offline: ${error.message}`;
    renderLeaderboard();
  }
}

function clearPlayerAndLock(message) {
  clearLevelTimer();
  clearPlayerSession();
  state.settingsOpen = false;
  state.leaderboard = [];
  state.playerEntry = null;
  state.leaderboardDate = "";
  state.leaderboardMessage = "";
  state.leaderboardVisible = false;
  state.accountMessage = message;
  state.resultAnimationToken += 1;
  state.celebrationToken += 1;
  render();
}

function launchLeaderboardConfetti() {
  const layer = $("#leaderboard-confetti");
  layer.replaceChildren();
  for (let index = 0; index < 24; index += 1) {
    const piece = document.createElement("span");
    piece.className = "leaderboard-confetti-piece";
    const angle = Math.random() * Math.PI * 2;
    const distance = randomInt(42, 150);
    piece.style.setProperty("--confetti-x", `${Math.cos(angle) * distance}px`);
    piece.style.setProperty("--confetti-y", `${Math.sin(angle) * distance}px`);
    piece.style.setProperty("--confetti-rotate", `${randomInt(-160, 160)}deg`);
    piece.style.setProperty("--confetti-delay", `${Math.random() * 240}ms`);
    piece.style.setProperty(
      "--confetti-color",
      index % 3 === 0 ? "var(--success)" : index % 2 === 0 ? "var(--accent)" : "var(--cream)",
    );
    layer.append(piece);
  }
  window.setTimeout(() => layer.replaceChildren(), 1800);
}

async function submitCompletedLevel(scoreBreakdown) {
  if (!signedIn()) {
    state.accountMessage = "Create a player before competing.";
    renderAccount();
    return { scoreBreakdown, offline: true };
  }

  const previousRank = state.playerEntry?.rank || null;
  try {
    const data = await apiRequest("/api/complete", {
      method: "POST",
      auth: true,
      body: {
        level: state.level,
        steps: state.steps,
        timeSeconds: scoreBreakdown.timeSeconds,
      },
    });
    const currentRank = data.playerEntry?.rank || data.rank;
    const knownPreviousRank = data.previousRank || previousRank;
    const rankImproved = Boolean(
      data.rankImproved || (knownPreviousRank && currentRank && currentRank < knownPreviousRank),
    );
    const finalBreakdown = data.scoreBreakdown || scoreBreakdown;
    const totalScore = data.playerEntry?.totalScore ?? finalBreakdown.score;
    state.leaderboardMessage = rankImproved
      ? `Rank up: #${knownPreviousRank} -> #${currentRank}`
      : `+${finalBreakdown.score} pts • ${totalScore} total`;
    setLeaderboardData(data, { skipRender: true });
    return {
      rankImproved,
      previousRank: knownPreviousRank,
      rank: currentRank,
      scoreBreakdown: finalBreakdown,
      previousScore: data.previousScore ?? null,
      totalScore,
    };
  } catch (error) {
    if (isAuthError(error)) {
      clearPlayerAndLock("Session expired. Choose a name to play.");
      startLevel(1);
      return { scoreBreakdown, offline: true };
    }
    state.leaderboardMessage = `Score not saved: ${error.message}`;
    return { scoreBreakdown, offline: true };
  }
}

function renderMatrix() {
  const matrix = $("#matrix");
  matrix.replaceChildren(
    ...state.matrix.map((row, rowIndex) => {
      const rowButton = document.createElement("button");
      rowButton.type = "button";
      rowButton.className = `matrix-row${state.selectedRow === rowIndex ? " selected" : ""}`;
      rowButton.dataset.row = String(rowIndex);
      rowButton.setAttribute("aria-label", `Row ${rowIndex + 1}: ${row.join(", ")}`);

      for (const value of row) {
        const cell = document.createElement("span");
        cell.className = "matrix-value";
        cell.textContent = value.toString();
        rowButton.append(cell);
      }
      rowButton.addEventListener("click", () => chooseRow(rowIndex));
      return rowButton;
    }),
  );
}

function renderControls() {
  $$(".operation-button").forEach((button) => {
    button.classList.toggle("active", button.dataset.mode === state.mode);
  });
  const factorInput = $("#factor-input");
  if (document.activeElement !== factorInput) {
    factorInput.value = state.factor.toString();
    factorInput.classList.remove("invalid");
    factorInput.removeAttribute("aria-invalid");
  }
}

function render() {
  $("#level-label").textContent = `LEVEL ${state.level}`;
  $("#level-cleared").textContent = state.isSolved ? "LEVEL CLEARED" : "";
  $(".game-shell").classList.toggle("celebrating", state.isSolved);
  renderMatrix();
  renderControls();
  renderAccount();
  renderSettings();
  renderLeaderboard();
  updateScoreLabels();
}

function startLevel(level) {
  clearLevelTimer();
  state.celebrationToken += 1;
  state.level = level;
  state.matrix = generateMatrix(level);
  state.originalMatrix = cloneMatrix(state.matrix);
  state.history = [];
  state.mode = "add";
  state.factor = fraction(-1);
  state.selectedRow = null;
  state.isSolved = false;
  state.steps = 0;
  state.elapsedSeconds = 0;
  state.resultScoreBreakdown = null;
  state.lastLeaderboardResult = null;
  state.leaderboardVisible = false;
  $(".game-shell").classList.remove("leaderboard-visible", "results-next");
  $("#sparkle-layer").replaceChildren();
  render();
  if (signedIn()) {
    startLevelTimer();
  }
}

function applyChange(change) {
  state.history.push(cloneMatrix(state.matrix));
  change();
  state.steps += 1;
  state.selectedRow = null;
  state.isSolved = isGameSolved(state.matrix);
  render();
  if (state.isSolved) completeLevel();
}

function chooseRow(row) {
  if (state.isSolved) return;
  if (!signedIn()) {
    state.accountMessage = "Create a player first.";
    renderAccount();
    audio.play("tap");
    return;
  }
  if (state.mode === "scale") {
    audio.play("apply");
    applyChange(() => {
      state.matrix[row] = state.matrix[row].map((value) => value.multiply(state.factor));
    });
    return;
  }

  if (state.selectedRow === null) {
    audio.play("row");
    state.selectedRow = row;
    render();
    return;
  }

  if (state.selectedRow === row) {
    audio.play("tap");
    state.selectedRow = null;
    render();
    return;
  }

  const source = state.selectedRow;
  audio.play("apply");
  applyChange(() => {
    if (state.mode === "swap") {
      [state.matrix[source], state.matrix[row]] = [state.matrix[row], state.matrix[source]];
    } else {
      state.matrix[row] = state.matrix[row].map((value, column) =>
        value.add(state.factor.multiply(state.matrix[source][column])),
      );
    }
  });
}

function resetLevel() {
  if (state.isSolved) return;
  audio.play("reset");
  clearLevelTimer();
  state.matrix = cloneMatrix(state.originalMatrix);
  state.history = [];
  state.selectedRow = null;
  state.isSolved = false;
  state.steps = 0;
  state.elapsedSeconds = 0;
  state.leaderboardVisible = false;
  render();
  if (signedIn()) {
    startLevelTimer();
  }
}

async function completeLevel() {
  const completionTime = stopLevelTimer();
  const scoreBreakdown = calculateScore({
    level: state.level,
    steps: state.steps,
    timeSeconds: completionTime,
  });
  state.resultScoreBreakdown = scoreBreakdown;

  if (!state.bestSteps || state.steps < state.bestSteps) {
    state.bestSteps = state.steps;
    localStorage.setItem("rowEchelonBestSteps", String(state.bestSteps));
  }
  updateScoreLabels();
  audio.play("complete");
  const leaderboardSave = submitCompletedLevel(scoreBreakdown);

  const token = ++state.celebrationToken;
  const reduced = reducedRowEchelonForm(state.matrix);
  await wait(150);

  for (let row = state.matrix.length - 1; row >= 0; row -= 1) {
    if (token !== state.celebrationToken) return;
    await animateSlotRow(row, reduced[row], token);
    await wait(100);
  }

  if (token !== state.celebrationToken) return;
  addCompletionSparkles();
  const leaderboardResult = await leaderboardSave;
  if (token !== state.celebrationToken) return;

  await showResults(
    {
      ...leaderboardResult,
      scoreBreakdown: leaderboardResult?.scoreBreakdown || scoreBreakdown,
    },
    token,
  );
}

async function animateSlotRow(rowIndex, solvedRow, token) {
  const row = $(`.matrix-row[data-row="${rowIndex}"]`);
  if (!row) return;
  row.classList.add("slot-active");
  const cells = [...row.querySelectorAll(".matrix-value")];

  cells.forEach((cell, column) => {
    const reelValues = [
      state.matrix[rowIndex][column],
      ...Array.from({ length: 6 }, () => fraction(randomInt(-9, 9))),
      solvedRow[column],
    ];
    const windowElement = document.createElement("span");
    windowElement.className = "slot-window";
    const reel = document.createElement("span");
    reel.className = "slot-reel";
    reel.style.transitionDuration = `${580 + column * 55}ms`;
    for (const value of reelValues) {
      const item = document.createElement("span");
      item.className = "slot-item";
      item.textContent = value.toString();
      reel.append(item);
    }
    windowElement.append(reel);
    cell.replaceChildren(windowElement);
    window.requestAnimationFrame(() => {
      window.requestAnimationFrame(() => {
        reel.style.transform = `translateY(-${(reelValues.length - 1) * 100}%)`;
      });
    });
  });

  await wait(820);
  if (token !== state.celebrationToken) return;
  state.matrix[rowIndex] = solvedRow.map((value) => value.clone());
  renderMatrix();
  const solvedElement = $(`.matrix-row[data-row="${rowIndex}"]`);
  solvedElement?.classList.add("row-solved");
}

function addCompletionSparkles() {
  const sparkleLayer = $("#sparkle-layer");
  sparkleLayer.replaceChildren();

  for (let index = 0; index < 26; index += 1) {
    const sparkle = document.createElement("span");
    sparkle.className = "sparkle";
    const angle = Math.random() * Math.PI * 2;
    const distance = randomInt(82, 190);
    sparkle.style.setProperty("--sparkle-size", `${randomInt(7, 15)}px`);
    sparkle.style.setProperty("--sparkle-x", `${Math.cos(angle) * distance}px`);
    sparkle.style.setProperty("--sparkle-y", `${Math.sin(angle) * distance}px`);
    sparkle.style.setProperty("--sparkle-rotation", `${randomInt(-70, 70)}deg`);
    sparkle.style.setProperty("--sparkle-delay", `${Math.random() * 320}ms`);
    sparkle.style.setProperty(
      "--sparkle-color",
      index % 3 === 0 ? "var(--cream)" : index % 2 === 0 ? "var(--success)" : "var(--accent)",
    );
    sparkleLayer.append(sparkle);
  }

  window.setTimeout(() => sparkleLayer.replaceChildren(), 1800);
}

function updateFactorFromInput({ restoreInvalid = false } = {}) {
  const input = $("#factor-input");
  const value = Fraction.parse(input.value);

  if (!value || value.isZero) {
    input.classList.add("invalid");
    input.setAttribute("aria-invalid", "true");
    if (restoreInvalid) {
      input.value = state.factor.toString();
      input.classList.remove("invalid");
      input.removeAttribute("aria-invalid");
    }
    return false;
  }

  state.factor = value;
  state.selectedRow = null;
  input.classList.remove("invalid");
  input.removeAttribute("aria-invalid");
  renderMatrix();
  return true;
}

function logoutPlayer() {
  if (!signedIn()) return;
  audio.play("tap");
  clearPlayerAndLock("Logged out. Choose a name to play.");
  startLevel(1);
}

async function createAccount() {
  const input = $("#player-name-input");
  const name = input.value.trim();
  if (name.length < 2) {
    state.accountMessage = "Use at least 2 characters.";
    renderAccount();
    return;
  }

  $("#create-account-button").disabled = true;
  state.accountMessage = "Creating player...";
  renderAccount();
  try {
    const session = await apiRequest("/api/accounts", {
      method: "POST",
      body: { name },
    });
    savePlayerSession(session);
    state.accountMessage = "";
    state.leaderboardMessage = "Account ready. Solve levels to climb.";
    input.value = "";
    startLevel(state.level);
    await refreshLeaderboard();
  } catch (error) {
    state.accountMessage = error.message;
    renderAccount();
  } finally {
    $("#create-account-button").disabled = false;
  }
}

$$(".operation-button").forEach((button) => {
  button.addEventListener("click", () => {
    if (state.isSolved) return;
    audio.play("tap");
    state.mode = button.dataset.mode;
    state.selectedRow = null;
    render();
  });
});

$("#create-account-button").addEventListener("click", createAccount);
$("#player-name-input").addEventListener("keydown", (event) => {
  if (event.key !== "Enter") return;
  event.preventDefault();
  createAccount();
});

$("#reset-button").addEventListener("click", resetLevel);
$("#next-level-button").addEventListener("click", goToNextLevel);
$("#settings-button").addEventListener("click", (event) => {
  event.stopPropagation();
  audio.play("tap");
  state.settingsOpen = !state.settingsOpen;
  renderSettings();
});
$("#settings-menu").addEventListener("click", (event) => event.stopPropagation());
$("#logout-button").addEventListener("click", logoutPlayer);
$("#factor-input").addEventListener("focus", (event) => {
  if (state.isSolved) {
    event.target.blur();
    return;
  }
  audio.play("tap");
  event.target.select();
});
$("#factor-input").addEventListener("input", () => updateFactorFromInput());
$("#factor-input").addEventListener("blur", () => updateFactorFromInput({ restoreInvalid: true }));
$("#factor-input").addEventListener("keydown", (event) => {
  if (event.key !== "Enter") return;
  event.preventDefault();
  if (updateFactorFromInput({ restoreInvalid: true })) {
    event.target.blur();
  }
});

document.addEventListener("click", () => {
  if (!state.settingsOpen) return;
  state.settingsOpen = false;
  renderSettings();
});
document.addEventListener("keydown", (event) => {
  if (event.key !== "Escape" || !state.settingsOpen) return;
  state.settingsOpen = false;
  renderSettings();
});
document.addEventListener("pointerdown", () => audio.startMusic(), { once: true });

if ("serviceWorker" in navigator) {
  window.addEventListener("load", () => {
    navigator.serviceWorker.register("sw.js").catch(() => {});
  });
}

startLevel(1);
refreshLeaderboard();
