import path from "node:path";
import { config, paths, ROOT } from "../config.mjs";
import { readJson } from "../lib/common.mjs";
import { loadIndex, searchFloat } from "../lib/index-store.mjs";
import { disposeModel, embedImages, loadModel } from "../lib/models.mjs";

const args = process.argv.slice(2);
const option = (name, fallback) => {
  const index = args.indexOf(`--${name}`);
  return index >= 0 ? args[index + 1] : fallback;
};
const photo = args.find((value, index) => !value.startsWith("--") && !args[index - 1]?.startsWith("--"));
const modelId =
  option("model", config.modelIds[0]).includes("/")
    ? option("model", config.modelIds[0])
    : config.modelIds.find((id) => id.includes(option("model", ""))) ?? config.modelIds[0];
const variant = option("preprocess", "center-crop");
const topK = Number(option("top", "10"));
if (!photo) throw new Error("Usage: node scripts/query.mjs <photo> [--model clip] [--preprocess whole|center-crop] [--top 10]");

const manifest = readJson(paths.manifestPath);
const index = loadIndex(ROOT, modelId, variant);
const handle = await loadModel(modelId);
try {
  const result = await embedImages(handle, [path.resolve(photo)], variant, { batchSize: 1 });
  const matches = searchFloat(index, result.embeddings[0], topK).map((match) => ({
    ...match,
    card: manifest.cards[match.index],
  }));
  console.log(JSON.stringify({ modelId, preprocessing: variant, matches }, null, 2));
} finally {
  await disposeModel(handle);
}
