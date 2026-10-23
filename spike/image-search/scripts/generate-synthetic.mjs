import fs from "node:fs";
import path from "node:path";
import { config, paths, ROOT } from "../config.mjs";
import {
  createRng,
  ensureDir,
  normalizeName,
  readJson,
  shuffle,
  writeJson,
} from "../lib/common.mjs";
import { generateSyntheticImage, sameArtworkGroups } from "../lib/synthetic.mjs";

const manifest = readJson(paths.manifestPath);
const candidates = manifest.cards.filter((card) => !card.isDistractor);
const groups = sameArtworkGroups(manifest.cards);
const rng = createRng(config.syntheticSeed + 1);
const shuffled = shuffle(candidates, rng).slice(0, config.syntheticQueryCount);
ensureDir(paths.syntheticDir);

const queries = [];
const causes = ["tilted", "holo/glare", "lighting", "background/perspective"];
for (let index = 0; index < shuffled.length; index += 1) {
  const card = shuffled[index];
  const filename = `query-${String(index + 1).padStart(3, "0")}.jpg`;
  const target = path.join(paths.syntheticDir, filename);
  const perturbation = await generateSyntheticImage(
    path.join(ROOT, card.imagePath),
    target,
    rng,
  );
  const artworkKey = card.artist
    ? `${normalizeName(card.name)}|${normalizeName(card.artist)}`
    : `${normalizeName(card.name)}|missing-artist`;
  queries.push({
    id: `synthetic-${index + 1}`,
    photoPath: path.relative(ROOT, target).split(path.sep).join("/"),
    cardKey: card.cardKey,
    exactCard: card,
    sameArtworkKeys: groups.get(artworkKey) ?? [card.cardKey],
    perturbation,
    primaryCause: causes[index % causes.length],
  });
  if ((index + 1) % 25 === 0 || index + 1 === shuffled.length) {
    console.log(`Synthetic photos ${index + 1}/${shuffled.length}`);
  }
}
writeJson(path.join(paths.syntheticDir, "queries.json"), {
  createdAt: new Date().toISOString(),
  seed: config.syntheticSeed,
  queries,
});
