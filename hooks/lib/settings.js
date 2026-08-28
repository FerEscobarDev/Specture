// Specture project settings — `.specture/settings.yml` (owner: the framework).
//
// Since v1.15.0 the framework-owned configuration of a project (schema_version,
// profile, toggles) lives in a flat `key: value` file, `.specture/settings.yml`.
// Projects created before v1.15.0 keep the toggles in `conventions.md` §10; this
// module reads them from there as a fallback until `/specture:doctor migrate`
// moves them (migration `1.15-settings-file`).
//
// No dependencies: the YAML subset is deliberately flat (no nesting, no lists).

const fs = require("fs");
const path = require("path");

const SETTINGS_FILE = path.join(".specture", "settings.yml");
const CONVENTIONS_FILE = path.join(".specture", "conventions.md");

const TOGGLE_KEYS = [
  "hooks.enabled",
  "context7.enabled",
  "docs_index.enabled",
  "docs_index.max_entries_per_dispatch",
  "knowledge.enabled"
];

const KEYS = ["schema_version", "profile", ...TOGGLE_KEYS];

// Effective values when nothing is declared (behaviour of v1.11.0 "custom" without toggles).
const DEFAULTS = Object.freeze({
  profile: "custom",
  "hooks.enabled": false,
  "context7.enabled": false,
  "docs_index.enabled": true,
  "docs_index.max_entries_per_dispatch": 3,
  "knowledge.enabled": false
});

// `lean` / `full` override the four boolean toggles; `custom` reads them individually.
const PROFILES = Object.freeze({
  lean: { "hooks.enabled": true, "context7.enabled": false, "docs_index.enabled": false, "knowledge.enabled": false },
  full: { "hooks.enabled": true, "context7.enabled": true, "docs_index.enabled": true, "knowledge.enabled": true }
});

// Key names used by older conventions.md §10 blocks.
const LEGACY_ALIASES = Object.freeze({
  "specture.profile": "profile",
  "learn.enabled": "knowledge.enabled"
});

function settingsPath(projectRoot) {
  return path.join(projectRoot, SETTINGS_FILE);
}

function stripComment(line) {
  // A `#` starts a comment unless it is inside quotes. Values here never contain `#`.
  let inQuote = null;
  for (let i = 0; i < line.length; i++) {
    const c = line[i];
    if (inQuote) {
      if (c === inQuote) inQuote = null;
    } else if (c === '"' || c === "'") {
      inQuote = c;
    } else if (c === "#") {
      return line.slice(0, i);
    }
  }
  return line;
}

