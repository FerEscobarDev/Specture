const { lines } = require("../hooks/lib/doctor/project");
const semver = require("../hooks/lib/doctor/semver");
const { eolOf } = require("./lib");

const SETTINGS = ".specture/settings.yml";
const BASELINE = "1.1.0";

function currentSchema(ctx) {
  const text = ctx.read(SETTINGS);
  if (text === null) return null;
  const line = lines(text).find((l) => /^schema_version\s*:/.test(l));
  const value = line ? line.replace(/^schema_version\s*:/, "").replace(/#.*$/, "").trim().replace(/^(["'])(.*)\1$/, "$2") : "";
  return semver.isValid(value) ? value : "";
}

// Highest `since` below the lowest pending non-content migration; plugin version when nothing is pending.
function inferSchemaVersion(ctx) {
  const catalog = require("./index");
  const relevant = catalog.filter((m) => m.kind !== "content" && m.id !== module.exports.id && semver.lte(m.since, ctx.pluginVersion));
  const statuses = relevant.map((m) => ({ since: m.since, status: m.detect(ctx) }));
  const pending = statuses.filter((s) => s.status === "pending").map((s) => s.since).sort(semver.compare);
  if (pending.length === 0) return ctx.pluginVersion;
  const below = statuses.filter((s) => s.status !== "pending" && semver.lt(s.since, pending[0])).map((s) => s.since).sort(semver.compare);
  return below.length > 0 ? below[below.length - 1] : BASELINE;
}

module.exports = {
  id: "1.15-schema-version",
  since: "1.15.0",
  kind: "mechanical",
  title: "Record schema_version in .specture/settings.yml",
  detect(ctx) {
    if (!ctx.exists(".specture/stack.yml")) return "n/a";
    const current = currentSchema(ctx);
    if (current === null || current === "") return "pending";
    return "done";
  },
  apply(ctx) {
    const text = ctx.read(SETTINGS);
    if (text === null) return { notes: ["settings.yml does not exist yet — run 1.15-settings-file first"] };
    const version = inferSchemaVersion(ctx);
    const eol = eolOf(text);
    const all = lines(text);
    const idx = all.findIndex((l) => /^schema_version\s*:/.test(l));
    const line = `schema_version: ${version}   # Specture project schema (= plugin version at setup / last migration)`;
    if (idx === -1) all.unshift(line);
    else all[idx] = line;
    ctx.write(SETTINGS, all.join(eol));
    return { notes: [`schema_version set to ${version}`] };
  },
  verify(ctx) {
    return this.detect(ctx) === "done";
  },
  inferSchemaVersion
};
