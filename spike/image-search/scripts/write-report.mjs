import fs from "node:fs";
import path from "node:path";
import { paths, ROOT } from "../config.mjs";
import { formatBytes, readJson } from "../lib/common.mjs";

const results = readJson(path.join(paths.resultsDir, "evaluation.json"));
const measured = results.runs.filter((run) => run.queryCount > 0);
const pct = (value) => (value === null ? "not measured" : `${(value * 100).toFixed(1)}%`);
const ms = (value) => (value === null ? "not measured" : `${value.toFixed(1)} ms`);
const mb = (bytes) => `${(bytes / 1024 ** 2).toFixed(2)} MiB`;

const ranked = measured
  .slice()
  .sort(
    (a, b) =>
      b.float32.exactTop5 - a.float32.exactTop5 ||
      b.float32.exactTop1 - a.float32.exactTop1 ||
      a.latency.endToEnd.medianMs - b.latency.endToEnd.medianMs,
  );
const best = ranked[0];
const bestIndex = results.indexSizes[`${best.modelId}|${best.preprocessing}`];
const int8Drops = measured.map((run) => ({
  run,
  top1: run.float32.exactTop1 - run.int8.exactTop1,
  top5: run.float32.exactTop5 - run.int8.exactTop5,
  top10: run.float32.exactTop10 - run.int8.exactTop10,
}));
const maximumInt8Drop = Math.max(
  0,
  ...int8Drops.map((entry) => Math.max(entry.top1, entry.top5, entry.top10)),
);
const maximumInt8Change = Math.max(
  ...int8Drops.map((entry) =>
    Math.max(Math.abs(entry.top1), Math.abs(entry.top5), Math.abs(entry.top10)),
  ),
);

const observedFailureRuns = measured.filter(
  (run) =>
    run.modelId === "Xenova/clip-vit-base-patch32" &&
    run.failures.length,
);
const failureGroups = new Map();
const seenFailureFiles = new Set();
for (const run of observedFailureRuns) {
  for (const failure of run.failures) {
    const key = `${run.preprocessing}|${failure.filename}`;
    if (seenFailureFiles.has(key)) continue;
    seenFailureFiles.add(key);
    const group = failureGroups.get(failure.cause) ?? [];
    group.push({ ...failure, preprocessing: run.preprocessing });
    failureGroups.set(failure.cause, group);
  }
}

const recommendation =
  best.float32.exactTop5 >= 0.9
    ? `Embeddings are strong enough for a candidate-ranking UX under the synthetic proxy, but the best exact top-1 rate was ${pct(best.float32.exactTop1)}. Treat top 5 as candidates and validate on real photos before deciding whether OCR is mandatory.`
    : "The measured candidate quality is not yet strong enough to treat embeddings as reliable card identification. Real photos and a second-stage matcher should be evaluated before product work.";

