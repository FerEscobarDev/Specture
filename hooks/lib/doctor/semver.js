// Minimal semver (X.Y.Z) helpers — no ranges, no prerelease.

function parse(version) {
  const match = String(version || "").trim().match(/^v?(\d+)\.(\d+)\.(\d+)$/);
  return match ? [Number(match[1]), Number(match[2]), Number(match[3])] : null;
}

function compare(a, b) {
  const pa = parse(a);
  const pb = parse(b);
  if (!pa || !pb) throw new Error(`invalid version: ${pa ? b : a}`);
  for (let i = 0; i < 3; i++) {
    if (pa[i] !== pb[i]) return pa[i] < pb[i] ? -1 : 1;
  }
  return 0;
}

module.exports = {
  parse,
  compare,
  isValid: (v) => parse(v) !== null,
  lt: (a, b) => compare(a, b) < 0,
  lte: (a, b) => compare(a, b) <= 0,
  gt: (a, b) => compare(a, b) > 0,
  gte: (a, b) => compare(a, b) >= 0
};
