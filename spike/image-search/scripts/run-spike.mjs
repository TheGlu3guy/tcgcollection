import { spawnSync } from "node:child_process";
import { paths, ROOT } from "../config.mjs";

const steps = [
  "scripts/build-subset.mjs",
  "scripts/generate-synthetic.mjs",
  "scripts/embed-catalog.mjs",
  "scripts/evaluate.mjs",
  "scripts/write-report.mjs",
];

for (const script of steps) {
  console.log(`Running ${script}`);
  const result = spawnSync(process.execPath, [script], {
    cwd: ROOT,
    stdio: "inherit",
    env: process.env,
  });
  if (result.status !== 0) process.exit(result.status ?? 1);
}
