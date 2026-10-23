import fs from "node:fs";
import path from "node:path";
import { config, MODEL_METADATA, paths, ROOT } from "../config.mjs";
import {
  median,
  percentile,
  readJson,
  writeJson,
} from "../lib/common.mjs";
import {
  loadIndex,
  searchFloat,
  searchInt8,
} from "../lib/index-store.mjs";
import { loadRealQueries } from "../lib/labels.mjs";
import {
  disposeModel,
  embedImageTimed,
  getModelSizes,
  loadModel,
} from "../lib/models.mjs";
import { sameArtworkGroups } from "../lib/synthetic.mjs";

const FULL_CATALOG_GROUPS = 38_500;
const evaluationPath = path.join(paths.resultsDir, "evaluation.json");
const previousResults = fs.existsSync(evaluationPath)
  ? readJson(evaluationPath)
  : null;
const manifest = readJson(paths.manifestPath);
const synthetic = readJson(path.join(paths.syntheticDir, "queries.json")).queries;
const sameArtwork = sameArtworkGroups(manifest.cards);
const real = loadRealQueries({
  root: ROOT,
  manifest,
  sameArtworkGroups: sameArtwork,
});

const datasets = [
  { name: "synthetic", queries: synthetic },
  { name: "real", queries: real.queries },
];

function metrics(ranked, query, k, artwork = false) {
  const candidates = ranked.slice(0, k);
  if (!artwork) return candidates.some((item) => item.cardKey === query.cardKey) ? 1 : 0;
  const expected = new Set(query.sameArtworkKeys);
  return candidates.some((item) => expected.has(item.cardKey)) ? 1 : 0;
}

function summarizeLatency(values) {
  return {
    medianMs: median(values),
    p95Ms: percentile(values, 0.95),
  };
}

async function evaluateRun({ handle, modelId, preprocessing, dataset, index }) {
  const floatLatencies = [];
  const embeddingLatencies = [];
  const preprocessingLatencies = [];
  const failures = [];
  let exact1 = 0;
  let exact5 = 0;
  let exact10 = 0;
  let artwork1 = 0;
  let artwork5 = 0;
  let artwork10 = 0;
  let int8Exact1 = 0;
  let int8Exact5 = 0;
  let int8Exact10 = 0;
  let int8Artwork1 = 0;
  let int8Artwork5 = 0;
  let int8Artwork10 = 0;

  for (const query of dataset.queries) {
    const timed = await embedImageTimed(
      handle,
      path.join(ROOT, query.photoPath),
      preprocessing,
    );
    const searchStartedAt = performance.now();
    const floatResults = searchFloat(index, timed.embedding, 10);
    const searchMs = performance.now() - searchStartedAt;
    const int8Results = searchInt8(index, timed.embedding, 10);

    exact1 += metrics(floatResults, query, 1);
    exact5 += metrics(floatResults, query, 5);
    exact10 += metrics(floatResults, query, 10);
    artwork1 += metrics(floatResults, query, 1, true);
    artwork5 += metrics(floatResults, query, 5, true);
    artwork10 += metrics(floatResults, query, 10, true);
    int8Exact1 += metrics(int8Results, query, 1);
    int8Exact5 += metrics(int8Results, query, 5);
    int8Exact10 += metrics(int8Results, query, 10);
    int8Artwork1 += metrics(int8Results, query, 1, true);
    int8Artwork5 += metrics(int8Results, query, 5, true);
    int8Artwork10 += metrics(int8Results, query, 10, true);
    floatLatencies.push(timed.totalMs + searchMs);
    embeddingLatencies.push(timed.embeddingMs);
    preprocessingLatencies.push(timed.preprocessingMs);

    if (!metrics(floatResults, query, 5)) {
      const cause =
        dataset.name === "real"
          ? query.notes || "unclassified real-photo failure"
          : query.primaryCause;
      failures.push({
        filename: query.photoPath,
        expected: query.cardKey,
        expectedName: query.exactCard.name,
        cause,
        top3: floatResults.slice(0, 3).map((match) => ({
          cardKey: match.cardKey,
          name: manifest.cards[match.index].name,
          score: match.score,
        })),
      });
    }
  }

  const total = dataset.queries.length;
  const divide = (value) => (total ? value / total : null);
  return {
    dataset: dataset.name,
    modelId,
    modelLabel: MODEL_METADATA[modelId].label,
    preprocessing,
    queryCount: total,
    dimension: index.metadata.dimension,
    float32: {
      exactTop1: divide(exact1),
      exactTop5: divide(exact5),
      exactTop10: divide(exact10),
      sameArtworkTop1: divide(artwork1),
      sameArtworkTop5: divide(artwork5),
      sameArtworkTop10: divide(artwork10),
    },
    int8: {
      exactTop1: divide(int8Exact1),
      exactTop5: divide(int8Exact5),
      exactTop10: divide(int8Exact10),
      sameArtworkTop1: divide(int8Artwork1),
      sameArtworkTop5: divide(int8Artwork5),
      sameArtworkTop10: divide(int8Artwork10),
    },
    latency: {
      endToEnd: summarizeLatency(floatLatencies),
      preprocessing: summarizeLatency(preprocessingLatencies),
      embedding: summarizeLatency(embeddingLatencies),
    },
    failures,
  };
}

