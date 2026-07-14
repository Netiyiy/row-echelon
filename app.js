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
const SOUND_KEY = "rowEchelonSoundEnabled";
const SESSION_IDLE_MS = 30 * 60 * 1000;
const SESSION_HEARTBEAT_MS = 5 * 60 * 1000;
const SESSION_ACTIVITY_SAVE_MS = 10 * 1000;
const INTRO_SEEN_KEY = "rowEchelonIntroSeenV2";
const INTRO_MATRIX_STEPS = Object.freeze([
  {
    label: "GIVEN OUTPUTS",
    values: [[6, 7, 0, 5], [1, 0, 1, 5], [2, 0, 4, 16]],
  },
  {
    label: "R₁ ↔ R₂",
    values: [[1, 0, 1, 5], [6, 7, 0, 5], [2, 0, 4, 16]],
  },
  {
    label: "R₂ − 6R₁   ·   R₃ − 2R₁",
    values: [[1, 0, 1, 5], [0, 7, -6, -25], [0, 0, 2, 6]],
  },
  {
    label: "½R₃",
    values: [[1, 0, 1, 5], [0, 7, -6, -25], [0, 0, 1, 3]],
  },
  {
    label: "R₁ − R₃   ·   R₂ + 6R₃",
    values: [[1, 0, 0, 2], [0, 7, 0, -7], [0, 0, 1, 3]],
  },
  {
    label: "⅐R₂",
    values: [[1, 0, 0, 2], [0, 1, 0, -1], [0, 0, 1, 3]],
  },
]);
const SCORING = Object.freeze({
  A: 300,
  P: 1.22,
  B: 5,
  C: 0.75,
});
const SUPABASE_API_BASE_URL =
  "https://fkoupqflxcwyofsbgjgw.functions.supabase.co/row-echelon-api";
