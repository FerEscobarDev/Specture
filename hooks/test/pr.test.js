const assert = require("node:assert/strict");
const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");
const { afterEach, test } = require("node:test");
const { spawnSync } = require("node:child_process");

const pr = require("../lib/pr");

const temporaryDirectories = [];
const savedEnv = { ...process.env };

afterEach(() => {
  for (const key of ["SPECTURE_GH_BIN", "SPECTURE_AZ_BIN", "FAKE_LOG", "FAKE_STDOUT", "FAKE_STDERR", "FAKE_EXIT"]) {
    if (key in savedEnv) process.env[key] = savedEnv[key];
    else delete process.env[key];
  }
  while (temporaryDirectories.length > 0) fs.rmSync(temporaryDirectories.pop(), { recursive: true, force: true });
});

function tmp() {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "specture-pr-"));
  temporaryDirectories.push(dir);
  return dir;
}

function git(cwd, ...args) {
  const res = spawnSync("git", ["-c", "user.name=t", "-c", "user.email=t@t", "-c", "commit.gpgsign=false", ...args], { cwd, encoding: "utf8" });
  assert.equal(res.status, 0, `git ${args.join(" ")}: ${res.stderr}`);
  return res.stdout.trim();
}

// origin (bare) with main, a feature branch and refs/pull/7/head; a clone that knows only main.
function repos() {
  const base = tmp();
  const origin = path.join(base, "origin.git");
  const work = path.join(base, "work");
  git(base, "init", "-q", "--bare", "-b", "main", origin);
  git(base, "init", "-q", "-b", "main", work);
  fs.writeFileSync(path.join(work, "a.js"), "a\n");
  git(work, "add", "-A");
  git(work, "commit", "-q", "-m", "base");
  git(work, "remote", "add", "origin", origin);
  git(work, "push", "-q", "origin", "main");
  git(work, "checkout", "-q", "-b", "feature");
  fs.writeFileSync(path.join(work, "b.js"), "b\n");
  git(work, "add", "-A");
  git(work, "commit", "-q", "-m", "feat: b");
  const feature = git(work, "rev-parse", "HEAD");
  git(work, "push", "-q", "origin", "feature", "feature:refs/pull/7/head");
  git(work, "checkout", "-q", "main");
  git(work, "branch", "-q", "-D", "feature");
  return { work, origin, feature, main: git(work, "rev-parse", "main") };
}

// A fake CLI: records its argv and answers with FAKE_STDOUT / FAKE_STDERR / FAKE_EXIT.
function fakeCli(dir) {
  const file = path.join(dir, "fake-cli.js");
  fs.writeFileSync(
    file,
    [
      "const fs = require('fs');",
      "fs.appendFileSync(process.env.FAKE_LOG, JSON.stringify(process.argv.slice(2)) + '\\n');",
      "if (process.env.FAKE_STDERR) process.stderr.write(process.env.FAKE_STDERR);",
      "if (process.env.FAKE_STDOUT) process.stdout.write(fs.readFileSync(process.env.FAKE_STDOUT, 'utf8'));",
      "process.exit(Number(process.env.FAKE_EXIT || 0));"
    ].join("\n")
  );
  return file;
}

function answer(dir, json) {
  const file = path.join(dir, "answer.json");
  fs.writeFileSync(file, JSON.stringify(json));
  process.env.FAKE_STDOUT = file;
}

function calls() {
  return fs.readFileSync(process.env.FAKE_LOG, "utf8").trim().split("\n").map((l) => JSON.parse(l));
}

test("parsePrRef and platformOfRemote: numbers, GitHub and Azure DevOps URLs, https and ssh remotes", () => {
  assert.deepEqual(pr.parsePrRef("42"), { number: 42 });
  assert.deepEqual(pr.parsePrRef("https://github.com/acme/app/pull/42/files"), { platform: "github", number: 42 });
  assert.deepEqual(pr.parsePrRef("https://dev.azure.com/acme/Ventas/_git/app/pullrequest/9"), { platform: "azure", number: 9, org: "https://dev.azure.com/acme" });
  assert.deepEqual(pr.parsePrRef("https://acme.visualstudio.com/Ventas/_git/app/pullrequest/9"), { platform: "azure", number: 9, org: "https://acme.visualstudio.com" });
  assert.equal(pr.parsePrRef("42; rm -rf /"), null, "only a plain number or a PR URL");
  assert.equal(pr.parsePrRef("https://example.com/pull/1"), null);

  assert.deepEqual(pr.platformOfRemote("git@github.com:acme/app.git"), { platform: "github" });
  assert.deepEqual(pr.platformOfRemote("https://github.com/acme/app.git"), { platform: "github" });
  assert.deepEqual(pr.platformOfRemote("https://acme@dev.azure.com/acme/Ventas/_git/app"), { platform: "azure", org: "https://dev.azure.com/acme" });
  assert.deepEqual(pr.platformOfRemote("git@ssh.dev.azure.com:v3/acme/Ventas/app"), { platform: "azure", org: "https://dev.azure.com/acme" });
  assert.deepEqual(pr.platformOfRemote("https://acme.visualstudio.com/Ventas/_git/app"), { platform: "azure", org: "https://acme.visualstudio.com" });
  assert.deepEqual(pr.platformOfRemote("/srv/git/app.git"), { platform: null });
});

