import path from "node:path";
import { config, paths, ROOT } from "../config.mjs";
import { ensureDir, writeJson } from "../lib/common.mjs";
import { buildSubset } from "../lib/tcgdex.mjs";

ensureDir(paths.subsetDir);
ensureDir(paths.imageCache);
const manifest = await buildSubset({ config, paths: { ...paths, root: ROOT } });
writeJson(paths.manifestPath, manifest);
console.log(
  `Wrote ${manifest.cards.length} cards (${manifest.distractorCount} distractors) to ${path.relative(process.cwd(), paths.manifestPath)}`,
);
