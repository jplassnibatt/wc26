// Polls results in a loop for ~55 minutes, then lets the workflow re-dispatch
// itself (see sync-results.yml). GitHub's `schedule` trigger is best-effort and
// regularly skips hours of `*/15` runs, so the cadence comes from this chain;
// the cron is only a watchdog that restarts it if it dies.
//
// During a match window (15 min before kickoff until 3h30 after, enough for
// extra time + penalties) it runs sync-results.mjs every 3 minutes; outside
// windows it just sleeps, keeping the chain alive without hammering ESPN.
// Writes `continue=true|false` to $GITHUB_OUTPUT so the workflow stops
// re-dispatching once the tournament is over.
import { readFileSync, appendFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { spawnSync } from 'node:child_process';

const LOOP_MS = 55 * 60 * 1000;
const POLL_MS = 3 * 60 * 1000;
const PRE_KICKOFF_MS = 15 * 60 * 1000;
const POST_KICKOFF_MS = 210 * 60 * 1000;

const schedule = JSON.parse(readFileSync(new URL('../src/data/schedule.json', import.meta.url)));

// Kickoff (UTC ms): schedule stores Portugal time (UTC+1 during the tournament).
const kickoffs = schedule.phases.flatMap((p) => p.matches).map((m) => {
  const [y, mo, d] = m.date.split('-').map(Number);
  const [h, mi] = m.kickoff_bst.split(':').map(Number);
  return Date.UTC(y, mo - 1, d, h - 1, mi);
});

function inWindow(t) {
  return kickoffs.some((k) => t >= k - PRE_KICKOFF_MS && t <= k + POST_KICKOFF_MS);
}
function nextWindowStart(t) {
  const starts = kickoffs.map((k) => k - PRE_KICKOFF_MS).filter((s) => s > t);
  return starts.length ? Math.min(...starts) : null;
}

const SYNC = fileURLToPath(new URL('./sync-results.mjs', import.meta.url));
function runSync() {
  const r = spawnSync(process.execPath, [SYNC], { stdio: 'inherit' });
  if (r.status !== 0) console.log(`sync-results exited with ${r.status} — will retry next poll`);
}

const sleep = (ms) => new Promise((res) => setTimeout(res, ms));
const hhmm = (t) => new Date(t).toISOString().slice(11, 16);

const deadline = Date.now() + LOOP_MS;
runSync(); // always one pass first, to catch stragglers from outside any window

while (Date.now() < deadline) {
  const now = Date.now();
  if (inWindow(now)) {
    await sleep(Math.min(POLL_MS, deadline - now));
    if (Date.now() >= deadline) break;
    runSync();
  } else {
    const next = nextWindowStart(now);
    if (next == null) break; // tournament over
    console.log(`No match window — sleeping until ${hhmm(Math.min(next, deadline))}Z`);
    await sleep(Math.min(next - now, deadline - now));
  }
}

// Keep the chain alive until a day after the last kickoff.
const keepGoing = Date.now() < Math.max(...kickoffs) + 24 * 3600 * 1000;
console.log(`Loop done — continue=${keepGoing}`);
if (process.env.GITHUB_OUTPUT) {
  appendFileSync(process.env.GITHUB_OUTPUT, `continue=${keepGoing}\n`);
}
