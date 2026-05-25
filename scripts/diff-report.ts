// scripts/diff-report.ts
/**
 * Diff the last two load test reports to spot performance regressions.
 * Usage: npx tsx scripts/diff-report.ts
 * Exit 1 if p95 increased by more than 20%.
 */
import { readdirSync, readFileSync } from "fs";
import { resolve } from "path";

const dir = resolve(process.cwd(), "tests/reports");

let files: string[];
try {
  files = readdirSync(dir)
    .filter((f) => f.match(/100-applicants-\d+\.json/))
    .sort()
    .slice(-2);
} catch {
  console.log("tests/reports/ directory not found — no reports to diff.");
  process.exit(0);
}

if (files.length < 2) {
  console.log(`Only ${files.length} report file(s) found — need at least 2 to diff.`);
  process.exit(0);
}

type Report = {
  scenario: string;
  totalMs: number;
  p50Ms: number;
  p95Ms: number;
  p99Ms: number;
  dbPoolHighWater: number;
  heapDeltaMB: number;
  errors: string[];
};

const [prev, curr] = files.map(
  (f) => JSON.parse(readFileSync(resolve(dir, f), "utf8")) as Report
);

console.log(`\nLoad test diff:\n  ${files[0]}\n→ ${files[1]}\n`);

console.table({
  totalMs:      { prev: prev.totalMs,          curr: curr.totalMs,          delta: curr.totalMs - prev.totalMs },
  p50Ms:        { prev: prev.p50Ms,            curr: curr.p50Ms,            delta: curr.p50Ms - prev.p50Ms },
  p95Ms:        { prev: prev.p95Ms,            curr: curr.p95Ms,            delta: curr.p95Ms - prev.p95Ms },
  p99Ms:        { prev: prev.p99Ms,            curr: curr.p99Ms,            delta: curr.p99Ms - prev.p99Ms },
  dbPoolHigh:   { prev: prev.dbPoolHighWater,  curr: curr.dbPoolHighWater,  delta: curr.dbPoolHighWater - prev.dbPoolHighWater },
  heapDeltaMB:  { prev: prev.heapDeltaMB,      curr: curr.heapDeltaMB,      delta: curr.heapDeltaMB - prev.heapDeltaMB },
  errors:       { prev: prev.errors.length,    curr: curr.errors.length,    delta: curr.errors.length - prev.errors.length },
});

if (curr.errors.length > 0) {
  console.error(`\n⚠️  Current run had ${curr.errors.length} error(s).`);
  process.exit(1);
}

if (prev.p95Ms > 0 && curr.p95Ms > prev.p95Ms * 1.2) {
  const pct = Math.round((curr.p95Ms / prev.p95Ms - 1) * 100);
  console.error(`\n❌  p95 increased by ${pct}% (threshold: 20%) — possible regression.`);
  process.exit(1);
}

console.log("\n✅  No regression detected.");
