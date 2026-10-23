import path from "node:path";
import { fileURLToPath } from "node:url";

export const ROOT = path.dirname(fileURLToPath(import.meta.url));

function envList(name, fallback) {
  const value = process.env[name]?.trim();
  return value ? value.split(",").map((item) => item.trim()).filter(Boolean) : fallback;
}

function envInt(name, fallback) {
  const value = Number(process.env[name]);
  return Number.isSafeInteger(value) && value >= 0 ? value : fallback;
}

export const config = {
  languages: envList("SPIKE_LANGUAGES", ["en"]),
  setIds: envList("SPIKE_SET_IDS", [
    "base1",
    "base4",
    "xy12",
    "cel25",
    "swsh12.5",
    "sv10.5b",
  ]),
  distractorCount: envInt("SPIKE_DISTRACTOR_COUNT", 2000),
  syntheticQueryCount: envInt("SPIKE_SYNTHETIC_QUERY_COUNT", 100),
  syntheticSeed: envInt("SPIKE_SYNTHETIC_SEED", 20261023),
  downloadConcurrency: Math.min(4, Math.max(1, envInt("SPIKE_DOWNLOAD_CONCURRENCY", 4))),
  requestDelayMs: Math.max(50, envInt("SPIKE_REQUEST_DELAY_MS", 120)),
  modelBatchSize: Math.max(1, envInt("SPIKE_MODEL_BATCH_SIZE", 8)),
  modelIds: envList("SPIKE_MODEL_IDS", [
    "Xenova/clip-vit-base-patch32",
    "Xenova/dinov2-small",
    "Xenova/mobileclip_s0",
  ]),
};

export const paths = {
  subsetDir: path.join(ROOT, "catalog-subset"),
  imageCache: path.join(ROOT, "image-cache"),
  embeddingCache: path.join(ROOT, "embeddings-cache"),
  modelCache: path.join(ROOT, "model-cache"),
  syntheticDir: path.join(ROOT, "synthetic-queries"),
  photosDir: path.join(ROOT, "photos"),
  resultsDir: path.join(ROOT, "results"),
  rawResultsDir: path.join(ROOT, "results", "raw"),
  manifestPath: path.join(ROOT, "catalog-subset", "manifest.json"),
};

export const MODEL_METADATA = {
  "Xenova/clip-vit-base-patch32": {
    label: "CLIP ViT-B/32",
    onnxFile: "onnx/vision_model.onnx",
    quantizedOnnxFile: "onnx/vision_model_quantized.onnx",
    loader: "clip",
    inputSize: 224,
  },
  "Xenova/dinov2-small": {
    label: "DINOv2 small",
    onnxFile: "onnx/model.onnx",
    quantizedOnnxFile: "onnx/model_quantized.onnx",
    loader: "dinov2",
    inputSize: 224,
  },
  "Xenova/mobileclip_s0": {
    label: "MobileCLIP S0",
    onnxFile: "onnx/vision_model.onnx",
    quantizedOnnxFile: "onnx/vision_model_quantized.onnx",
    loader: "clip",
    inputSize: 224,
  },
};