function coerce(raw) {
  const text = raw.trim().replace(/^(["'])(.*)\1$/, "$2");
  if (text === "") return undefined;
  if (/^\[.*\]$/.test(text)) return undefined; // template placeholder like [true | false]
  if (/^(true|false)$/i.test(text)) return text.toLowerCase() === "true";
  if (/^-?\d+$/.test(text)) return Number(text);
  return text;
}

// Parses the flat YAML subset used by settings.yml. Unknown keys are kept as-is.
function parseSettingsYaml(text) {
  const values = {};
  for (const rawLine of String(text).split(/\r?\n/)) {
    const line = stripComment(rawLine).trim();
    if (!line) continue;
    const match = line.match(/^([A-Za-z0-9_.-]+)\s*:\s*(.*)$/);
    if (!match) continue;
    const value = coerce(match[2]);
    if (value !== undefined) values[match[1]] = value;
  }
  return values;
}

// Reads the legacy `conventions.md` §10 / "Settings" block: lines shaped like
//   - **hooks.enabled**: true        or        - hooks.enabled: true
function parseConventionsSettings(text) {
  const values = {};
  const candidates = [...KEYS, ...Object.keys(LEGACY_ALIASES)];
  for (const key of candidates) {
    const pattern = new RegExp(
      `^\\s*-\\s*\\*{0,2}${key.replace(/\./g, "\\.")}\\*{0,2}\\s*:\\s*([^\\r\\n]*)`,
      "im"
    );
    const match = String(text).match(pattern);
    if (!match) continue;
    const value = coerce(stripComment(match[1]));
    if (value !== undefined) values[key] = value;
  }
  return values;
}

function applyAliases(raw) {
  const out = {};
  for (const [key, value] of Object.entries(raw)) {
    const canonical = LEGACY_ALIASES[key] || key;
    if (!(canonical in out)) out[canonical] = value;
  }
  return out;
}

function effectiveValues(raw) {
  const values = { ...DEFAULTS };
  const profile = typeof raw.profile === "string" ? raw.profile.toLowerCase() : "custom";
  values.profile = PROFILES[profile] ? profile : "custom";
  if (PROFILES[profile]) {
    Object.assign(values, PROFILES[profile]);
    if (raw["docs_index.max_entries_per_dispatch"] !== undefined) {
      values["docs_index.max_entries_per_dispatch"] = raw["docs_index.max_entries_per_dispatch"];
    }
  } else {
    for (const key of TOGGLE_KEYS) {
      if (raw[key] !== undefined) values[key] = raw[key];
    }
  }
  if (typeof values["docs_index.max_entries_per_dispatch"] !== "number") {
    values["docs_index.max_entries_per_dispatch"] = DEFAULTS["docs_index.max_entries_per_dispatch"];
  }
  return values;
}

// Returns { source, path, schemaVersion, values, raw }.
//   source: "settings.yml" | "conventions.md" | "defaults"
//   values: the effective toggles (defaults + profile + explicit values)
function readSettings(projectRoot) {
  const file = settingsPath(projectRoot);
  let source = "defaults";
  let raw = {};
  if (fs.existsSync(file)) {
    source = "settings.yml";
    raw = applyAliases(parseSettingsYaml(fs.readFileSync(file, "utf8")));
  } else {
    const conventions = path.join(projectRoot, CONVENTIONS_FILE);
    if (fs.existsSync(conventions)) {
      const legacy = applyAliases(parseConventionsSettings(fs.readFileSync(conventions, "utf8")));
      if (Object.keys(legacy).length > 0) {
        source = "conventions.md";
        raw = legacy;
      }
    }
  }
  const schemaVersion = typeof raw.schema_version === "string" && /^\d+\.\d+\.\d+$/.test(raw.schema_version)
    ? raw.schema_version
    : null;
  return { source, path: file, schemaVersion, values: effectiveValues(raw), raw };
}

function readToggle(projectRoot, key) {
  return readSettings(projectRoot).values[key];
}

// Serializes settings in the template's shape (comments included) — used by setup
// helpers and by migration 1.15-settings-file.
function serializeSettings(values, options = {}) {
  const v = { ...DEFAULTS, ...values };
  const schemaVersion = options.schemaVersion || v.schema_version || "";
  return [
    "# Specture — Project Settings",
    "# Owner: the framework. Written by `/specture:setup`; advanced by `/specture:doctor migrate`.",
    "# Flat `key: value` file (no nesting). Read by hooks, skills and the doctor.",
    "",
    `schema_version: ${schemaVersion}   # Specture project schema (= plugin version at setup / last migration)`,
    "",
    `profile: ${v.profile}             # lean | full | custom — lean = hooks on, rest off; full = all on; custom = toggles below`,
    "",
    `hooks.enabled: ${v["hooks.enabled"]}                      # TDD Honesty Gate (PreToolUse deny on sealed tests)`,
    `context7.enabled: ${v["context7.enabled"]}                   # Context7 MCP in code-reviewer (Dimension 5) and modernize`,
    `docs_index.enabled: ${v["docs_index.enabled"]}                 # Docs Index Resolution when .specture/docs-index.yml exists`,
    `docs_index.max_entries_per_dispatch: ${v["docs_index.max_entries_per_dispatch"]}    # hard cap of indexed docs per agent dispatch`,
    `knowledge.enabled: ${v["knowledge.enabled"]}                  # opt-in knowledge-capture prompts (build 8.5, debug 4.5)`,
    ""
  ].join("\n");
}

module.exports = {
  SETTINGS_FILE,
  KEYS,
  TOGGLE_KEYS,
  DEFAULTS,
  PROFILES,
  LEGACY_ALIASES,
  settingsPath,
  parseSettingsYaml,
  parseConventionsSettings,
  readSettings,
  readToggle,
  serializeSettings
};
