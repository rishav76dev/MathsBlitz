const crypto = require("crypto");

// ─── Difficulty bands ─────────────────────────────────────────────────────────
const EASY   = 1;
const MEDIUM = 2;
const HARD   = 3;

function getDifficulty(elapsedSeconds) {
  if (elapsedSeconds < 10) return EASY;
  if (elapsedSeconds < 20) return MEDIUM;
  return HARD;
}

// ─── Number generators per difficulty ─────────────────────────────────────────
function randInt(min, max) {
  return Math.floor(Math.random() * (max - min + 1)) + min;
}

function getOperands(op, difficulty) {
  if (difficulty === EASY) {
    if (op === "+") return [randInt(1, 20), randInt(1, 20)];
    if (op === "-") { const a = randInt(10, 30); return [a, randInt(1, a)]; }
    if (op === "×") return [randInt(1, 9), randInt(1, 9)];
    if (op === "÷") { const b = randInt(1, 9); return [b * randInt(1, 9), b]; }
  }
  if (difficulty === MEDIUM) {
    if (op === "+") return [randInt(20, 99), randInt(10, 99)];
    if (op === "-") { const a = randInt(30, 99); return [a, randInt(10, a)]; }
    if (op === "×") return [randInt(2, 12), randInt(2, 12)];
    if (op === "÷") { const b = randInt(2, 12); return [b * randInt(2, 12), b]; }
  }
  // HARD
  if (op === "+") return [randInt(100, 500), randInt(100, 500)];
  if (op === "-") { const a = randInt(200, 999); return [a, randInt(100, a)]; }
  if (op === "×") return [randInt(11, 25), randInt(11, 25)];
  if (op === "÷") { const b = randInt(7, 20); return [b * randInt(11, 25), b]; }
  return [1, 1];
}

const OPS = ["+", "-", "×", "÷"];

/**
 * Generate a single question for the given elapsed time.
 * The `answer` field is included here (server-side only).
 * Strip it before sending to clients.
 *
 * @param {number} elapsedSeconds - seconds since match start
 * @returns {{ id: string, question: string, answer: number, difficulty: number }}
 */
function generate(elapsedSeconds) {
  const difficulty = getDifficulty(elapsedSeconds);
  const op = OPS[Math.floor(Math.random() * OPS.length)];
  const [a, b] = getOperands(op, difficulty);

  let answer;
  if (op === "+") answer = a + b;
  else if (op === "-") answer = a - b;
  else if (op === "×") answer = a * b;
  else answer = a / b; // guaranteed integer division

  return {
    id: crypto.randomUUID(),
    question: `${a} ${op} ${b}`,
    answer,
    difficulty,
  };
}

module.exports = { generate };
