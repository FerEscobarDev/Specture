// Collapses closed milestones (all but the ~2 most recent) to tombstones,
// preserving every epic ID by construction. Bodies go to docs/04-roadmap/archive/.

const { lines, parseRoadmap, epicIdFrom } = require("../hooks/lib/doctor/project");
const { eolOf } = require("./lib");

const ROADMAP = "docs/04-roadmap/ROADMAP.md";
const KEEP_EXPANDED = 2;

function blocks(text) {
  // Splits the ROADMAP into milestone blocks: [{ title, start, end, tombstone, epics }]
  const all = lines(text);
  const heads = [];
  all.forEach((line, i) => {
    if (/^#{2,3}\s+Milestone\b/i.test(line)) heads.push(i);
  });
  return heads.map((start, idx) => {
    let end = idx + 1 < heads.length ? heads[idx + 1] : all.length;
    // a `## ` heading that is not a milestone also ends the block
    for (let i = start + 1; i < end; i++) {
      if (/^##\s/.test(all[i]) && !/^#{2,3}\s+Milestone\b/i.test(all[i])) {
        end = i;
        break;
      }
    }
    const body = all.slice(start, end);
    const epics = body.filter((l) => /^\s*-\s*\[( |\/|x)\]/.test(l));
    return {
      start,
      end,
      heading: all[start],
      tombstone: /archivad|✅/i.test(all[start]),
      epics,
      closed: epics.length > 0 && epics.every((l) => /^\s*-\s*\[x\]/.test(l)),
      ids: epics.map((l) => epicIdFrom(l)).filter(Boolean)
    };
  });
}

function slugOf(heading) {
  return heading
    .replace(/^#+\s*/, "")
    .replace(/✅.*$/, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 60);
}

function candidates(text) {
  const all = blocks(text);
  const closedExpanded = all.filter((b) => b.closed && !b.tombstone);
  const toCollapse = closedExpanded.slice(0, Math.max(0, closedExpanded.length - KEEP_EXPANDED));
  const brokenTombstones = all.filter((b) => b.tombstone && b.ids.length === 0);
  return { all, toCollapse, brokenTombstones };
}

module.exports = {
  id: "1.9-tombstones",
  since: "1.9.0",
  kind: "mechanical",
  title: "Collapse older closed milestones to tombstones (IDs preserved) — ROADMAP as a queue",
  detect(ctx) {
    const text = ctx.read(ROADMAP);
    if (text === null) return "n/a";
    const { toCollapse, brokenTombstones } = candidates(text);
    if (brokenTombstones.length > 0) return "pending";
    return toCollapse.length > 0 ? "pending" : "done";
  },
  apply(ctx) {
    const text = ctx.read(ROADMAP);
    const eol = eolOf(text);
    const all = lines(text);
    const { toCollapse, brokenTombstones } = candidates(text);
    const notes = [];
    if (brokenTombstones.length > 0) {
      notes.push(`tombstone(s) without epic IDs cannot be repaired automatically: ${brokenTombstones.map((b) => b.heading.trim()).join(" | ")} — restore the IDs from git history or docs/04-roadmap/archive/`);
    }
    const date = new Date().toISOString().slice(0, 10);
    const hasCurrent = ctx.exists("docs/05-specs/_current");
    const pointer = hasCurrent ? "docs/05-specs/_current/" : "docs/05-specs/ (pending:_current)";
    // replace from the bottom so indexes stay valid
    for (const block of [...toCollapse].reverse()) {
      if (block.ids.length !== block.epics.length) {
        notes.push(`skipped "${block.heading.trim()}": ${block.epics.length - block.ids.length} epic line(s) without a parseable ID`);
        continue;
      }
      const slug = slugOf(block.heading);
      const archiveRel = `docs/04-roadmap/archive/${slug}.md`;
      const existing = ctx.read(archiveRel);
      const body = all.slice(block.start, block.end).join(eol);
      ctx.write(archiveRel, (existing ? existing.replace(/\s*$/, "") + eol + eol : "") + body + eol);
      const title = block.heading.replace(/\s*$/, "");
      const tombstone = [
        `${title}  ✅ archivado ${date} · verdad viva → ${pointer} · cuerpos → ${archiveRel}`,
        `- [x] ${block.ids.map((id) => `Epic ${id}`).join(", ")}   — detalle en el archivo y en los specs de docs/05-specs/`,
        ""
      ];
      all.splice(block.start, block.end - block.start, ...tombstone);
    }
    ctx.write(ROADMAP, all.join(eol));
    return { notes };
  },
  verify(ctx) {
    const text = ctx.read(ROADMAP);
    if (text === null) return true;
    const { toCollapse } = candidates(text);
    return toCollapse.length === 0;
  }
};
