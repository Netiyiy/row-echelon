const BLOCKED_NAME_FRAGMENTS = Object.freeze([
  "fuck", "fuk", "phuck", "shit", "bitch", "cunt", "pussy", "whore",
  "slut", "penis", "vagina", "nigger", "nigga", "faggot", "retard", "porn",
]);

const BLOCKED_NAME_WORDS = new Set([
  "ass", "cock", "dick", "rape", "sex",
]);

// These intentionally target high-confidence consonant abbreviations. Keeping
// them narrow avoids fuzzy-matching innocent near-words such as "fing".
const BLOCKED_ABBREVIATION_PATTERNS = Object.freeze([
  /(?:f|ph)(?:[uiovx]?c+k|[uiovx]+k|k(?:ing|in|ed|er|ers|s))/, // fck, fuk, fking
  /s+h+i?t+(?:ing|ed|y|s)?/, // sht
  /b+i?t+c+h+/, // btch
  /c+[uov]?n+t+/, // cnt
  /p+u?s+s+y+/, // pssy
  /w+h+o?r+e+/, // whre
  /s+l+u?t+/, // slt
  /p+o?r+n+/, // prn
]);

const LEET_SUBSTITUTIONS = Object.freeze({
  "0": "o",
  "1": "i",
  "2": "z",
  "3": "e",
  "4": "a",
  "5": "s",
  "6": "g",
  "7": "t",
  "8": "b",
  "9": "g",
});

function moderationText(value) {
  return String(value || "")
    .normalize("NFKC")
    .toLowerCase()
    .replace(/[0-9]/g, (character) => LEET_SUBSTITUTIONS[character]);
}

function moderationForms(value) {
  const moderated = moderationText(value);
  const compact = moderated.replace(/[^a-z]/g, "");
  const collapsed = compact.replace(/([a-z])\1+/g, "$1");
  const doubleCollapsed = compact.replace(/([a-z])\1{2,}/g, "$1$1");
  return {
    compactForms: [...new Set([compact, collapsed, doubleCollapsed])],
    wordForms: moderated
      .split(/[^a-z]+/)
      .filter(Boolean)
      .flatMap((word) => [word, word.replace(/([a-z])\1+/g, "$1")]),
  };
}

function isBlockedName(name) {
  const { compactForms, wordForms } = moderationForms(name);
  return compactForms.some((form) =>
    BLOCKED_NAME_FRAGMENTS.some((term) => form.includes(term))
      || BLOCKED_ABBREVIATION_PATTERNS.some((pattern) => pattern.test(form)),
  ) || wordForms.some((word) => BLOCKED_NAME_WORDS.has(word));
}

module.exports = {
  isBlockedName,
  moderationForms,
  moderationText,
};