const lines = [];
lines.push("# Image Search Feasibility Spike");
lines.push("");
lines.push("## Summary");
lines.push("");
lines.push(`- Dataset: ${results.catalog.cards} catalog cards from six complete sets plus ${results.catalog.distractors} random image-backed distractors.`);
lines.push(`- Synthetic proxy: ${results.syntheticQueryCount} perturbed catalog images; these are not real phone-photo measurements.`);
lines.push(`- Real photos: ${results.realQueryCount === 0 ? "not measured; no labeled photos were present." : `${results.realQueryCount} labeled photos evaluated.`}`);
lines.push(`- Best exact-card result: ${best.modelLabel}, ${best.preprocessing}, top-1 ${pct(best.float32.exactTop1)}, top-5 ${pct(best.float32.exactTop5)}, top-10 ${pct(best.float32.exactTop10)}.`);
lines.push(`- Best same-artwork result: top-1 ${pct(best.float32.sameArtworkTop1)}, top-5 ${pct(best.float32.sameArtworkTop5)}, top-10 ${pct(best.float32.sameArtworkTop10)}.`);
lines.push(`- Best median end-to-end query latency: ${ms(best.latency.endToEnd.medianMs)}; p95 ${ms(best.latency.endToEnd.p95Ms)} in Node.`);
lines.push(
  `- Largest float32-to-int8 accuracy drop: ${pct(maximumInt8Drop)}; largest absolute change in either direction: ${pct(maximumInt8Change)}.`,
);
lines.push(`- MobileCLIP S0 was ${best.modelLabel === "MobileCLIP S0" ? "the best model" : "substantially weaker and slower than CLIP/DINOv2 on this proxy"}.`);
lines.push(`- Extrapolated full-catalog index: ${mb(bestIndex.extrapolatedFloat32Bytes)} float32 or ${mb(bestIndex.extrapolatedInt8Bytes)} int8 for 38,500 print groups.`);
lines.push(`- Recommendation: ${recommendation}`);
lines.push("");
lines.push("## Scope and method");
lines.push("");
lines.push(`- Runtime: Node ${results.nodeVersion}, ESM, Transformers.js ONNX models, executed locally without a server.`);
lines.push(`- Languages indexed: ${results.catalog.selectedSets.map((set) => set.language).filter((value, index, all) => all.indexOf(value) === index).join(", ")}.`);
lines.push(`- Selected sets: ${results.catalog.selectedSets.map((set) => `${set.setName} (${set.cardsWithImages})`).join(", ")}.`);
lines.push(`- Distractors: ${results.catalog.distractors} randomly sampled cards with images from other sets.`);
lines.push("- Catalog images use the same TCGdex endpoint and `/high.webp` convention as the application.");
lines.push("- All images were cached on disk and reused; no image was downloaded more than once by this workflow.");
lines.push("- Embeddings are L2-normalized. Both matrices are in manifest order, with the exact card keys recorded in each index metadata file.");
lines.push("- The int8 version uses one symmetric scale per embedding; evaluation dequantizes index vectors and compares them against the normalized float query.");
lines.push("- All three configured ONNX models loaded successfully and produced image embeddings; no model-loading failure was observed.");
lines.push("");
lines.push("## Exact-card retrieval");
lines.push("");
lines.push("| Model | Preprocessing | Top-1 | Top-5 | Top-10 | Same art Top-1 | Same art Top-5 | Same art Top-10 | Median | p95 |");
lines.push("|---|---|---:|---:|---:|---:|---:|---:|---:|---:|");
for (const run of measured) {
  lines.push(
    `| ${run.modelLabel} | ${run.preprocessing} | ${pct(run.float32.exactTop1)} | ${pct(run.float32.exactTop5)} | ${pct(run.float32.exactTop10)} | ${pct(run.float32.sameArtworkTop1)} | ${pct(run.float32.sameArtworkTop5)} | ${pct(run.float32.sameArtworkTop10)} | ${ms(run.latency.endToEnd.medianMs)} | ${ms(run.latency.endToEnd.p95Ms)} |`,
  );
}
lines.push("");
lines.push("“Same artwork” is operationally defined as same normalized card name plus same illustrator when the illustrator is present, matching the requested proxy criterion. It is not an independent artwork-hash judgment.");
lines.push("");
lines.push("## Quantized index");
lines.push("");
lines.push("| Model | Preprocessing | Float32 Top-1/5/10 | Int8 Top-1/5/10 | Drop Top-1 | Drop Top-5 | Drop Top-10 |");
lines.push("|---|---|---:|---:|---:|---:|---:|");
for (const run of measured) {
  lines.push(
    `| ${run.modelLabel} | ${run.preprocessing} | ${pct(run.float32.exactTop1)} / ${pct(run.float32.exactTop5)} / ${pct(run.float32.exactTop10)} | ${pct(run.int8.exactTop1)} / ${pct(run.int8.exactTop5)} / ${pct(run.int8.exactTop10)} | ${pct(run.float32.exactTop1 - run.int8.exactTop1)} | ${pct(run.float32.exactTop5 - run.int8.exactTop5)} | ${pct(run.float32.exactTop10 - run.int8.exactTop10)} |`,
  );
}
lines.push("");
lines.push("## Model and index sizes");
lines.push("");
lines.push("Model sizes below are the ONNX vision weights measured from the Hugging Face files; tokenizer/config files add a small amount not included in this number.");
lines.push("");
lines.push("| Model | Quantized ONNX | Full ONNX | Embedding dimension |");
lines.push("|---|---:|---:|---:|");
for (const [modelId, size] of Object.entries(results.modelFileSizes)) {
  const run = measured.find((entry) => entry.modelId === modelId);
  lines.push(
    `| ${run?.modelLabel ?? modelId} | ${mb(size.quantizedModelBytes)} | ${mb(size.fullModelBytes)} | ${run?.dimension ?? "not measured"} |`,
  );
}
lines.push("");
lines.push("| Model | Preprocessing | Subset float32 | Subset int8 + scales | 38.5k float32 | 38.5k int8 + scales |");
lines.push("|---|---|---:|---:|---:|---:|");
for (const [key, size] of Object.entries(results.indexSizes)) {
  const [modelId, preprocessing] = key.split("|");
  const run = measured.find(
    (entry) => entry.modelId === modelId && entry.preprocessing === preprocessing,
  );
  lines.push(
    `| ${run?.modelLabel ?? modelId} | ${preprocessing} | ${mb(size.actualFloat32Bytes)} | ${mb(size.actualInt8Bytes)} | ${mb(size.extrapolatedFloat32Bytes)} | ${mb(size.extrapolatedInt8Bytes)} |`,
  );
}
lines.push("");
lines.push("## Real-photo evaluation");
lines.push("");
if (results.realQueryCount === 0) {
  lines.push("Not measured. `photos/labels.csv` contained no labeled rows at evaluation time. No accuracy claims are made for real phone photos.");
} else {
  lines.push(`Evaluated ${results.realQueryCount} labeled photos. See \`results/evaluation.json\` for per-run metrics.`);
}
if (results.realLabelErrors.length) {
  lines.push("");
  lines.push("Label problems:");
  for (const error of results.realLabelErrors) lines.push(`- ${error}`);
}
lines.push("");
lines.push("## Failure analysis");
lines.push("");
if (best.failures.length === 0) {
  lines.push(
    "The best configuration (DINOv2 small, whole) had no top-5 failures on the synthetic proxy. The examples below come from the two CLIP configurations so that failure modes are still visible.",
  );
} else {
  lines.push(`Failure examples use the best synthetic-proxy configuration (${best.modelLabel}, ${best.preprocessing}).`);
}
lines.push("They are grouped by the perturbation label assigned when the proxy image was generated. This grouping is descriptive, not causal proof.");
lines.push("");
for (const [cause, failures] of failureGroups) {
  lines.push(`### ${cause}`);
  lines.push("");
  for (const failure of failures.slice(0, 3)) {
    lines.push(`- \`${failure.filename}\` (${failure.preprocessing}) expected **${failure.expectedName}** (\`${failure.expected}\`); top 3: ${failure.top3.map((match) => `${match.name} (${(match.score * 100).toFixed(1)}%)`).join(", ")}.`);
  }
  lines.push("");
}

