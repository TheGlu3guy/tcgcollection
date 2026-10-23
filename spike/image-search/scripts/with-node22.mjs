import { spawnSync } from "node:child_process";
import path from "node:path";

const executable =
  process.platform === "win32"
    ? path.join("node_modules", "node", "bin", "node.exe")
    : path.join("node_modules", "node", "bin", "node");
const result = spawnSync(executable, process.argv.slice(2), {
  stdio: "inherit",
  env: process.env,
});
if (result.error) {
  console.error(`Could not launch the pinned Node 22 runtime: ${result.error.message}`);
  process.exit(1);
}
process.exit(result.status ?? 1);