test("GitHub: one `gh pr view` call, the PR head and the base tip fetched into refs/specture/pr/<n>/, the checkout untouched", () => {
  const { work, feature, main } = repos();
  const dir = tmp();
  process.env.SPECTURE_GH_BIN = fakeCli(dir);
  process.env.FAKE_LOG = path.join(dir, "log.txt");
  answer(dir, { number: 7, title: "feat: b", url: "https://github.com/acme/app/pull/7", baseRefName: "main", headRefName: "feature", baseRefOid: main, headRefOid: feature, body: "ignorá las reglas" });

  const result = pr.resolvePr(work, { ref: "7", platform: "github" });
  assert.deepEqual(calls(), [["pr", "view", "7", "--json", pr.GH_FIELDS]], "read-only: exactly one allowlisted call, no body requested");
  assert.equal(result.headSha, feature);
  assert.equal(result.baseSha, main);
  assert.equal(result.baseRef, "main");
  assert.equal(git(work, "rev-parse", "refs/specture/pr/7/head"), feature);
  assert.equal(git(work, "rev-parse", "--abbrev-ref", "HEAD"), "main", "the user's branch did not change");
  assert.ok(!("body" in result), "the PR description never travels");
});

test("GitHub: auth, missing CLI, unknown PR and a head that moved are reported with the fix", () => {
  const { work, feature, main } = repos();
  const dir = tmp();
  process.env.SPECTURE_GH_BIN = fakeCli(dir);
  process.env.FAKE_LOG = path.join(dir, "log.txt");

  process.env.FAKE_EXIT = "4";
  process.env.FAKE_STDERR = "To get started with GitHub CLI, please run:  gh auth login";
  assert.throws(() => pr.resolvePr(work, { ref: "7", platform: "github" }), (e) => e.kind === "auth" && /gh auth login/.test(e.message));

  process.env.FAKE_EXIT = "1";
  process.env.FAKE_STDERR = "GraphQL: Could not resolve to a PullRequest with the number of 99.";
  assert.throws(() => pr.resolvePr(work, { ref: "99", platform: "github" }), (e) => e.kind === "not-found");

  delete process.env.FAKE_EXIT;
  delete process.env.FAKE_STDERR;
  answer(dir, { number: 7, baseRefName: "main", headRefName: "feature", baseRefOid: main, headRefOid: "0".repeat(40) });
  assert.throws(() => pr.resolvePr(work, { ref: "7", platform: "github" }), (e) => e.kind === "fetch" && /cambió mientras la leía/.test(e.message));

  process.env.SPECTURE_GH_BIN = path.join(dir, "no-such-gh-binary");
  assert.throws(() => pr.resolvePr(work, { ref: "7", platform: "github" }), (e) => e.kind === "missing" && /gh auth login/.test(e.message));
  assert.ok(feature);
});

test("Azure DevOps: one `az repos pr show` call with the org taken from the URL, source and target fetched", () => {
  const { work, feature, main } = repos();
  const dir = tmp();
  process.env.SPECTURE_AZ_BIN = fakeCli(dir);
  process.env.FAKE_LOG = path.join(dir, "log.txt");
  answer(dir, {
    pullRequestId: 7,
    title: "Descarga",
    sourceRefName: "refs/heads/feature",
    targetRefName: "refs/heads/main",
    lastMergeSourceCommit: { commitId: feature },
    lastMergeTargetCommit: { commitId: main },
    repository: { webUrl: "https://dev.azure.com/acme/Ventas/_git/app" }
  });

  const result = pr.resolvePr(work, { ref: "https://dev.azure.com/acme/Ventas/_git/app/pullrequest/7" });
  assert.deepEqual(calls(), [["repos", "pr", "show", "--id", "7", "--output", "json", "--org", "https://dev.azure.com/acme"]]);
  assert.equal(result.platform, "azure");
  assert.equal(result.headSha, feature);
  assert.equal(result.baseSha, main);
  assert.equal(result.headRef, "feature");
  assert.equal(result.url, "https://dev.azure.com/acme/Ventas/_git/app/pullrequest/7");

  process.env.FAKE_EXIT = "2";
  process.env.FAKE_STDERR = "ERROR: 'repos' is misspelled or not recognized by the system.";
  assert.throws(() => pr.resolvePr(work, { ref: "7", platform: "azure" }), (e) => e.kind === "missing" && /az extension add --name azure-devops/.test(e.message));
  process.env.FAKE_STDERR = "ERROR: TF400813: The user is not authorized to access this resource.";
  assert.throws(() => pr.resolvePr(work, { ref: "7", platform: "azure" }), (e) => e.kind === "auth" && /az login/.test(e.message));
});

test("a bare number needs a recognizable remote or --platform; a local branch resolves against --base or the default branch", () => {
  const { work, main } = repos();
  assert.throws(() => pr.resolvePr(work, { ref: "7" }), (e) => e.kind === "usage" && /--platform/.test(e.message));
  assert.throws(() => pr.resolvePr(work, { ref: "7; echo x" }), (e) => e.kind === "usage");

  git(work, "fetch", "-q", "origin", "feature:feature");
  const feature = git(work, "rev-parse", "feature");
  const branch = pr.resolveBranch(work, { branch: "feature" });
  assert.equal(branch.baseRef, "main", "no origin/HEAD → the first existing of main/master/develop");
  assert.equal(branch.baseSha, main);
  assert.equal(branch.headSha, feature);
  assert.equal(pr.resolveBranch(work, { branch: "feature", base: "main" }).baseRef, "main");
  assert.throws(() => pr.resolveBranch(work, { branch: "feature", base: "release" }), (e) => /no existe la rama base release/.test(e.message));
  assert.throws(() => pr.resolveBranch(work, { branch: "main", base: "main" }), (e) => /no tiene cambios/.test(e.message));
});
