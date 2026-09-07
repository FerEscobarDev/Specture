// Tag name normalization (RN-005) and near-duplicate detection.
'use strict';

const NEAR_DUPLICATE_DISTANCE = 1; // "colour" vs "color" collapse into one tag

function stripAccents(text) {
  return text.normalize('NFD').replace(/[̀-ͯ]/g, '');
}

// Lowercases, strips accents and collapses internal whitespace.
// NOTE: intentionally does NOT trim — trimming is the HTTP layer's job (RN-002).
function normalizeTagName(raw) {
  return stripAccents(String(raw)).toLowerCase().replace(/\s+/g, ' ');
}

function levenshtein(a, b) {
  const rows = a.length + 1;
  const cols = b.length + 1;
  const d = Array.from({ length: rows }, (_, i) => [i, ...Array(cols - 1).fill(0)]);
  for (let j = 1; j < cols; j++) d[0][j] = j;
  for (let i = 1; i < rows; i++) {
    for (let j = 1; j < cols; j++) {
      const cost = a[i - 1] === b[j - 1] ? 0 : 1;
      d[i][j] = Math.min(d[i - 1][j] + 1, d[i][j - 1] + 1, d[i - 1][j - 1] + cost);
    }
  }
  return d[rows - 1][cols - 1];
}

// Two names are "near duplicates" when their normalized edit distance is <= 1.
// The repository uses this to reuse an existing tag instead of creating a twin.
function isNearDuplicate(a, b) {
  return levenshtein(normalizeTagName(a), normalizeTagName(b)) <= NEAR_DUPLICATE_DISTANCE;
}

module.exports = { normalizeTagName, isNearDuplicate, levenshtein, NEAR_DUPLICATE_DISTANCE };
