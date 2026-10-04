// Read-only pull-request adapter for the compliance review (since v2.5.0).
//
// Resolves a GitHub or Azure DevOps pull request to the two commits a review needs — the tip of
// its target branch and its head — and fetches them into `refs/specture/pr/…` without touching
// the user's checkout. It NEVER writes to the platform: the only commands it runs are
//
//   gh pr view <number|url> --json number,title,url,baseRefName,headRefName,baseRefOid,headRefOid
//   az repos pr show --id <number> --output json [--org https://dev.azure.com/<org>]
//
// plus local `git` (remote get-url, fetch, rev-parse). The PR description is never read: nothing
// from the PR text reaches an agent as an instruction. The id must be a plain number.
//
// Tests (and unusual installs) can point to other binaries with SPECTURE_GH_BIN /
// SPECTURE_AZ_BIN; a `.js` override is run with the current node.

const path = require("path");
const { spawnSync } = require("child_process");

const GH_FIELDS = "number,title,url,baseRefName,headRefName,baseRefOid,headRefOid";
const FETCH_PREFIX = "refs/specture/pr";

const HELP = {
  github: {
    missing: "no encontré la CLI de GitHub (`gh`): instalala desde https://cli.github.com y corré `gh auth login`",
    auth: "la CLI de GitHub no tiene sesión o no tiene acceso a este repositorio: corré `gh auth login` (alcance de lectura alcanza)"
  },
  azure: {
    missing: "no encontré la CLI de Azure (`az`): instalala (https://learn.microsoft.com/cli/azure/install-azure-cli), agregá la extensión con `az extension add --name azure-devops` y corré `az login`",
    extension: "a la CLI de Azure le falta la extensión de Azure DevOps: `az extension add --name azure-devops`",
    auth: "la CLI de Azure no tiene sesión o no tiene acceso al proyecto: corré `az login` (o definí AZURE_DEVOPS_EXT_PAT con un token de lectura de código)"
  }
};

class PrError extends Error {
  constructor(kind, message) {
    super(message);
    this.name = "PrError";
    this.kind = kind; // usage | missing | auth | not-found | fetch
  }
}

function git(root, args) {
  const res = spawnSync("git", args, { cwd: root, encoding: "utf8", maxBuffer: 64 * 1024 * 1024 });
  return { ok: res.status === 0, stdout: (res.stdout || "").trim(), stderr: (res.stderr || "").trim() };
}

// ---------- parsing ----------