const SUSPEND_AUDIO_WHEN_HIDDEN = navigator.userAgentData?.mobile === true
  || /Android|iPhone|iPad|iPod|Mobile/i.test(navigator.userAgent || "")
  || (navigator.platform === "MacIntel" && navigator.maxTouchPoints > 1);

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
    this.introVolumeMultiplier = 10;
    this.duckedBackgroundVolume = 0.1;
    this.background = new Audio("assets/audio/row_echelon_music.mp3");
    this.background.loop = true;
    this.background.preload = "auto";
    this.background.volume = this.backgroundVolume;
    this.introFiles = {
      buttonUp: "assets/audio/intro/intro_button_up.wav",
      soft: "assets/audio/intro/intro_key_soft.wav",
      tick: "assets/audio/intro/intro_key_tick.wav",
    };
    this.introTemplates = Object.fromEntries(Object.entries(this.introFiles).map(([cue, source]) => {
      const player = new Audio(source);
      player.preload = "auto";
      return [cue, player];
    }));
    this.introPreloads = Object.values(this.introTemplates);
    this.introContext = null;
    this.introBuffers = new Map();
    this.introLoadPromise = null;
    this.introSources = new Set();
    this.effects = new Set();
    this.fadeFrame = null;
    this.restoreTimer = null;
    this.enabled = localStorage.getItem(SOUND_KEY) !== "false";
    this.userActivated = false;
    this.suspended = document.hidden;
    this.introMode = false;
  }

  startMusic() {
    if (this.introMode || !this.enabled || !this.userActivated || this.suspended || document.hidden) return;
    if (!this.background.paused) return;
    this.background.muted = false;
    this.background.play()
      .then(() => this.updateMediaSession("playing"))
      .catch(() => {});
  }

  resumeFromUserGesture() {
    if (document.hidden || !this.enabled) return;
    this.userActivated = true;
    this.suspended = false;
    this.prepareIntroAudio();
    if (this.introContext?.state === "suspended") {
      this.introContext.resume().catch(() => {});
    }
    this.startMusic();
  }

  play(effect) {
    this.startMusic();
    if (!this.enabled || this.suspended || document.hidden) return;
    const isCelebration = effect === "complete" || effect === "rank";
    const fileName = effect === "rank" ? "complete" : effect;
    const extension = isCelebration ? "mp3" : "wav";
    const player = new Audio(`assets/audio/ui_${fileName}.${extension}`);
    player.volume = effect === "complete" ? 0.68 : effect === "rank" ? 0.46 : 0.55;
    this.effects.add(player);
    const cleanup = () => {
      this.effects.delete(player);
      if (isCelebration) {
        this.fadeBackgroundTo(this.backgroundVolume, 800);
      }
    };
    player.addEventListener("ended", cleanup, { once: true });
    player.addEventListener("error", cleanup, { once: true });
    if (isCelebration) {
      this.duckMusic();
    }
    player.play().catch(cleanup);
  }

  prepareIntroAudio() {
    if (this.introLoadPromise || this.introBuffers.size === Object.keys(this.introFiles).length) {
      return this.introLoadPromise;
    }
    const AudioContext = window.AudioContext || window.webkitAudioContext;
    if (!AudioContext) return null;
    try {
      this.introContext ||= new AudioContext();
    } catch {
      return null;
    }
    this.introLoadPromise = Promise.all(Object.entries(this.introFiles).map(async ([cue, source]) => {
      const response = await fetch(source, { cache: "force-cache" });
      if (!response.ok) throw new Error(`Unable to load intro sound: ${source}`);
      const buffer = await this.introContext.decodeAudioData(await response.arrayBuffer());
      this.introBuffers.set(cue, buffer);
    })).catch(() => {}).finally(() => {
      this.introLoadPromise = null;
    });
    return this.introLoadPromise;
  }

  playIntro(cue) {
    if (!this.enabled || this.suspended || document.hidden) return;
    const buffer = this.introBuffers.get(cue);
    if (buffer && this.introContext) {
      const source = this.introContext.createBufferSource();
      const gain = this.introContext.createGain();
      source.buffer = buffer;
      gain.gain.value = this.backgroundVolume * this.introVolumeMultiplier;
      source.connect(gain).connect(this.introContext.destination);
      this.introSources.add(source);
      source.onended = () => this.introSources.delete(source);
      source.start();
      return;
    }
    const template = this.introTemplates[cue];
    if (!template) return;
    const player = template.cloneNode(true);
    player.volume = Math.min(1, this.backgroundVolume * this.introVolumeMultiplier);
    this.effects.add(player);
    const cleanup = () => this.effects.delete(player);
    player.addEventListener("ended", cleanup, { once: true });
    player.addEventListener("error", cleanup, { once: true });
    player.play().catch(cleanup);
  }

  enterIntro() {
    this.introMode = true;
    this.introPreloads.forEach((player) => player.load());
    this.prepareIntroAudio();
    window.clearTimeout(this.restoreTimer);
    this.restoreTimer = null;
    if (this.fadeFrame) {
      window.cancelAnimationFrame(this.fadeFrame);
      this.fadeFrame = null;
    }
    this.background.pause();
    this.background.muted = true;
    this.updateMediaSession("paused");
  }

  exitIntro() {
    this.introMode = false;
    this.stopIntroAudio();
    this.background.volume = this.backgroundVolume;
    this.background.muted = false;
    this.startMusic();
  }

  duckMusic() {
    window.clearTimeout(this.restoreTimer);
    this.fadeBackgroundTo(this.duckedBackgroundVolume, 350);
    this.restoreTimer = window.setTimeout(() => {
      this.fadeBackgroundTo(this.backgroundVolume, 800);
    }, 6200);
  }

  fadeBackgroundTo(targetVolume, duration) {
    if (this.suspended || !this.enabled || document.hidden) return;
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

  suspend() {
    this.suspended = true;
    window.clearTimeout(this.restoreTimer);
    this.restoreTimer = null;
    if (this.fadeFrame) {
      window.cancelAnimationFrame(this.fadeFrame);
      this.fadeFrame = null;
    }
    this.background.pause();
    this.background.muted = true;
    for (const player of this.effects) {
      player.pause();
      try {
        player.currentTime = 0;
      } catch {
        // Safari can reject a seek while media is still loading.
      }
    }
    this.effects.clear();
    this.stopIntroAudio();
    this.updateMediaSession("paused");
  }

  stopIntroAudio() {
    for (const source of this.introSources) {
      try {
        source.stop();
      } catch {
        // A source that already ended cannot be stopped again.
      }
    }
    this.introSources.clear();
    if (this.introContext?.state === "running") {
      this.introContext.suspend().catch(() => {});
    }
  }

  setEnabled(enabled) {
    this.enabled = Boolean(enabled);
    localStorage.setItem(SOUND_KEY, String(this.enabled));
    if (!this.enabled) {
      this.suspend();
      return;
    }
    this.resumeFromUserGesture();
  }

  updateMediaSession(playbackState) {
    if (!("mediaSession" in navigator)) return;
    try {
      navigator.mediaSession.playbackState = playbackState;
    } catch {
      // Older Safari versions expose Media Session without a writable state.
    }
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
  resultsStage: "score",
  accountMessage: "",
  celebrationToken: 0,
  settingsOpen: false,
  settingsMessage: "",
  endingSession: false,
  introVisible: false,
  introRunning: false,
  introToken: 0,
  sessionIdleTimer: null,
  lastActivityAt: 0,
  lastActivitySavedAt: 0,
  lastHeartbeatAt: 0,
  sessionHeartbeatPending: false,
  sessionExpiring: false,
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
  const now = Date.now();
  session.lastActiveAt = now;
  state.playerSession = session;
  state.lastActivityAt = now;
  state.lastActivitySavedAt = now;
  state.lastHeartbeatAt = now;
  state.sessionExpiring = false;
  localStorage.setItem(SESSION_KEY, JSON.stringify(session));
  scheduleSessionIdleTimeout();
}

function clearPlayerSession() {
  window.clearTimeout(state.sessionIdleTimer);
  state.sessionIdleTimer = null;
  state.playerSession = null;
  state.lastActivityAt = 0;
  state.lastActivitySavedAt = 0;
  state.lastHeartbeatAt = 0;
  state.sessionHeartbeatPending = false;
  state.sessionExpiring = false;
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

function persistSessionActivity(now = Date.now()) {
  if (!state.playerSession) return;
  state.playerSession.lastActiveAt = now;
  state.lastActivitySavedAt = now;
  localStorage.setItem(SESSION_KEY, JSON.stringify(state.playerSession));
}

function scheduleSessionIdleTimeout() {
  window.clearTimeout(state.sessionIdleTimer);
  state.sessionIdleTimer = null;
  if (!signedIn() || !state.lastActivityAt) return;
  const remaining = Math.max(0, SESSION_IDLE_MS - (Date.now() - state.lastActivityAt));
  state.sessionIdleTimer = window.setTimeout(checkSessionInactivity, remaining + 50);
}

function expirePlayerSession() {
  if (!signedIn() || state.sessionExpiring) return true;
  state.sessionExpiring = true;
  const token = state.playerSession.token;
  fetch(`${API_BASE_URL}/api/logout`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${token}`,
    },
    keepalive: true,
  }).catch(() => {});
  clearPlayerAndShowIntro("Session timed out after 30 minutes of inactivity. Your username is available again.");
  return true;
}

function checkSessionInactivity() {
  if (!signedIn()) return false;
  if (Date.now() - state.lastActivityAt >= SESSION_IDLE_MS) {
    return expirePlayerSession();
  }
  scheduleSessionIdleTimeout();
  return false;
}

async function keepSessionAlive() {
  if (!signedIn() || state.sessionHeartbeatPending || document.hidden) return;
  state.sessionHeartbeatPending = true;
  try {
    await apiRequest("/api/session", { method: "POST", auth: true });
    state.lastHeartbeatAt = Date.now();
  } catch (error) {
    if (isAuthError(error)) {
      clearPlayerAndShowIntro("Session timed out after 30 minutes of inactivity. Your username is available again.");
    }
  } finally {
    state.sessionHeartbeatPending = false;
  }
}

function recordPlayerActivity() {
  if (!signedIn() || state.sessionExpiring || document.hidden) return;
  const now = Date.now();
  state.lastActivityAt = now;
  if (now - state.lastActivitySavedAt >= SESSION_ACTIVITY_SAVE_MS) {
    persistSessionActivity(now);
  }
  scheduleSessionIdleTimeout();
  if (now - state.lastHeartbeatAt >= SESSION_HEARTBEAT_MS) {
    keepSessionAlive();
  }
}

function initializeSessionActivity() {
  if (!signedIn()) return;
  const storedActivity = Number(state.playerSession.lastActiveAt);
  const now = Date.now();
  state.lastActivityAt = Number.isFinite(storedActivity) && storedActivity > 0
    ? storedActivity
    : now;
  state.lastActivitySavedAt = state.lastActivityAt;
  state.lastHeartbeatAt = now;
  if (!checkSessionInactivity()) scheduleSessionIdleTimeout();
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

function currentElapsedSeconds() {
  if (!state.levelStartedAt) return state.elapsedSeconds;
  return Math.max(0, state.elapsedSeconds + ((performance.now() - state.levelStartedAt) / 1000));
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

function runLevelTimer() {
  clearLevelTimer();
  state.levelStartedAt = performance.now();
  updateTimerLabel(state.elapsedSeconds);
  state.timerId = window.setInterval(() => {
    if (state.isSolved) return;
    updateTimerLabel(currentElapsedSeconds());
  }, 250);
}

function startLevelTimer() {
  state.elapsedSeconds = 0;
  runLevelTimer();
}

function pauseLevelTimer() {
  if (!state.levelStartedAt) return;
  state.elapsedSeconds = currentElapsedSeconds();
  clearLevelTimer();
  updateTimerLabel(state.elapsedSeconds);
}

function resumeLevelTimer() {
  if (
    document.hidden
    || state.levelStartedAt
    || state.isSolved
    || state.leaderboardVisible
    || state.introVisible
    || !signedIn()
  ) return;
  runLevelTimer();
}

function stopLevelTimer() {
  if (state.levelStartedAt) {
    state.elapsedSeconds = Math.max(1, Math.ceil(currentElapsedSeconds()));
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
  const settingsButton = $("#settings-button");
  settingsButton.classList.toggle("active", state.settingsOpen);
  settingsButton.setAttribute("aria-expanded", String(state.settingsOpen));
  $("#settings-menu").hidden = !state.settingsOpen;
  const soundButton = $("#sound-button");
  soundButton.textContent = audio.enabled ? "SOUND ON" : "SOUND OFF";
  soundButton.setAttribute("aria-pressed", String(audio.enabled));
  const logoutButton = $("#logout-button");
  logoutButton.disabled = !signedIn() || state.endingSession;
  logoutButton.textContent = state.endingSession ? "ENDING..." : "END SESSION";
  $("#settings-message").textContent = state.settingsMessage;
}

function renderResultsStage() {
  const screen = $("#results-screen");
  const isLeaderboardStage = state.resultsStage === "leaderboard";
  $("#score-view").hidden = !state.leaderboardVisible || isLeaderboardStage;
  $("#leaderboard-view").hidden = !state.leaderboardVisible || !isLeaderboardStage;
  $("#next-level-button").textContent = isLeaderboardStage ? "NEXT LEVEL" : "NEXT";
  screen.classList.toggle("score-stage", state.leaderboardVisible && !isLeaderboardStage);
  screen.classList.toggle("leaderboard-stage", state.leaderboardVisible && isLeaderboardStage);
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

function movedHigherInRank(previousRank, currentRank) {
  const previous = Number(previousRank);
  const current = Number(currentRank);
  return Number.isInteger(previous)
    && Number.isInteger(current)
    && previous > 0
    && current > 0
    && current < previous;
}

function renderLeaderboard() {
  const screen = $("#results-screen");
  screen.hidden = !state.leaderboardVisible;
  if (!state.leaderboardVisible) {
    screen.classList.remove("visible", "exiting", "score-stage", "leaderboard-stage");
  }
  $(".game-shell").classList.toggle("leaderboard-visible", state.leaderboardVisible);
  renderResultsStage();

  const leaderboardDate = $("#leaderboard-date");
  if (leaderboardDate) {
    leaderboardDate.textContent = state.leaderboardDate
      ? `TODAY ${state.leaderboardDate}`
      : "TODAY";
  }
  const leaderboardMessage = $("#leaderboard-message");
  if (leaderboardMessage) {
    leaderboardMessage.textContent = state.leaderboardMessage;
  }

  const rows = leaderboardRows();
  const list = $("#leaderboard-list");
  if (!signedIn()) {
    list.replaceChildren();
    if (leaderboardMessage) {
      leaderboardMessage.textContent = "Create a player to compete.";
    }
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
      row.dataset.playerId = entry.playerId || "";
      row.dataset.finalRank = String(entry.rank);
      row.dataset.score = String(entry.totalScore ?? 0);
      if (entry.isCurrentPlayer) row.setAttribute("aria-current", "true");

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
    renderLeaderboard();
  }
}

function renderRankSummary(result = {}) {
  const breakdown = result.scoreBreakdown || state.resultScoreBreakdown;
  const totalScore = result.totalScore ?? state.playerEntry?.totalScore ?? breakdown?.score ?? 0;
  const summary = $("#rank-summary");
  if (!summary) return;

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
  $("#result-message").textContent = "";
  $("#result-message").classList.remove("revealed");

  renderRankSummary(result);
  renderLeaderboard();
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
  const [reward, stepPenalty, timePenalty] = items;

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

  await wait(180);
  if (token !== state.resultAnimationToken) return;
  await animateNumber($("#result-score"), breakdown.score, { duration: 900, token });
  const message = $("#result-message");
  message.textContent = "Good job!";
  message.classList.add("revealed");
}

async function animateLeaderboardRows(token) {
  const rows = $$("#results-screen .leaderboard-row, #results-screen .leaderboard-empty, #results-screen .leaderboard-gap");
  await wait(90);
  for (const row of rows) {
    if (token !== state.resultAnimationToken) return;
    row.classList.add("revealed");
    await wait(130);
  }
  await wait(440);
  if (token !== state.resultAnimationToken) return;
  rows.forEach((row) => row.classList.add("settled"));
}

function regularLeaderboardRows() {
  return $$("#leaderboard-list .leaderboard-row");
}

function rankLabel(row) {
  return row.querySelector(".leaderboard-rank");
}

function setDisplayedRank(row, rank) {
  const label = rankLabel(row);
  if (label) label.textContent = Number.isInteger(rank) ? `#${rank}` : "NEW";
}

function prepareLeaderboardScoreClimb(result) {
  const list = $("#leaderboard-list");
  const currentRow = list?.querySelector(".leaderboard-row.current-player");
  if (!list || !currentRow || result.offline) return null;

  const finalRank = Number(result.rank ?? currentRow.dataset.finalRank);
  const previousRankValue = Number(result.previousRank);
  const previousRank = Number.isInteger(previousRankValue) && previousRankValue > 0
    ? previousRankValue
    : null;
  const previousScore = Math.max(0, Number(result.previousScore) || 0);
  const finalScore = Math.max(previousScore, Number(result.totalScore) || previousScore);
  const shouldClimb = previousRank === null || previousRank > finalRank;

  if (shouldClimb) {
    const otherRows = regularLeaderboardRows().filter((row) => row !== currentRow);
    currentRow.remove();
    const insertionTarget = previousRank === null
      ? null
      : otherRows.find((row) => Number(row.dataset.finalRank) > previousRank) || null;
    list.insertBefore(currentRow, insertionTarget);

    for (const row of otherRows) {
      const rowFinalRank = Number(row.dataset.finalRank);
      const wasBelowFinalPosition = rowFinalRank > finalRank
        && (previousRank === null || rowFinalRank <= previousRank);
      setDisplayedRank(row, wasBelowFinalPosition ? rowFinalRank - 1 : rowFinalRank);
    }
    setDisplayedRank(currentRow, previousRank);
  }

  const score = currentRow.querySelector(".leaderboard-score");
  if (score) score.textContent = `${Math.round(previousScore)} pts`;
  currentRow.classList.add("score-climbing");

  return {
    list,
    currentRow,
    score,
    previousRank,
    finalRank,
    previousScore,
    finalScore,
  };
}

function animateLeaderboardScoreValue(element, from, to, duration, token) {
  return new Promise((resolve) => {
    if (!element || to <= from || duration <= 0) {
      if (element) element.textContent = `${Math.round(to)} pts`;
      resolve(to);
      return;
    }

    const startedAt = performance.now();
    const tick = (now) => {
      if (token !== state.resultAnimationToken) {
        resolve(from);
        return;
      }
      const progress = Math.min(1, (now - startedAt) / duration);
      const eased = progress * progress * (3 - (2 * progress));
      const value = Math.round(from + ((to - from) * eased));
      element.textContent = `${value} pts`;
      if (progress < 1) {
        window.requestAnimationFrame(tick);
      } else {
        resolve(to);
      }
    };
    window.requestAnimationFrame(tick);
  });
}

async function moveLeaderboardRowAbove(setup, upperRow, token) {
  const rows = regularLeaderboardRows();
  const before = new Map(rows.map((row) => [row, row.getBoundingClientRect().top]));
  const upperRank = Number(rankLabel(upperRow)?.textContent.replace("#", ""));

  setup.list.insertBefore(setup.currentRow, upperRow);
  if (Number.isInteger(upperRank)) {
    setDisplayedRank(setup.currentRow, upperRank);
    setDisplayedRank(upperRow, upperRank + 1);
  }

  const reducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  for (const row of rows) {
    const distance = before.get(row) - row.getBoundingClientRect().top;
    if (!distance) continue;
    row.style.transition = "none";
    row.style.transform = `translateY(${distance}px)`;
  }
  setup.currentRow.getBoundingClientRect();
  for (const row of rows) {
    if (!row.style.transform) continue;
    row.style.transition = reducedMotion
      ? "none"
      : "transform 340ms cubic-bezier(0.16, 0.9, 0.18, 1)";
    row.style.transform = "translateY(0)";
  }
  setup.currentRow.classList.add("rank-passing");
  upperRow.classList.add("rank-passed");

  if (!reducedMotion) await wait(360);
  if (token !== state.resultAnimationToken) return;
  for (const row of rows) {
    row.style.removeProperty("transition");
    row.style.removeProperty("transform");
    row.classList.remove("rank-passing", "rank-passed");
  }
}

async function animateLeaderboardScoreClimb(result, token, preparedSetup = null) {
  const setup = preparedSetup || prepareLeaderboardScoreClimb(result);
  if (!setup) return false;

  const reducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  const totalGain = Math.max(1, setup.finalScore - setup.previousScore);
  let displayedScore = setup.previousScore;
  let movedRows = 0;
  const targetIndex = Math.min(
    Math.max(0, setup.finalRank - 1),
    regularLeaderboardRows().length - 1,
  );

  while (regularLeaderboardRows().indexOf(setup.currentRow) > targetIndex) {
    if (token !== state.resultAnimationToken) return false;
    const rows = regularLeaderboardRows();
    const currentIndex = rows.indexOf(setup.currentRow);
    const upperRow = rows[currentIndex - 1];
    if (!upperRow) break;

    const passingScore = Number(upperRow.dataset.score) + 1;
    if (!Number.isFinite(passingScore) || passingScore > setup.finalScore) break;
    const nextScore = Math.max(displayedScore, passingScore);
    const duration = reducedMotion
      ? 0
      : Math.max(180, Math.round(1700 * ((nextScore - displayedScore) / totalGain)));
    displayedScore = await animateLeaderboardScoreValue(
      setup.score,
      displayedScore,
      nextScore,
      duration,
      token,
    );
    if (token !== state.resultAnimationToken) return false;
    await moveLeaderboardRowAbove(setup, upperRow, token);
    movedRows += 1;
  }

  if (token !== state.resultAnimationToken) return false;
  const remainingDuration = reducedMotion
    ? 0
    : Math.max(260, Math.round(1700 * ((setup.finalScore - displayedScore) / totalGain)));
  await animateLeaderboardScoreValue(
    setup.score,
    displayedScore,
    setup.finalScore,
    remainingDuration,
    token,
  );
  if (token !== state.resultAnimationToken) return false;

  setup.currentRow.classList.remove("score-climbing");
  const reachedFinalPosition = regularLeaderboardRows().indexOf(setup.currentRow) === targetIndex;
  if (reachedFinalPosition) {
    for (const row of regularLeaderboardRows()) {
      setDisplayedRank(row, Number(row.dataset.finalRank));
    }
  }
  setup.currentRow.setAttribute(
    "aria-label",
    `Score increased from ${Math.round(setup.previousScore)} to ${Math.round(setup.finalScore)} points`,
  );

  return movedHigherInRank(setup.previousRank, setup.finalRank)
    && (movedRows > 0 || reachedFinalPosition);
}

async function showResults(result, celebrationToken) {
  state.leaderboardVisible = true;
  state.resultsStage = "score";
  state.resultAnimationToken += 1;
  const animationToken = state.resultAnimationToken;
  prepareResultCard(result);

  const screen = $("#results-screen");
  screen.hidden = false;
  screen.classList.remove("exiting");
  window.requestAnimationFrame(() => {
    screen.classList.add("visible");
  });

  await animateResults(result, animationToken);
  if (celebrationToken !== state.celebrationToken) return;
}

async function showLeaderboardStage() {
  if (!state.leaderboardVisible) return;
  state.resultsStage = "leaderboard";
  const token = ++state.resultAnimationToken;
  const result = state.lastLeaderboardResult || {};
  renderLeaderboard();
  const scoreClimb = prepareLeaderboardScoreClimb(result);
  await animateLeaderboardRows(token);
  if (token !== state.resultAnimationToken) return;
  const rankImproved = await animateLeaderboardScoreClimb(result, token, scoreClimb);
  if (token !== state.resultAnimationToken) return;
  if (rankImproved) audio.play("rank");
  launchLeaderboardConfetti(rankImproved);
}

async function goToNextLevel() {
  if (!state.leaderboardVisible) return;
  if (state.resultsStage !== "leaderboard") {
    await showLeaderboardStage();
    return;
  }
  const token = ++state.resultAnimationToken;
  const screen = $("#results-screen");
  screen.classList.add("exiting");
  screen.classList.remove("visible");
  $(".game-shell").classList.add("results-next");

  await wait(460);
  if (token !== state.resultAnimationToken) return;

  state.leaderboardVisible = false;
  state.resultsStage = "score";
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
      clearPlayerAndShowIntro("Session expired. Choose a name to play.");
      return;
    }
    state.leaderboardMessage = `Leaderboard offline: ${error.message}`;
    renderLeaderboard();
  }
}

function clearPlayerAndLock(message) {
  clearLevelTimer();
  audio.suspend();
  clearPlayerSession();
  state.settingsOpen = false;
  state.settingsMessage = "";
  state.endingSession = false;
  state.leaderboard = [];
  state.playerEntry = null;
  state.leaderboardDate = "";
  state.leaderboardMessage = "";
  state.leaderboardVisible = false;
  state.resultsStage = "score";
  state.accountMessage = message;
  state.resultAnimationToken += 1;
  state.celebrationToken += 1;
  render();
}

function clearPlayerAndShowIntro(message) {
  clearPlayerAndLock(message);
  startLevel(1);
  showIntro();
}

function launchLeaderboardConfetti(rankImproved) {
  const layer = $("#leaderboard-confetti");
  if (!layer) return;
  layer.replaceChildren();
  if (!rankImproved || window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
  for (let index = 0; index < 36; index += 1) {
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
    const knownPreviousRank = data.previousRank ?? previousRank;
    const rankImproved = movedHigherInRank(knownPreviousRank, currentRank);
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
      clearPlayerAndShowIntro("Session expired. Choose a name to play.");
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

function restartAnimationClass(element, className, removeAfter = 700) {
  if (!element) return;
  element.classList.remove(className);
  void element.offsetWidth;
  element.classList.add(className);
  window.setTimeout(() => element.classList.remove(className), removeAfter);
}

function animateLevelEntry(kind = "level") {
  if (introReducedMotion()) return;
  const playView = $("#play-view");
  playView.dataset.entryKind = kind;
  restartAnimationClass(playView, "gameplay-entering", 920);
}

function animateChangedCells(previousMatrix) {
  if (introReducedMotion()) return;
  $$(".matrix-row").forEach((rowElement, rowIndex) => {
    [...rowElement.querySelectorAll(".matrix-value")].forEach((cell, columnIndex) => {
      const before = previousMatrix[rowIndex]?.[columnIndex]?.toString();
      const after = state.matrix[rowIndex]?.[columnIndex]?.toString();
      if (before === after) return;
      cell.animate(
        [
          { opacity: 0, filter: "blur(7px)", transform: "translateY(15px) rotateX(-68deg) scale(0.72)" },
          { opacity: 1, filter: "blur(0)", offset: 0.7, transform: "translateY(-3px) rotateX(9deg) scale(1.15)" },
          { opacity: 1, filter: "blur(0)", transform: "translateY(0) rotateX(0) scale(1)" },
        ],
        {
          duration: 410,
          delay: rowIndex * 34 + columnIndex * 42,
          easing: "cubic-bezier(0.12, 1.18, 0.24, 1)",
        },
      );
    });
  });
}

function addRowTransferTracer(sourceRow, targetRow) {
  const stage = $("#matrix-stage");
  if (!stage || !sourceRow || !targetRow || introReducedMotion()) return;
  const stageRect = stage.getBoundingClientRect();
  const sourceRect = sourceRow.getBoundingClientRect();
  const targetRect = targetRow.getBoundingClientRect();
  const tracer = document.createElement("span");
  tracer.className = "row-transfer-tracer";
  tracer.style.left = `${stageRect.width - 24}px`;
  tracer.style.top = "0";
  stage.append(tracer);
  const fromY = sourceRect.top + sourceRect.height / 2 - stageRect.top;
  const toY = targetRect.top + targetRect.height / 2 - stageRect.top;
  tracer.animate(
    [
      { opacity: 0, transform: `translateY(${fromY}px) scale(0.3)` },
      { opacity: 1, offset: 0.18, transform: `translateY(${fromY}px) scale(1.35)` },
      { opacity: 1, offset: 0.74, transform: `translateY(${toY}px) scale(0.9)` },
      { opacity: 0, transform: `translateY(${toY}px) scale(2.2)` },
    ],
    {
      duration: 440,
      easing: "cubic-bezier(0.72, 0, 0.2, 1)",
      fill: "both",
    },
  ).finished.catch(() => {}).finally(() => tracer.remove());
}

function animateGameplayChange({ kind, source = null, target = null, previousMatrix }) {
  if (introReducedMotion()) return;
  const stage = $("#matrix-stage");
  restartAnimationClass(stage, "operation-impact", 620);
  restartAnimationClass($("#current-score"), "hud-bump", 440);
  animateChangedCells(previousMatrix);

  const sourceRow = source === null ? null : $(`.matrix-row[data-row="${source}"]`);
  const targetRow = target === null ? null : $(`.matrix-row[data-row="${target}"]`);

  if (kind === "swap" && sourceRow && targetRow) {
    const distance = targetRow.offsetTop - sourceRow.offsetTop;
    sourceRow.animate(
      [
        { zIndex: 3, filter: "brightness(1.35)", transform: `translateY(${distance}px) scale(1.035)` },
        { zIndex: 3, offset: 0.72, transform: "translateY(-5px) scale(1.02)" },
        { zIndex: 1, filter: "brightness(1)", transform: "translateY(0) scale(1)" },
      ],
      { duration: 560, easing: "cubic-bezier(0.12, 1.08, 0.24, 1)" },
    );
    targetRow.animate(
      [
        { zIndex: 2, filter: "brightness(1.2)", transform: `translateY(${-distance}px) scale(0.98)` },
        { zIndex: 2, offset: 0.72, transform: "translateY(5px) scale(1.02)" },
        { zIndex: 1, filter: "brightness(1)", transform: "translateY(0) scale(1)" },
      ],
      { duration: 560, easing: "cubic-bezier(0.12, 1.08, 0.24, 1)" },
    );
    restartAnimationClass(stage, "swap-impact", 620);
    return;
  }

  if (kind === "add" && sourceRow && targetRow) {
    sourceRow.classList.add("operation-source");
    targetRow.classList.add("operation-target");
    addRowTransferTracer(sourceRow, targetRow);
    window.setTimeout(() => {
      sourceRow.classList.remove("operation-source");
      targetRow.classList.remove("operation-target");
    }, 620);
    return;
  }

  if (kind === "scale" && targetRow) {
    restartAnimationClass(targetRow, "operation-scale", 620);
  }
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
  resetSolutionReveal();
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
  state.resultsStage = "score";
  $(".game-shell").classList.remove("leaderboard-visible", "results-next");
  $("#sparkle-layer").replaceChildren();
  render();
  animateLevelEntry("level");
  if (signedIn()) {
    startLevelTimer();
  }
}

function applyChange(change, animation = {}) {
  const previousMatrix = cloneMatrix(state.matrix);
  state.history.push(previousMatrix);
  change();
  state.steps += 1;
  state.selectedRow = null;
  state.isSolved = isGameSolved(state.matrix);
  render();
  animateGameplayChange({ ...animation, previousMatrix });
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
    }, { kind: "scale", target: row });
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
  }, { kind: state.mode, source, target: row });
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
  state.resultsStage = "score";
  render();
  animateLevelEntry("reset");
  restartAnimationClass($("#matrix-stage"), "reset-impact", 720);
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
  await wait(620);
  if (token !== state.celebrationToken) return;
  launchGameplayConfetti(token);
  await wait(420);
  await animateSolutionReveal(token);

  if (token !== state.celebrationToken) return;
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

function resetSolutionReveal() {
  const stage = $("#matrix-stage");
  stage?.classList.remove(
    "solution-revealing",
    "direct-solution-final",
    "direct-variables-locked",
  );
  if (stage) {
    stage.style.width = "";
    stage.style.minHeight = "";
  }
  const matrix = $("#matrix");
  matrix?.classList.remove("direct-solution-transforming", "direct-solution-compacted");
  if (matrix) {
    matrix.style.width = "";
    matrix.style.marginInline = "";
  }
  $$(".direct-solution-flyer, .direct-solution-equals, .direct-landing-ring")
    .forEach((element) => element.remove());
  $$(".direct-variable-cell, .direct-zero-cell, .direct-value-cell").forEach((cell) => {
    cell.classList.remove("direct-variable-cell", "direct-zero-cell", "direct-value-cell");
  });
}

async function dropDirectSolutionVariable(target, index, stageRect, token) {
  const targetRect = target.getBoundingClientRect();
  const flyerWidth = Math.min(64, Math.max(46, targetRect.width * 0.48));
  const flyerHeight = 42;
  const targetCenterX = targetRect.left + targetRect.width / 2;
  const targetCenterY = targetRect.top + targetRect.height / 2;
  const startTop = stageRect.top - 58;
  const flyer = document.createElement("span");
  flyer.className = "direct-solution-flyer";
  flyer.textContent = `x${index + 1}`;
  flyer.style.left = `${targetCenterX - flyerWidth / 2}px`;
  flyer.style.top = `${startTop}px`;
  flyer.style.width = `${flyerWidth}px`;
  flyer.style.height = `${flyerHeight}px`;
  document.body.append(flyer);

  const delay = index * 155;
  const distance = targetCenterY - (startTop + flyerHeight / 2);
  const oneFade = target.animate(
    [
      { opacity: 1, transform: "translateY(0) scale(1)" },
      { opacity: 0, transform: "translateY(12px) scale(0.4)" },
    ],
    { duration: 180, delay: delay + 360, fill: "forwards", easing: "cubic-bezier(0.7, 0, 0.84, 0)" },
  );
  const drop = flyer.animate(
    [
      { opacity: 0, filter: "blur(3px)", transform: "translateY(-20px) scale(0.76)" },
      { opacity: 1, offset: 0.16, filter: "blur(0)", transform: "translateY(0) scale(1)" },
      { opacity: 1, offset: 0.72, transform: `translateY(${distance - 15}px) scale(1.08)` },
      { opacity: 1, offset: 0.9, transform: `translateY(${distance + 4}px) scale(0.96)` },
      { opacity: 1, transform: `translateY(${distance}px) scale(1)` },
    ],
    {
      duration: 650,
      delay,
      fill: "both",
      easing: "cubic-bezier(0.68, 0, 0.18, 1.18)",
    },
  );
  await drop.finished.catch(() => {});
  oneFade.cancel();
  if (token === state.celebrationToken) {
    target.textContent = `x${index + 1}`;
    target.classList.add("direct-variable-cell");
    const ring = document.createElement("span");
    ring.className = "direct-landing-ring";
    ring.style.left = `${targetCenterX}px`;
    ring.style.top = `${targetCenterY}px`;
    document.body.append(ring);
    window.setTimeout(() => ring.remove(), 620);
  }
  flyer.remove();
}

function prepareDirectSolutionRows() {
  const rows = $$("#matrix .matrix-row");
  const diagonalCells = [];
  const zeroCells = [];
  rows.forEach((row, rowIndex) => {
    const cells = [...row.querySelectorAll(".matrix-value")];
    cells.forEach((cell, columnIndex) => {
      if (columnIndex === rowIndex) {
        diagonalCells.push(cell);
        cell.classList.add("direct-variable-cell");
      } else if (columnIndex === cells.length - 1) {
        cell.classList.add("direct-value-cell");
      } else {
        zeroCells.push({ cell, rowIndex });
        cell.classList.add("direct-zero-cell");
      }
    });
    const equals = document.createElement("span");
    equals.className = "direct-solution-equals";
    equals.textContent = "=";
    row.append(equals);
  });
  return { rows, diagonalCells, zeroCells };
}

function compactDirectSolutionStage(stage, sourceMatrix) {
  const stageRect = stage.getBoundingClientRect();
  const matrixRect = sourceMatrix.getBoundingClientRect();
  const desktop = window.innerWidth >= 800;
  const compactStageWidth = Math.min(stageRect.width, desktop ? 420 : 360);
  const compactStageHeight = desktop ? 252 : 220;
  const compactMatrixWidth = Math.min(
    desktop ? 330 : 328,
    compactStageWidth - (desktop ? 52 : 32),
  );

  stage.style.width = `${stageRect.width}px`;
  stage.style.minHeight = `${stageRect.height}px`;
  sourceMatrix.style.width = `${matrixRect.width}px`;
  sourceMatrix.style.marginInline = "auto";
  void stage.offsetWidth;

  sourceMatrix.classList.add("direct-solution-compacted");
  stage.classList.add("direct-solution-final");
  stage.style.width = `${compactStageWidth}px`;
  stage.style.minHeight = `${compactStageHeight}px`;
  sourceMatrix.style.width = `${compactMatrixWidth}px`;
}

async function animateSolutionReveal(token) {
  if (token !== state.celebrationToken) return;
  resetSolutionReveal();
  const stage = $("#matrix-stage");
  const sourceMatrix = $("#matrix");
  const rows = $$("#matrix .matrix-row");
  const diagonalCells = rows.map((row, rowIndex) =>
    row.querySelectorAll(".matrix-value")[rowIndex]);
  stage.classList.add("solution-revealing");

  if (introReducedMotion()) {
    diagonalCells.forEach((cell, index) => { cell.textContent = `x${index + 1}`; });
    prepareDirectSolutionRows();
    compactDirectSolutionStage(stage, sourceMatrix);
    await wait(80);
    return;
  }

  await Promise.all(diagonalCells.map((cell, index) =>
    dropDirectSolutionVariable(cell, index, stage.getBoundingClientRect(), token)));
  if (token !== state.celebrationToken) return;
  restartAnimationClass(stage, "direct-variables-locked", 760);
  await wait(540);
  if (token !== state.celebrationToken) return;

  const parts = prepareDirectSolutionRows();
  sourceMatrix.classList.add("direct-solution-transforming");
  const zeroAnimations = parts.zeroCells.map(({ cell, rowIndex }, index) => {
    const cellRect = cell.getBoundingClientRect();
    const variableRect = parts.diagonalCells[rowIndex].getBoundingClientRect();
    const collapseX = (variableRect.left + variableRect.width / 2)
      - (cellRect.left + cellRect.width / 2);
    return cell.animate(
      [
        { opacity: 1, filter: "blur(0)", transform: "translateX(0) scale(1)" },
        {
          opacity: 0,
          filter: "blur(5px)",
          transform: `translateX(${collapseX * 0.72}px) scale(0.12)`,
        },
      ],
      {
        duration: 430,
        delay: index * 28,
        fill: "forwards",
        easing: "cubic-bezier(0.7, 0, 0.84, 0)",
      },
    );
  });
  await Promise.all(zeroAnimations.map((animation) => animation.finished.catch(() => {})));
  if (token !== state.celebrationToken) return;

  zeroAnimations.forEach((animation) => animation.cancel());
  compactDirectSolutionStage(stage, sourceMatrix);
  await wait(1800);
}

function launchGameplayConfetti(token) {
  const layer = $("#sparkle-layer");
  layer.replaceChildren();
  if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;

  for (let index = 0; index < 52; index += 1) {
    const piece = document.createElement("span");
    piece.className = "gameplay-confetti-piece";
    const angle = Math.random() * Math.PI * 2;
    const distance = randomInt(105, 245);
    piece.style.setProperty("--game-confetti-x", `${Math.cos(angle) * distance}px`);
    piece.style.setProperty("--game-confetti-y", `${Math.sin(angle) * distance + randomInt(18, 70)}px`);
    piece.style.setProperty("--game-confetti-rotate", `${randomInt(-500, 500)}deg`);
    piece.style.setProperty("--game-confetti-delay", `${Math.random() * 220}ms`);
    piece.style.setProperty("--game-confetti-width", `${randomInt(5, 9)}px`);
    piece.style.setProperty("--game-confetti-height", `${randomInt(8, 15)}px`);
    piece.style.setProperty(
      "--game-confetti-color",
      index % 3 === 0 ? "var(--cream)" : index % 2 === 0 ? "var(--success)" : "var(--accent)",
    );
    layer.append(piece);
  }

  window.setTimeout(() => {
    if (token === state.celebrationToken) layer.replaceChildren();
  }, 2200);
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
  restartAnimationClass(input, "factor-accepted", 420);
  return true;
}

async function logoutPlayer() {
  if (!signedIn() || state.endingSession) return;
  audio.play("tap");
  state.endingSession = true;
  state.settingsMessage = "Ending session...";
  renderSettings();
  try {
    await apiRequest("/api/logout", { method: "POST", auth: true });
  } catch (error) {
    if (isAuthError(error)) {
      clearPlayerAndShowIntro("Session ended. Choose a name to play.");
      return;
    }
    state.endingSession = false;
    state.settingsMessage = `Could not end session: ${error.message}`;
    renderSettings();
    return;
  }
  state.endingSession = false;
  clearPlayerAndShowIntro("Session ended. Your username is available again.");
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
  state.accountMessage = "Opening player...";
  renderAccount();
  try {
    const session = await apiRequest("/api/accounts", {
      method: "POST",
      body: { name },
    });
    savePlayerSession(session);
    state.accountMessage = "";
    state.leaderboardMessage = session.resumed
      ? `Welcome back, ${session.player.name}. Your previous points are restored.`
      : "Account ready. Solve levels to climb.";
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

function introReducedMotion() {
  return window.matchMedia("(prefers-reduced-motion: reduce)").matches;
}

function resetIntroDom() {
  const screen = $("#intro-screen");
  screen.classList.remove(
    "intro-running",
    "intro-expanded",
    "matrix-forming",
    "matrix-ready",
    "matrix-impact",
    "rref-complete",
    "intro-finishing",
  );
  $("#intro-equations-expanded").setAttribute("aria-hidden", "true");
  $("#intro-matrix").setAttribute("aria-hidden", "true");
  $("#intro-operation").textContent = "";
  $("#intro-operation").classList.remove("visible");
  $$(".intro-coefficient, .intro-variable, .intro-rhs-source").forEach((token) => {
    token.style.opacity = "";
  });
  $$(".intro-matrix-cell").forEach((cell) => {
    const [, column] = cell.dataset.introCell.split("-").map(Number);
    cell.textContent = column === 3 ? "?" : "";
    cell.classList.remove("landed", "value-visible", "changing");
  });
  $$(".intro-title-letter").forEach((letter) => {
    letter.classList.remove("landed", "solution-landed");
    letter.removeAttribute("data-solution-value");
  });
  $$(".intro-flyer").forEach((flyer) => flyer.remove());
}

function introDelay(duration, token) {
  const adjustedDuration = introReducedMotion() ? Math.min(24, duration) : duration;
  return wait(adjustedDuration).then(() => token === state.introToken);
}

function cueIntroAnimationAt(element, animationName, progress, cue, token = state.introToken) {
  if (!element) return;
  if (introReducedMotion()) {
    audio.playIntro(cue);
    return;
  }
  let missingFrames = 0;
  const checkAnimation = () => {
    if (token !== state.introToken || !state.introVisible) return;
    const animation = element.getAnimations().find((candidate) => candidate.animationName === animationName);
    if (!animation) {
      missingFrames += 1;
      if (missingFrames < 6) window.requestAnimationFrame(checkAnimation);
      return;
    }
    const timing = animation.effect.getTiming();
    const targetTime = Number(timing.delay || 0) + Number(timing.duration) * progress;
    if (Number(animation.currentTime) >= targetTime) {
      audio.playIntro(cue);
      return;
    }
    window.requestAnimationFrame(checkAnimation);
  };
  window.requestAnimationFrame(checkAnimation);
}

async function flyIntroToken(source, target, {
  kind = "number",
  duration = 480,
  delay = 0,
  arc = -30,
} = {}) {
  if (!source || !target) return;
  if (introReducedMotion()) return;

  const sourceRect = source.getBoundingClientRect();
  const targetRect = target.getBoundingClientRect();
  const flyer = document.createElement("span");
  flyer.className = `intro-flyer ${kind}`;
  flyer.textContent = source.textContent;
  flyer.style.left = `${sourceRect.left}px`;
  flyer.style.top = `${sourceRect.top}px`;
  flyer.style.width = `${sourceRect.width}px`;
  flyer.style.height = `${sourceRect.height}px`;
  document.body.append(flyer);

  const deltaX = targetRect.left + targetRect.width / 2 - (sourceRect.left + sourceRect.width / 2);
  const deltaY = targetRect.top + targetRect.height / 2 - (sourceRect.top + sourceRect.height / 2);
  const animation = flyer.animate(
    [
      { opacity: 0, transform: "translate(0, 0) scale(0.72)" },
      { opacity: 1, offset: 0.1, transform: "translate(0, 0) scale(1)" },
      {
        opacity: 1,
        offset: 0.28,
        transform: `translate(${deltaX * -0.035}px, ${deltaY * -0.035}px) scale(1.12)`,
      },
      {
        opacity: 1,
        offset: 0.76,
        transform: `translate(${deltaX * 0.78}px, ${deltaY * 0.78 + arc}px) scale(1.04)`,
      },
      { opacity: 0, transform: `translate(${deltaX}px, ${deltaY}px) scale(0.62)` },
    ],
    {
      duration,
      delay,
      easing: "cubic-bezier(0.76, 0, 0.18, 1)",
      fill: "both",
    },
  );
  await animation.finished.catch(() => {});
  flyer.remove();
}

async function formIntroMatrix(token) {
  const screen = $("#intro-screen");
  screen.classList.add("matrix-forming");
  cueIntroAnimationAt(
    $(".intro-bracket.left"),
    "intro-bracket-enter-left",
    0.54,
    "buttonUp",
    token,
  );
  $("#intro-matrix").setAttribute("aria-hidden", "false");
  await introDelay(60, token);
  if (token !== state.introToken) return false;

  const flights = [];
  $$(".intro-coefficient").forEach((source, index) => {
    const target = $(`[data-intro-cell="${source.dataset.introRow}-${source.dataset.introCol}"]`);
    target.textContent = source.textContent;
    flights.push(flyIntroToken(source, target, {
      delay: index * 14,
      duration: 405 + (index % 3) * 32,
      arc: 28 + (index % 3) * 8,
    }));
    source.style.opacity = "0";
  });

  $$(".intro-variable").forEach((source, index) => {
    const target = $(`[data-intro-target-var="${source.dataset.introVar}"]`);
    flights.push(flyIntroToken(source, target, {
      kind: "variable",
      delay: 20 + index * 12,
      duration: 430,
      arc: -66 - (index % 3) * 10,
    }));
    source.style.opacity = "0";
  });

  $$(".intro-rhs-source").forEach((source, row) => {
    const target = $(`[data-intro-cell="${row}-3"]`);
    target.textContent = source.textContent;
    flights.push(flyIntroToken(source, target, {
      delay: 70 + row * 34,
      duration: 440,
      arc: 38,
    }));
    source.style.opacity = "0";
  });

  await Promise.all(flights);
  if (token !== state.introToken) return false;
  screen.classList.add("matrix-ready");
  $$(".intro-matrix-cell").forEach((cell) => cell.classList.add("landed"));
  $$(".intro-title-letter").forEach((letter) => letter.classList.add("landed"));
  audio.playIntro("buttonUp");
  return true;
}

async function animateIntroMatrixStep(step, token, stepIndex) {
  const operation = $("#intro-operation");
  operation.classList.remove("visible");
  await introDelay(22, token);
  if (token !== state.introToken) return false;
  operation.textContent = step.label;
  operation.classList.add("visible");
  const screen = $("#intro-screen");
  screen.classList.remove("matrix-impact");
  void screen.offsetWidth;
  screen.classList.add("matrix-impact");

  const changes = [];
  step.values.forEach((row, rowIndex) => {
    row.forEach((value, columnIndex) => {
      const cell = $(`[data-intro-cell="${rowIndex}-${columnIndex}"]`);
      const nextValue = String(value);
      if (cell.textContent === nextValue) {
        cell.classList.add("value-visible");
        return;
      }
      changes.push({ cell, nextValue, delay: (rowIndex * 4 + columnIndex) * 4 });
    });
  });

  let changeCuePlayed = false;
  await Promise.all(changes.map(async ({ cell, nextValue, delay }) => {
    if (!introReducedMotion()) {
      await cell.animate(
        [
          { opacity: 1, transform: "translateY(0) rotateX(0) scale(1)" },
          { opacity: 0, transform: "translateY(-16px) rotateX(68deg) scale(0.72)" },
        ],
        { duration: 62, delay, easing: "cubic-bezier(0.76, 0, 0.84, 0)", fill: "forwards" },
      ).finished.catch(() => {});
    }
    if (token !== state.introToken) return;
    cell.textContent = nextValue;
    cell.classList.add("value-visible", "changing");
    if (!changeCuePlayed) {
      changeCuePlayed = true;
      audio.playIntro(stepIndex % 2 ? "tick" : "soft");
    }
    if (!introReducedMotion()) {
      await cell.animate(
        [
          { opacity: 0, transform: "translateY(17px) rotateX(-65deg) scale(0.75)" },
          { opacity: 1, transform: "translateY(0) rotateX(0) scale(1)" },
        ],
        {
          duration: 130,
          delay: 3,
          easing: "cubic-bezier(0.08, 1.42, 0.18, 1)",
          fill: "forwards",
        },
      ).finished.catch(() => {});
    }
    cell.classList.remove("changing");
  }));

  if (token !== state.introToken) return false;
  return true;
}

async function launchIntroSolutions(token) {
  const solutions = [
    { row: 0, variable: "r", value: "2" },
    { row: 1, variable: "e", value: "−1" },
    { row: 2, variable: "f", value: "3" },
  ];

  for (let index = 0; index < solutions.length; index += 1) {
    const solution = solutions[index];
    const source = $(`[data-intro-cell="${solution.row}-3"]`);
    const target = $(`[data-intro-target-var="${solution.variable}"]`);
    await flyIntroToken(source, target, {
      kind: "solution",
      duration: 480,
      arc: -92,
    });
    if (token !== state.introToken) return false;
    target.dataset.solutionValue = solution.value;
    target.classList.add("solution-landed");
    audio.playIntro(index === 0 ? "soft" : index === 1 ? "tick" : "buttonUp");
    if (!(await introDelay(150, token))) return false;
  }
  return true;
}

async function finishIntro({ skipped = false, token = state.introToken } = {}) {
  if (token !== state.introToken) return;
  state.introRunning = false;
  state.introVisible = false;
  localStorage.setItem(INTRO_SEEN_KEY, "true");
  $("#intro-screen").classList.add("intro-finishing");
  document.body.classList.remove("intro-active");
  await wait(introReducedMotion() || skipped ? 40 : 850);
  if (token !== state.introToken) return;
  $("#intro-screen").hidden = true;
  resetIntroDom();
  audio.exitIntro();
  resumeLevelTimer();
}

async function runIntroAnimation() {
  if (!state.introVisible || state.introRunning) return;
  state.introRunning = true;
  const token = state.introToken;
  const screen = $("#intro-screen");
  screen.classList.add("intro-running");
  audio.playIntro("soft");

  if (!(await introDelay(850, token))) return;
  screen.classList.add("intro-expanded");
  $("#intro-equations-expanded").setAttribute("aria-hidden", "false");
  const expansionCues = ["soft", "tick", "buttonUp"];
  $$("#intro-equations-expanded p").forEach((row, index) => {
    cueIntroAnimationAt(
      row.querySelector(".inserted"),
      "intro-insert-token",
      0.5,
      expansionCues[index],
      token,
    );
  });

  if (!(await introDelay(2100, token))) return;
  if (!(await formIntroMatrix(token))) return;
  if (!(await introDelay(700, token))) return;

  for (let index = 0; index < INTRO_MATRIX_STEPS.length; index += 1) {
    if (!(await animateIntroMatrixStep(INTRO_MATRIX_STEPS[index], token, index))) return;
    if (!(await introDelay(index === 0 ? 75 : 45, token))) return;
  }

  $("#intro-operation").classList.remove("visible");
  if (!(await introDelay(900, token))) return;
  $("#intro-operation").textContent = "SOLUTION LOCKED";
  $("#intro-operation").classList.add("visible");
  if (!(await launchIntroSolutions(token))) return;
  if (!(await introDelay(500, token))) return;

  screen.classList.remove("matrix-impact");
  screen.classList.add("rref-complete");
  $("#intro-operation").textContent = "REDUCED ROW ECHELON FORM";
  cueIntroAnimationAt(
    $(".intro-bracket.left"),
    "intro-bracket-lock-left",
    0.34,
    "buttonUp",
    token,
  );
  cueIntroAnimationAt(
    $("#intro-rref-prefix"),
    "intro-r-pop",
    0.58,
    "buttonUp",
    token,
  );
  if (!(await introDelay(2100, token))) return;
  await finishIntro({ token });
}

function showIntro({ autoplay = false } = {}) {
  state.introToken += 1;
  state.introVisible = true;
  state.introRunning = false;
  audio.enterIntro();
  pauseLevelTimer();
  resetIntroDom();
  $("#intro-screen").hidden = false;
  document.body.classList.add("intro-active");
  if (autoplay) runIntroAnimation();
}

$$(".operation-button").forEach((button) => {
  button.addEventListener("click", () => {
    if (state.isSolved) return;
    audio.play("tap");
    state.mode = button.dataset.mode;
    state.selectedRow = null;
    render();
    restartAnimationClass(button, "mode-activated", 440);
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
$("#sound-button").addEventListener("click", () => {
  audio.setEnabled(!audio.enabled);
  renderSettings();
});
$("#replay-intro-button").addEventListener("click", () => {
  audio.play("tap");
  state.settingsOpen = false;
  renderSettings();
  audio.resumeFromUserGesture();
  showIntro({ autoplay: true });
});
$("#logout-button").addEventListener("click", logoutPlayer);
$("#intro-begin").addEventListener("click", (event) => {
  event.stopPropagation();
  audio.resumeFromUserGesture();
  runIntroAnimation();
});
$("#intro-skip").addEventListener("click", (event) => {
  event.stopPropagation();
  state.introToken += 1;
  finishIntro({ skipped: true, token: state.introToken });
});
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
document.addEventListener("pointerdown", () => {
  audio.resumeFromUserGesture();
  recordPlayerActivity();
});
document.addEventListener("keydown", recordPlayerActivity);
document.addEventListener("visibilitychange", () => {
  if (document.hidden) {
    if (SUSPEND_AUDIO_WHEN_HIDDEN) audio.suspend();
    pauseLevelTimer();
    return;
  }
  if (checkSessionInactivity()) return;
  resumeLevelTimer();
});
window.addEventListener("pagehide", () => {
  audio.suspend();
  pauseLevelTimer();
});
window.addEventListener("pageshow", () => {
  if (checkSessionInactivity()) return;
  resumeLevelTimer();
});
document.addEventListener("freeze", () => {
  audio.suspend();
  pauseLevelTimer();
});

if ("serviceWorker" in navigator) {
  window.addEventListener("load", () => {
    navigator.serviceWorker.register("sw.js").catch(() => {});
  });
}

startLevel(1);
initializeSessionActivity();
refreshLeaderboard();
if ((!signedIn() || localStorage.getItem(INTRO_SEEN_KEY) !== "true") && !state.introVisible) {
  showIntro();
}
