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
const fraction = (value) => new Fraction(value);
const cloneMatrix = (matrix) => matrix.map((row) => row.map((value) => value.clone()));

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
  elapsedTime: 0,
  levelStartedAt: performance.now(),
  bestTime: Number(localStorage.getItem("rowEchelonBestTime")) || null,
  celebrationToken: 0,
};

function intMatrix(values) {
  return values.map((row) => row.map(fraction));
}

function randomEchelonMatrix() {
  return intMatrix([
    [1, randomInt(-3, 3), randomInt(-3, 3), randomInt(-4, 4)],
    [0, 1, randomInt(-3, 3), randomInt(-4, 4)],
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
    if (valuesStayReadable && !isRowEchelonForm(candidate)) return candidate;
  }

  return intMatrix([
    [1, 2, -1, 3],
    [2, 4, 1, 9],
    [-1, -2, 2, 0],
  ]);
}

function isRowEchelonForm(matrix) {
  let previousPivot = -1;
  let sawZeroRow = false;

  for (const row of matrix) {
    const pivot = row.findIndex((value) => !value.isZero);
    if (pivot === -1) {
      sawZeroRow = true;
      continue;
    }
    if (sawZeroRow || pivot <= previousPivot) return false;
    previousPivot = pivot;
  }
  return true;
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

function formattedTime(time) {
  const seconds = Math.max(0, Math.floor(time));
  return `${String(Math.floor(seconds / 60)).padStart(2, "0")}:${String(seconds % 60).padStart(2, "0")}`;
}

function updateTimerLabels() {
  $("#current-time").textContent = `TIME ${formattedTime(state.elapsedTime)}`;
  $("#best-time").textContent = `BEST ${state.bestTime ? formattedTime(state.bestTime) : "--:--"}`;
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
  updateTimerLabels();
}

function startLevel(level) {
  state.celebrationToken += 1;
  state.level = level;
  state.matrix = generateMatrix(level);
  state.originalMatrix = cloneMatrix(state.matrix);
  state.history = [];
  state.mode = "add";
  state.factor = fraction(-1);
  state.selectedRow = null;
  state.isSolved = false;
  state.elapsedTime = 0;
  state.levelStartedAt = performance.now();
  $("#sparkle-layer").replaceChildren();
  render();
}

function applyChange(change) {
  state.history.push(cloneMatrix(state.matrix));
  change();
  state.selectedRow = null;
  state.isSolved = isRowEchelonForm(state.matrix);
  render();
  if (state.isSolved) completeLevel();
}

function chooseRow(row) {
  if (state.isSolved) return;
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
  state.matrix = cloneMatrix(state.originalMatrix);
  state.history = [];
  state.selectedRow = null;
  state.isSolved = false;
  state.elapsedTime = 0;
  state.levelStartedAt = performance.now();
  render();
}

async function completeLevel() {
  state.elapsedTime = (performance.now() - state.levelStartedAt) / 1000;
  if (!state.bestTime || state.elapsedTime < state.bestTime) {
    state.bestTime = state.elapsedTime;
    localStorage.setItem("rowEchelonBestTime", String(state.bestTime));
  }
  updateTimerLabels();
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

$$(".operation-button").forEach((button) => {
  button.addEventListener("click", () => {
    if (state.isSolved) return;
    audio.play("tap");
    state.mode = button.dataset.mode;
    state.selectedRow = null;
    render();
  });
});

$("#reset-button").addEventListener("click", resetLevel);
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

document.addEventListener("pointerdown", () => audio.startMusic(), { once: true });
window.setInterval(() => {
  if (state.isSolved) return;
  state.elapsedTime = (performance.now() - state.levelStartedAt) / 1000;
  updateTimerLabels();
}, 250);

if ("serviceWorker" in navigator) {
  window.addEventListener("load", () => {
    navigator.serviceWorker.register("sw.js").catch(() => {});
  });
}

startLevel(1);
