import path from "node:path";
import { config, paths, ROOT } from "../config.mjs";
import { readJson } from "../lib/common.mjs";
import {
  embeddingCachePath,
  readCachedEmbedding,
  writeCachedEmbedding,
  writeIndexFiles,
} from "../lib/index-store.mjs";
import { disposeModel, embedImages, loadModel } from "../lib/models.mjs";
import { PREPROCESSING_VARIANTS } from "../lib/preprocess.mjs";
import { assertCachedImages } from "../lib/tcgdex.mjs";

const manifest = readJson(paths.manifestPath);
assertCachedImages(manifest, ROOT);

for (const modelId of config.modelIds) {
  const handle = await loadModel(modelId);
  try {
    for (const variant of PREPROCESSING_VARIANTS) {
      const embeddings = new Array(manifest.cards.length);
      const missingIndices = [];
      for (let index = 0; index < manifest.cards.length; index += 1) {
        const card = manifest.cards[index];
        const cachePath = embeddingCachePath(ROOT, modelId, variant, card.cardKey);
        const cached = readCachedEmbedding(cachePath);
        if (cached) embeddings[index] = cached;
        else missingIndices.push(index);
      }
      console.log(
        `${modelId} ${variant}: ${manifest.cards.length - missingIndices.length} cached, ${missingIndices.length} pending`,
      );
      for (let offset = 0; offset < missingIndices.length; offset += config.modelBatchSize) {
        const batchIndices = missingIndices.slice(offset, offset + config.modelBatchSize);
        const result = await embedImages(
          handle,
          batchIndices.map((index) => path.join(ROOT, manifest.cards[index].imagePath)),
          variant,
          { batchSize: config.modelBatchSize },
        );
        batchIndices.forEach((cardIndex, batchIndex) => {
          const embedding = result.embeddings[batchIndex];
          embeddings[cardIndex] = embedding;
          writeCachedEmbedding(
            embeddingCachePath(
              ROOT,
              modelId,
              variant,
              manifest.cards[cardIndex].cardKey,
            ),
            embedding,
          );
        });
        const completed = Math.min(offset + batchIndices.length, missingIndices.length);
        if (completed % 160 === 0 || completed === missingIndices.length) {
          console.log(`${modelId} ${variant}: ${completed}/${missingIndices.length}`);
        }
      }
      const indexResult = writeIndexFiles({
        root: ROOT,
        modelId,
        variant,
        cards: manifest.cards,
        embeddings,
        dimension: embeddings[0].length,
      });
      console.log(
        `${modelId} ${variant}: wrote index for ${embeddings.length} cards, ${indexResult.metadata.dimension} dimensions`,
      );
    }
  } finally {
    await disposeModel(handle);
  }
}
