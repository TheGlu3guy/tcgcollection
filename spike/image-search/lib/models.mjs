import fs from "node:fs";
import path from "node:path";
import {
  AutoImageProcessor,
  AutoModel,
  AutoProcessor,
  CLIPVisionModelWithProjection,
  env,
} from "@huggingface/transformers";
import { MODEL_METADATA, paths } from "../config.mjs";
import { ensureDir } from "./common.mjs";
import { normalizeVector, prepareImage } from "./preprocess.mjs";

ensureDir(paths.modelCache);
env.cacheDir = paths.modelCache;
env.allowLocalModels = false;
env.useBrowserCache = false;

function processorSize(processor) {
  const imageProcessor = processor.image_processor ?? processor;
  const size = imageProcessor.size;
  if (typeof size === "number") return size;
  return size?.shortest_edge ?? size?.height ?? size?.width ?? 224;
}

function embeddingRows(output, batchSize) {
  if (output.image_embeds) {
    return {
      data: output.image_embeds.data,
      dimensions: output.image_embeds.dims.at(-1),
      batchSize,
      stride: output.image_embeds.dims.at(-1),
    };
  }
  if (output.pooler_output) {
    return {
      data: output.pooler_output.data,
      dimensions: output.pooler_output.dims.at(-1),
      batchSize,
      stride: output.pooler_output.dims.at(-1),
    };
  }
  if (output.last_hidden_state) {
    const dims = output.last_hidden_state.dims;
    const dimension = dims.at(-1);
    const sequence = dims.at(-2);
    return {
      data: output.last_hidden_state.data,
      dimensions: dimension,
      batchSize,
      stride: sequence * dimension,
      sequence,
    };
  }
  throw new Error("Model output did not include image embeddings or hidden states.");
}

export async function loadModel(modelId) {
  const metadata = MODEL_METADATA[modelId];
  if (!metadata) throw new Error(`No spike metadata configured for ${modelId}.`);
  const processor =
    metadata.loader === "clip"
      ? await AutoProcessor.from_pretrained(modelId)
      : await AutoImageProcessor.from_pretrained(modelId);
  const model =
    metadata.loader === "clip"
      ? await CLIPVisionModelWithProjection.from_pretrained(modelId, { dtype: "q8" })
      : await AutoModel.from_pretrained(modelId, { dtype: "q8" });
  return {
    modelId,
    metadata,
    processor,
    model,
    inputSize: processorSize(processor),
  };
}

export async function embedImages(handle, imagePaths, variant, options = {}) {
  const batchSize = options.batchSize ?? 8;
  const embeddings = [];
  const latencies = [];
  for (let offset = 0; offset < imagePaths.length; offset += batchSize) {
    const batchPaths = imagePaths.slice(offset, offset + batchSize);
    const startedAt = performance.now();
    const images = await Promise.all(
      batchPaths.map((imagePath) =>
        prepareImage(imagePath, handle.inputSize, variant),
      ),
    );
    const inputs = await handle.processor(images);
    const output = await handle.model(inputs);
    const rows = embeddingRows(output, images.length);
    for (let batchIndex = 0; batchIndex < images.length; batchIndex += 1) {
      const start = batchIndex * rows.stride;
      const values =
        rows.sequence !== undefined
          ? rows.data.slice(start, start + rows.dimensions)
          : rows.data.slice(start, start + rows.dimensions);
      embeddings.push(normalizeVector(values));
    }
    latencies.push((performance.now() - startedAt) / images.length);
  }
  return { embeddings, latencies, dimension: embeddings[0]?.length ?? 0 };
}

export async function embedImageTimed(handle, imagePath, variant) {
  const totalStartedAt = performance.now();
  const prepared = await prepareImage(imagePath, handle.inputSize, variant);
  const preprocessingMs = performance.now() - totalStartedAt;
  const inputs = await handle.processor([prepared]);
  const modelStartedAt = performance.now();
  const output = await handle.model(inputs);
  const embeddingMs = performance.now() - modelStartedAt;
  const rows = embeddingRows(output, 1);
  const values =
    rows.sequence !== undefined
      ? rows.data.slice(0, rows.dimensions)
      : rows.data.slice(0, rows.dimensions);
  return {
    embedding: normalizeVector(values),
    preprocessingMs,
    embeddingMs,
    totalMs: performance.now() - totalStartedAt,
  };
}

export async function disposeModel(handle) {
  await handle.model.dispose?.();
}

export async function getModelSizes(modelId) {
  const metadata = MODEL_METADATA[modelId];
  async function headSize(file) {
    const response = await fetch(
      `https://huggingface.co/${modelId}/resolve/main/${file}`,
      { method: "HEAD", redirect: "follow" },
    );
    if (!response.ok) throw new Error(`HEAD ${file} returned ${response.status}`);
    return Number(response.headers.get("x-linked-size") ?? response.headers.get("content-length"));
  }
  const [quantizedModelBytes, fullModelBytes] = await Promise.all([
    headSize(metadata.quantizedOnnxFile),
    headSize(metadata.onnxFile),
  ]);
  return { quantizedModelBytes, fullModelBytes };
}
