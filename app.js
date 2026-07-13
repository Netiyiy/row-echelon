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
const DIGITS = ["0", "1", "2", "3", "4", "5", "6", "7", "8", "9"];
const INPUT_MODES = ["keyboard", "keypad", "radial"];
const savedInputMode = localStorage.getItem("rowEchelonInputMode");

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
    const extension = effect === "complete" ? "mp3" : "wav";
    const player = new Audio(`assets/audio/ui_${effect}.${extension}`);
    player.volume = effect === "complete" ? 0.68 : 0.55;
    this.effects.add(player);
    player.addEventListener("ended", () => {
      this.effects.delete(player);
      if (effect === "complete") {
        this.fadeBackgroundTo(this.backgroundVolume, 800);
      }
    });
    if (effect === "complete") {
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
  inputMode: INPUT_MODES.includes(savedInputMode) ? savedInputMode : "keyboard",
  settingsOpen: false,
  factorDraft: "-1",
  radialPointerId: null,
  radialTargetDigit: null,
  celebrationToken: 0,
};

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

function updateScoreLabels() {
  $("#current-score").textContent = `STEPS ${state.steps}`;
  $("#best-score").textContent = `BEST ${state.bestSteps ?? "--"}`;
}

function validateFactorInput({ restoreInvalid = false, clearSelection = false } = {}) {
  const input = $("#factor-input");
  state.factorDraft = input.value;
  const value = Fraction.parse(state.factorDraft);

  if (!value || value.isZero) {
    input.classList.add("invalid");
    input.setAttribute("aria-invalid", "true");
    if (restoreInvalid) {
      state.factorDraft = state.factor.toString();
      input.value = state.factorDraft;
      input.classList.remove("invalid");
      input.removeAttribute("aria-invalid");
    }
    return false;
  }

  state.factor = value;
  if (clearSelection) state.selectedRow = null;
  input.classList.remove("invalid");
  input.removeAttribute("aria-invalid");
  return true;
}

function setFactorDraft(value, { playSound = false } = {}) {
  if (state.isSolved) return;
  if (playSound) audio.play("tap");
  const input = $("#factor-input");
  state.factorDraft = value;
  input.value = state.factorDraft;
  validateFactorInput({ clearSelection: true });
  renderMatrix();
}

function appendFactorDigit(digit) {
  if (!DIGITS.includes(digit)) return;
  const input = $("#factor-input");
  setFactorDraft(`${input.value}${digit}`, { playSound: true });
}

function backspaceFactorInput({ playSound = true } = {}) {
  const input = $("#factor-input");
  if (playSound) audio.play("tap");
  setFactorDraft(input.value.slice(0, -1));
}

function clearFactorInput({ playSound = true } = {}) {
  if (playSound) audio.play("tap");
  setFactorDraft("");
}

function setInputMode(mode) {
  if (!INPUT_MODES.includes(mode)) return;
  state.factorDraft = $("#factor-input").value;
  state.inputMode = mode;
  state.settingsOpen = false;
  state.radialPointerId = null;
  state.radialTargetDigit = null;
  localStorage.setItem("rowEchelonInputMode", state.inputMode);
  audio.play("tap");
  renderControls();
}

function ensureUsableFactor() {
  return validateFactorInput();
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

  $("#settings-button").classList.toggle("active", state.settingsOpen);
  $("#settings-button").setAttribute("aria-expanded", String(state.settingsOpen));
  $("#settings-panel").hidden = !state.settingsOpen;
  $$(".input-mode-button").forEach((button) => {
    button.classList.toggle("active", button.dataset.inputMode === state.inputMode);
  });

  const factorInput = $("#factor-input");
  if (document.activeElement !== factorInput) {
    factorInput.value = state.factorDraft;
    factorInput.classList.remove("invalid");
    factorInput.removeAttribute("aria-invalid");
  }
  const isKeyboardMode = state.inputMode === "keyboard";
  factorInput.readOnly = !isKeyboardMode;
  factorInput.setAttribute("inputmode", isKeyboardMode ? "text" : "none");
  factorInput.classList.toggle("readonly", !isKeyboardMode);

  $("#numeric-tools").hidden = isKeyboardMode;
  $("#keypad-panel").hidden = state.inputMode !== "keypad";
  $("#radial-panel").hidden = state.inputMode !== "radial";
  renderRadialTarget();
}

function render() {
  $("#level-label").textContent = `LEVEL ${state.level}`;
  $("#level-cleared").textContent = state.isSolved ? "LEVEL CLEARED" : "";
  $(".game-shell").classList.toggle("celebrating", state.isSolved);
  renderMatrix();
  renderControls();
  updateScoreLabels();
}

