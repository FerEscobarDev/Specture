const assert = require("node:assert/strict");
const { test } = require("node:test");

const { classifyWait, denyReason, THRESHOLD_SECONDS } = require("../lib/wait-guard");

// Every denied example below is a command a real epic-agent, coordinator or implementer ran
// in Psikora HC-IHCE.14 (2026-10-14), lightly shortened.
test("wait-guard: denies long sleeps, timers and every sleep inside a loop", () => {
  for (const command of [
    "sleep 90; echo tick",
    "sleep 100; echo tick",
    "sleep 3060; date",
    "sleep 2880; date -Iseconds",
    "cd /repo && sleep 2m && git log -1",
    "for i in $(seq 1 58); do sleep 10; done; cd /repo; git log --oneline -3",
    "until grep -q ALLDONE /tmp/out.txt; do sleep 20; done; cat /tmp/out.txt",
    'until [ "$(date +%H%M)" -ge 2354 ]; do sleep 20; done; date',
    "while ! test -f done.flag; do sleep 5; done",
    "Start-Sleep -Seconds 300; Get-Date",
    "Start-Sleep -Minutes 5",
    "Start-Sleep 120",
    "timeout /t 60",
    "read -t 60 <> <(:)"
  ]) {
    const hit = classifyWait(command);
    assert.ok(hit, `should deny: ${command}`);
    assert.ok(["sleep", "poll"].includes(hit.kind), hit.kind);
  }
  assert.equal(classifyWait("for i in 1 2 3; do sleep 1; done").kind, "poll", "any sleep inside a loop is polling, whatever the number");
});

// Psikora HC-IHCE.17 (2026-10-23): with `sleep` denied, the epic-agent swapped it for `read -t`.
test("wait-guard: `read -t` inside a loop is polling too, whatever the number and the flags", () => {
  for (const command of [
    `L=$(ls -t docs/.specture-meta/runs/*test*.log | head -1); timeout 590 bash -c "until tail -c 300 $L | grep -q 'exit:'; do read -t 20 <> <(:) ; done"; tail -c 200 $L`,
    `for i in 1; do timeout 590 bash -c "until grep -qE '^exit' <(tail -c 600 $L); do read -t 20 <> <(:) ; done" ; done`,
    "while ! test -f done.flag; do read -rt 5 <> <(:); done",
    "until test -f x; do read -r -t 1 _ < /dev/zero; done"
  ]) {
    const hit = classifyWait(command);
    assert.ok(hit, `should deny: ${command}`);
    assert.equal(hit.kind, "poll", command);
    assert.match(hit.reason, /read -t/);
  }
});

test("wait-guard: allows short pauses, time limits on real work and commands without sleep", () => {
  for (const command of [
    "sleep 2 && curl -s localhost:3000/health",
    `sleep ${THRESHOLD_SECONDS - 1}`,
    "timeout 590 dotnet test tests/Integration --no-build",
    "timeout 200 npm test",
    "dotnet test --filter FullyQualifiedName~FooTests",
    "git status --short; git log --oneline -3",
    "node hooks/lib/honesty-check.js clean-tree",
    "Start-Sleep -Milliseconds 500",
    "grep -n sleep docs/notes.md",
    "echo 'the sleeper must awaken'",
    "read -t 5 answer",
    "while read -r line; do echo $line; done < files.txt",
    "ls -t docs/.specture-meta/runs/*.log | head -1",
    "for f in *.img; do docker run --read-only -t 30 alpine true; done",
    ""
  ]) {
    assert.equal(classifyWait(command), null, `should allow: ${command}`);
  }
});

test("wait-guard: the deny reason names the command, the cost and the recovery path", () => {
  const command = "sleep 3060; date";
  const reason = denyReason(command, classifyWait(command));
  assert.match(reason, /Specture wait guard/);
  assert.match(reason, /sleep 3060; date/);
  assert.match(reason, /re-reads your whole context/);
  assert.match(reason, /never poll/);
  assert.match(reason, /no Specture dispatch has a time limit/);
  assert.match(reason, /hooks\.enabled: false/);
});