// `https://github.com/<owner>/<repo>/pull/<n>` → { platform, number }
// `https://dev.azure.com/<org>/<project>/_git/<repo>/pullrequest/<n>` → { platform, number, org }
// `https://<org>.visualstudio.com/<project>/_git/<repo>/pullrequest/<n>` → idem
// `<n>` → { number } (platform from the remote)
function parsePrRef(ref) {
  const text = String(ref || "").trim();
  if (/^\d+$/.test(text)) return { number: Number(text) };
  const gh = text.match(/^https:\/\/github\.com\/[\w.-]+\/[\w.-]+\/pull\/(\d+)(?:[/?#].*)?$/i);
  if (gh) return { platform: "github", number: Number(gh[1]) };
  const az = text.match(/^https:\/\/dev\.azure\.com\/([\w.-]+)\/[^/]+\/_git\/[^/]+\/pullrequest\/(\d+)(?:[/?#].*)?$/i);
  if (az) return { platform: "azure", number: Number(az[2]), org: `https://dev.azure.com/${az[1]}` };
  const vs = text.match(/^https:\/\/([\w-]+)\.visualstudio\.com\/[^/]+\/_git\/[^/]+\/pullrequest\/(\d+)(?:[/?#].*)?$/i);
  if (vs) return { platform: "azure", number: Number(vs[2]), org: `https://${vs[1]}.visualstudio.com` };
  return null;
}

// Platform and Azure organization from a remote URL (https or ssh).
function platformOfRemote(url) {
  const u = String(url || "").trim();
  if (/github\.com[:/]/i.test(u)) return { platform: "github" };
  let m = u.match(/dev\.azure\.com\/([\w.-]+)\//i) || u.match(/ssh\.dev\.azure\.com:v3\/([\w.-]+)\//i) || u.match(/^https:\/\/[^@/]*@?dev\.azure\.com\/([\w.-]+)\//i);
  if (m) return { platform: "azure", org: `https://dev.azure.com/${m[1]}` };
  m = u.match(/([\w-]+)\.visualstudio\.com/i);
  if (m) return { platform: "azure", org: `https://${m[1]}.visualstudio.com` };
  return { platform: null };
}

// ---------- running the platform CLIs ----------

function binFor(platform) {
  const override = platform === "github" ? process.env.SPECTURE_GH_BIN : process.env.SPECTURE_AZ_BIN;
  return override || (platform === "github" ? "gh" : "az");
}

// Every argument is validated before it gets here (numbers, fixed flags, an org URL without
// spaces), so the Windows shell needed for `az.cmd` never sees anything a user typed freely.
function runCli(platform, args, cwd) {
  const bin = binFor(platform);
  for (const a of args) {
    if (!/^[\w.:/@,=-]+$/.test(a)) throw new PrError("usage", `argumento inesperado para ${platform}: ${a}`);
  }
  const options = { cwd, encoding: "utf8", maxBuffer: 16 * 1024 * 1024 };
  let res;
  if (bin.endsWith(".js")) res = spawnSync(process.execPath, [bin, ...args], options);
  else res = spawnSync(bin, args, { ...options, shell: process.platform === "win32" && platform === "azure" });
  if (res.error && res.error.code === "ENOENT") throw new PrError("missing", HELP[platform].missing);
  const notFoundByShell = res.status !== 0 && /not recognized|not found|no se reconoce/i.test(res.stderr || "") && !/pull request/i.test(res.stderr || "");
  if (notFoundByShell && !bin.endsWith(".js") && res.stdout === "") throw new PrError("missing", HELP[platform].missing);
  return { status: res.status, stdout: res.stdout || "", stderr: (res.stderr || "").trim() };
}

function classifyFailure(platform, res, number) {
  const err = res.stderr;
  if (platform === "azure" && /'repos' is (?:misspelled|not in)|azure-devops extension/i.test(err)) throw new PrError("missing", HELP.azure.extension);
  if (/auth|login|credential|401|403|forbidden|TF400813|not logged in/i.test(err)) throw new PrError("auth", HELP[platform].auth);
  if (/not found|could not resolve|does not exist|TF401180|no pull requests? found/i.test(err)) throw new PrError("not-found", `no encontré el PR ${number} en ${platform === "github" ? "GitHub" : "Azure DevOps"}`);
  throw new PrError("auth", `${platform === "github" ? "gh" : "az"} falló: ${err.split(/\r?\n/)[0] || `exit ${res.status}`}`);
}

function parseJson(platform, text) {
  try {
    return JSON.parse(text);
  } catch {
    throw new PrError("auth", `${platform === "github" ? "gh" : "az"} no devolvió JSON`);
  }
}

// ---------- fetching ----------

function fetchRef(root, remote, source, target) {
  const res = git(root, ["fetch", "--no-tags", "--quiet", remote, `+${source}:${target}`]);
  if (!res.ok) throw new PrError("fetch", `git fetch ${remote} ${source} falló: ${res.stderr.split(/\r?\n/)[0]}`);
  const sha = git(root, ["rev-parse", "--verify", "--quiet", `${target}^{commit}`]);
  if (!sha.ok) throw new PrError("fetch", `no quedó ${target} después del fetch`);
  return sha.stdout;
}

// ---------- resolve ----------

// → { platform, number, title, url, baseRef, headRef, baseSha, headSha, remote }
// baseSha is the tip of the target branch (rules come from there); the diff starts at the
// merge-base, which the caller computes.
function resolvePr(root, options = {}) {
  const parsed = parsePrRef(options.ref);
  if (!parsed) throw new PrError("usage", `"${options.ref}" no es un número de PR ni una URL de PR de GitHub o Azure DevOps`);
  const remote = options.remote || "origin";
  if (!/^[\w.-]+$/.test(remote)) throw new PrError("usage", `remoto inválido: ${remote}`);
  const remoteUrl = git(root, ["remote", "get-url", remote]);
  const fromRemote = remoteUrl.ok ? platformOfRemote(remoteUrl.stdout) : { platform: null };
  const platform = options.platform || parsed.platform || fromRemote.platform;
  if (!platform) throw new PrError("usage", `no sé si el PR es de GitHub o de Azure DevOps (remoto ${remote}: ${remoteUrl.stdout || "sin URL"}) — pasá --platform github|azure`);
  if (!["github", "azure"].includes(platform)) throw new PrError("usage", `plataforma desconocida: ${platform}`);
  const n = parsed.number;

  if (platform === "github") {
    const res = runCli("github", ["pr", "view", String(n), "--json", GH_FIELDS], root);
    if (res.status !== 0) classifyFailure("github", res, n);
    const pr = parseJson("github", res.stdout);
    if (!pr.headRefOid || !pr.baseRefName) throw new PrError("auth", "gh no devolvió la base y la cabeza del PR");
    const headSha = fetchRef(root, remote, `refs/pull/${n}/head`, `${FETCH_PREFIX}/${n}/head`);
    const baseSha = fetchRef(root, remote, `refs/heads/${pr.baseRefName}`, `${FETCH_PREFIX}/${n}/base`);
    if (headSha !== pr.headRefOid) throw new PrError("fetch", `la cabeza del PR cambió mientras la leía (${pr.headRefOid.slice(0, 7)} → ${headSha.slice(0, 7)}): volvé a correr`);
    return { platform, number: n, title: pr.title || "", url: pr.url || "", baseRef: pr.baseRefName, headRef: pr.headRefName || "", baseSha, headSha, remote };
  }

  const org = options.org || parsed.org || fromRemote.org;
  if (org && !/^https:\/\/(?:dev\.azure\.com\/[\w.-]+|[\w-]+\.visualstudio\.com)$/i.test(org)) throw new PrError("usage", `organización de Azure DevOps inválida: ${org}`);
  const args = ["repos", "pr", "show", "--id", String(n), "--output", "json", ...(org ? ["--org", org] : [])];
  const res = runCli("azure", args, root);
  if (res.status !== 0) classifyFailure("azure", res, n);
  const pr = parseJson("azure", res.stdout);
  const source = pr.sourceRefName;
  const target = pr.targetRefName;
  const expected = pr.lastMergeSourceCommit && pr.lastMergeSourceCommit.commitId;
  if (!source || !target || !expected) throw new PrError("auth", "az no devolvió las ramas y el último commit del PR");
  const headSha = fetchRef(root, remote, source, `${FETCH_PREFIX}/${n}/head`);
  const baseSha = fetchRef(root, remote, target, `${FETCH_PREFIX}/${n}/base`);
  if (headSha !== expected) throw new PrError("fetch", `la cabeza del PR cambió mientras la leía (${expected.slice(0, 7)} → ${headSha.slice(0, 7)}): volvé a correr`);
  const web = pr.repository && pr.repository.webUrl ? `${pr.repository.webUrl}/pullrequest/${n}` : "";
  const short = (ref) => ref.replace(/^refs\/heads\//, "");
  return { platform, number: n, title: pr.title || "", url: web, baseRef: short(target), headRef: short(source), baseSha, headSha, remote };
}

// A local branch against its base: --base, else the remote's default branch, else main/master/develop.
function resolveBranch(root, options = {}) {
  const verify = (rev) => {
    const r = git(root, ["rev-parse", "--verify", "--quiet", `${rev}^{commit}`]);
    return r.ok ? r.stdout : null;
  };
  const headRef = options.branch || (git(root, ["rev-parse", "--abbrev-ref", "HEAD"]).stdout || "HEAD");
  const headSha = verify(options.branch || "HEAD");
  if (!headSha) throw new PrError("usage", `no existe la rama ${options.branch}`);
  let baseRef = options.base || null;
  if (!baseRef) {
    const sym = git(root, ["symbolic-ref", "--quiet", "--short", "refs/remotes/origin/HEAD"]);
    if (sym.ok && sym.stdout) baseRef = sym.stdout;
    else baseRef = ["main", "master", "develop"].find((b) => b !== headRef && verify(b)) || null;
  }
  if (!baseRef) throw new PrError("usage", "no encontré la rama base: pasá --base <rama> (la que declara W-4 en conventions.md §13)");
  const baseSha = verify(baseRef);
  if (!baseSha) throw new PrError("usage", `no existe la rama base ${baseRef}`);
  if (baseSha === headSha) throw new PrError("usage", `${headRef} no tiene cambios respecto de ${baseRef}`);
  return { platform: "local", number: null, title: "", url: "", baseRef, headRef, baseSha, headSha, remote: null };
}

module.exports = { GH_FIELDS, FETCH_PREFIX, HELP, PrError, parsePrRef, platformOfRemote, resolvePr, resolveBranch };