function startLevel(level) {
  state.celebrationToken += 1;
  state.level = level;
  state.matrix = generateMatrix(level);
  state.originalMatrix = cloneMatrix(state.matrix);
  state.history = [];
  state.mode = "add";
  state.factor = fraction(-1);
  state.factorDraft = "-1";
  state.selectedRow = null;
  state.isSolved = false;
  state.steps = 0;
  $("#sparkle-layer").replaceChildren();
  render();
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
  if (state.mode === "scale") {
    if (!ensureUsableFactor()) {
      audio.play("tap");
      return;
    }
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
  if (state.mode === "add" && !ensureUsableFactor()) {
    audio.play("tap");
    return;
  }
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
  state.matrix = cloneMatrix(state.originalMatrix);
  state.history = [];
  state.selectedRow = null;
  state.isSolved = false;
  state.steps = 0;
  render();
}

async function completeLevel() {
  if (!state.bestSteps || state.steps < state.bestSteps) {
    state.bestSteps = state.steps;
    localStorage.setItem("rowEchelonBestSteps", String(state.bestSteps));
  }
  updateScoreLabels();
  audio.play("complete");

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
  await wait(2800);
  if (token === state.celebrationToken) startLevel(state.level + 1);
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
  const isValid = validateFactorInput({ restoreInvalid, clearSelection: true });
  if (isValid) renderMatrix();
  return isValid;
}

function renderRadialTarget() {
  const dial = $("#radial-dial");
  if (!dial) return;
  $$(".radial-digit").forEach((digit) => {
    digit.classList.toggle("targeted", digit.dataset.digit === state.radialTargetDigit);
  });
  dial.classList.toggle("has-target", state.radialTargetDigit !== null);
}

function radialInfoFromPointer(event) {
  const dial = $("#radial-dial");
  const rect = dial.getBoundingClientRect();
  const centerX = rect.left + rect.width / 2;
  const centerY = rect.top + rect.height / 2;
  const dx = event.clientX - centerX;
  const dy = event.clientY - centerY;
  const distance = Math.hypot(dx, dy);
  const angleFromX = Math.atan2(dy, dx) * 180 / Math.PI;
  const zeroTopAngle = (angleFromX + 450) % 360;
  const digit = DIGITS[Math.floor((zeroTopAngle + 18) / 36) % DIGITS.length];
  const deadZone = Math.max(30, rect.width * 0.18);
  const pointerLength = Math.min(distance, rect.width * 0.42);

  return {
    angleFromX,
    deadZone,
    digit: distance < deadZone ? null : digit,
    distance,
    pointerLength,
  };
}

function updateRadialGesture(event) {
  if (state.radialPointerId !== event.pointerId) return;
  const dial = $("#radial-dial");
  const info = radialInfoFromPointer(event);
  state.radialTargetDigit = info.digit;
  dial.style.setProperty("--pointer-angle", `${info.angleFromX}deg`);
  dial.style.setProperty("--pointer-length", `${info.pointerLength}px`);
  renderRadialTarget();
}

function endRadialGesture(event, { commit = false } = {}) {
  if (state.radialPointerId !== event.pointerId) return;
  const dial = $("#radial-dial");
  const selectedDigit = state.radialTargetDigit;
  state.radialPointerId = null;
  state.radialTargetDigit = null;
  dial.classList.remove("dragging");
  renderRadialTarget();
  try {
    dial.releasePointerCapture(event.pointerId);
  } catch {
    // Pointer capture may already be released by the browser.
  }
  if (commit && selectedDigit !== null) appendFactorDigit(selectedDigit);
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

$("#settings-button").addEventListener("click", () => {
  audio.play("tap");
  state.settingsOpen = !state.settingsOpen;
  renderControls();
});

$$(".input-mode-button").forEach((button) => {
  button.addEventListener("click", () => setInputMode(button.dataset.inputMode));
});

$$(".keypad-button").forEach((button) => {
  button.addEventListener("click", () => appendFactorDigit(button.dataset.digit));
});

$("#backspace-button").addEventListener("click", () => backspaceFactorInput());
$("#clear-button").addEventListener("click", () => clearFactorInput());

$("#reset-button").addEventListener("click", resetLevel);
$("#factor-input").addEventListener("focus", (event) => {
  if (state.isSolved) {
    event.target.blur();
    return;
  }
  if (state.inputMode !== "keyboard") {
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

$("#radial-dial").addEventListener("pointerdown", (event) => {
  if (state.isSolved || state.inputMode !== "radial") return;
  const dial = $("#radial-dial");
  const info = radialInfoFromPointer(event);
  if (info.distance > info.deadZone) return;
  event.preventDefault();
  state.radialPointerId = event.pointerId;
  state.radialTargetDigit = null;
  dial.classList.add("dragging");
  dial.setPointerCapture(event.pointerId);
  updateRadialGesture(event);
});

$("#radial-dial").addEventListener("pointermove", (event) => {
  if (state.radialPointerId !== event.pointerId) return;
  event.preventDefault();
  updateRadialGesture(event);
});

$("#radial-dial").addEventListener("pointerup", (event) => {
  if (state.radialPointerId !== event.pointerId) return;
  event.preventDefault();
  updateRadialGesture(event);
  endRadialGesture(event, { commit: true });
});

$("#radial-dial").addEventListener("pointercancel", (event) => {
  endRadialGesture(event);
});

document.addEventListener("keydown", (event) => {
  if (state.isSolved || event.metaKey || event.ctrlKey || event.altKey) return;

  if (state.inputMode === "keyboard") {
    if (document.activeElement === $("#factor-input") && event.key === "Escape") {
      event.preventDefault();
      clearFactorInput();
    }
    return;
  }

  if (DIGITS.includes(event.key)) {
    event.preventDefault();
    appendFactorDigit(event.key);
    return;
  }
  if (event.key === "Backspace") {
    event.preventDefault();
    backspaceFactorInput();
    return;
  }
  if (event.key === "Escape") {
    event.preventDefault();
    clearFactorInput();
  }
});

document.addEventListener("pointerdown", () => audio.startMusic(), { once: true });

if ("serviceWorker" in navigator) {
  window.addEventListener("load", () => {
    navigator.serviceWorker.register("sw.js").catch(() => {});
  });
}

startLevel(1);
