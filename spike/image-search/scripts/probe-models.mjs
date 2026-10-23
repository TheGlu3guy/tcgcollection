import path from "node:path";
import { config, paths, ROOT } from "../config.mjs";
import { readJson } from "../lib/common.mjs";
import { disposeModel, embedImages, loadModel } from "../lib/models.mjs";

const manifest = readJson(paths.manifestPath);
const imagePaths = manifest.cards.slice(0, 4).map((card) => path.join(ROOT, card.imagePath));

for (const modelId of config.modelIds) {
  console.log(`Loading ${modelId}`);
  const handle = await loadModel(modelId);
  try {
    for (const variant of ["whole", "center-crop"]) {
      const result = await embedImages(handle, imagePaths, variant, {
        batchSize: 2,
      });
      console.log(
        `${modelId} ${variant}: dimension=${result.dimension}, avg_ms_per_image=${(
          result.latencies.reduce((sum, value) => sum + value, 0) / result.latencies.length
        ).toFixed(1)}`,
      );
    }
  } finally {
    await disposeModel(handle);
  }
}
