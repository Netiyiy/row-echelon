const assert = require("node:assert/strict");
const { isBlockedName } = require("./username-moderation");

const blockedNames = [
  "fuck",
  "fck",
  "f&ck",
  "f.ck",
  "f_ck",
  "f c k",
  "fcking",
  "fking",
  "f*cking",
  "f0ck",
  "fvck",
  "fxck",
  "fuuck",
  "fuuuck",
  "phuck",
  "F-U-C-K",
  "sh1t",
  "s-h-t",
  "btch",
  "b!tch",
  "c_nt",
  "p0rn",
];

const allowedNames = [
  "fing",
  "FingMath",
  "king",
  "working",
  "forking",
  "flocking",
  "flicking",
  "backing",
  "packing",
  "classic",
  "assistant",
  "Sussex",
  "grape",
  "Hancock",
];

for (const name of blockedNames) {
  assert.equal(isBlockedName(name), true, `expected ${JSON.stringify(name)} to be blocked`);
}

for (const name of allowedNames) {
  assert.equal(isBlockedName(name), false, `expected ${JSON.stringify(name)} to be allowed`);
}

console.log(`Username moderation: ${blockedNames.length} blocked and ${allowedNames.length} allowed cases passed.`);