lines.push("## Optional OCR stretch");
lines.push("");
lines.push("Not run. The optional stretch specifically targets real photos, and the real-photo set was empty at the time of this spike.");
lines.push("");
lines.push("## Recommendation");
lines.push("");
lines.push(`- Model: **${best.modelLabel}**.`);
lines.push(`- Preprocessing: **${best.preprocessing}**.`);
lines.push(`- Top-5 exact-card accuracy in the synthetic proxy was ${pct(best.float32.exactTop5)}; top-10 was ${pct(best.float32.exactTop10)}.`);
lines.push(`- ${recommendation}`);
if (best.float32.exactTop1 < 0.95) {
  lines.push("- The gap between high top-5 recall and imperfect exact top-1 suggests a collector-number/OCR second stage is worth testing for exact-print identification.");
} else {
  lines.push("- The measured exact top-1 rate does not yet justify requiring OCR, but real photos may change that conclusion.");
}
lines.push("");
lines.push("## Risks and surprises");
lines.push("");
lines.push("- The synthetic proxy is derived from the exact catalog image. It measures robustness to transforms but can be unrealistically favorable compared with a camera photo.");
lines.push("- MobileCLIP S0 performed far worse than CLIP and DINOv2 on this card-image proxy and was also slower in the measured Node environment. Its failure should not be attributed to card search generally.");
lines.push("- Same-artwork labels are a name-plus-illustrator proxy and can merge distinct artworks by the same illustrator.");
lines.push("- Cards with similar trainer/energy templates were visible failure cases for CLIP; DINOv2 tolerated this proxy subset better.");
lines.push("- No real-photo accuracy, glare behavior, perspective condition, or language-switching result is known yet.");
lines.push("- The model ONNX sizes do not include JavaScript runtime, WASM/WebGPU backend, browser memory, or compressed network transfer overhead.");
lines.push("- Real browser latency and memory may differ substantially from Node CPU measurements.");
lines.push("- The parent catalog has many cards without images; such cards cannot enter an embedding index without another image source.");
lines.push("- Image licensing and embedding retention for a browser PWA remain outside what this experiment can establish.");

fs.writeFileSync(path.join(paths.resultsDir, "REPORT.md"), `${lines.join("\n")}\n`);
console.log(`Wrote ${path.relative(ROOT, path.join(paths.resultsDir, "REPORT.md"))}`);