const runs = [];
const modelFileSizes = { ...(previousResults?.modelFileSizes ?? {}) };
for (const modelId of config.modelIds) {
  console.log(`Evaluating ${modelId}`);
  modelFileSizes[modelId] ??= await getModelSizes(modelId);
  const handle = await loadModel(modelId);
  try {
    for (const preprocessing of ["whole", "center-crop"]) {
      const index = loadIndex(ROOT, modelId, preprocessing);
      for (const dataset of datasets) {
        if (!dataset.queries.length) {
          runs.push({
            dataset: dataset.name,
            modelId,
            modelLabel: MODEL_METADATA[modelId].label,
            preprocessing,
            queryCount: 0,
            status: "not available: add labeled photos to photos/labels.csv",
            dimension: index.metadata.dimension,
          });
          continue;
        }
        runs.push(
          await evaluateRun({
            handle,
            modelId,
            preprocessing,
            dataset,
            index,
          }),
        );
        console.log(`  ${preprocessing} ${dataset.name}: complete`);
      }
    }
  } finally {
    await disposeModel(handle);
  }
}

const indexSizes = {};
for (const modelId of config.modelIds) {
  for (const preprocessing of ["whole", "center-crop"]) {
    const index = loadIndex(ROOT, modelId, preprocessing);
    const floatPerRow = index.metadata.dimension * 4;
    const int8PerRow = index.metadata.dimension + 4;
    indexSizes[`${modelId}|${preprocessing}`] = {
      dimension: index.metadata.dimension,
      actualFloat32Bytes: index.metadata.float32Bytes,
      actualInt8Bytes: index.metadata.int8Bytes + index.metadata.int8ScaleBytes,
      extrapolatedFloat32Bytes: floatPerRow * FULL_CATALOG_GROUPS,
      extrapolatedInt8Bytes: int8PerRow * FULL_CATALOG_GROUPS,
    };
  }
}

const result = {
  generatedAt: new Date().toISOString(),
  nodeVersion: process.version,
  catalog: {
    cards: manifest.cards.length,
    selectedSets: manifest.selectedSets,
    distractors: manifest.distractorCount,
  },
  syntheticQueryCount: synthetic.length,
  realQueryCount: real.queries.length,
  realLabelErrors: real.errors,
  modelFileSizes,
  indexSizes,
  runs,
};
writeJson(evaluationPath, result);
console.log(`Wrote ${path.relative(process.cwd(), evaluationPath)}`);
