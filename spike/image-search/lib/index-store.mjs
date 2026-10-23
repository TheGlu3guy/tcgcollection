import fs from "node:fs";
import path from "node:path";
import { ensureDir, fileExists, readJson, writeJson } from "./common.mjs";

export function safeModelName(modelId) {
  return modelId.replaceAll("/", "__");
}

export function embeddingCachePath(root, modelId, variant, cardKey) {
  return path.join(
    root,
    "embeddings-cache",
    safeModelName(modelId),
    variant,
    `${cardKey.replaceAll(":", "__")}.f32`,
  );
}

export function readCachedEmbedding(filePath) {
  if (!fileExists(filePath)) return null;
  const buffer = fs.readFileSync(filePath);
  if (buffer.length % 4 !== 0) throw new Error(`Invalid embedding cache file: ${filePath}`);
  return new Float32Array(buffer.buffer, buffer.byteOffset, buffer.length / 4);
}

export function writeCachedEmbedding(filePath, values) {
  ensureDir(path.dirname(filePath));
  const bytes = Buffer.from(values.buffer, values.byteOffset, values.byteLength);
  fs.writeFileSync(filePath, bytes);
}

export function writeIndexFiles({ root, modelId, variant, cards, embeddings, dimension }) {
  const directory = path.join(
    root,
    "indexes",
    safeModelName(modelId),
    variant,
  );
  ensureDir(directory);

  const floatBuffer = Buffer.alloc(embeddings.length * dimension * 4);
  const int8Buffer = Buffer.alloc(embeddings.length * dimension);
  const scales = new Float32Array(embeddings.length);
  let offset = 0;
  for (let row = 0; row < embeddings.length; row += 1) {
    const embedding = embeddings[row];
    if (embedding.length !== dimension) {
      throw new Error(`Unexpected embedding dimension ${embedding.length}; expected ${dimension}.`);
    }
    let maxAbs = 0;
    for (const value of embedding) maxAbs = Math.max(maxAbs, Math.abs(value));
    const scale = maxAbs > 0 ? maxAbs / 127 : 1;
    scales[row] = scale;
    for (let column = 0; column < dimension; column += 1) {
      floatBuffer.writeFloatLE(embedding[column], offset);
      int8Buffer[row * dimension + column] = Math.max(
        -127,
        Math.min(127, Math.round(embedding[column] / scale)),
      );
      offset += 4;
    }
  }

  const floatPath = path.join(directory, "index.float32.bin");
  const int8Path = path.join(directory, "index.int8.bin");
  const scalePath = path.join(directory, "scales.float32.bin");
  const metadataPath = path.join(directory, "index.json");
  fs.writeFileSync(floatPath, floatBuffer);
  fs.writeFileSync(int8Path, int8Buffer);
  fs.writeFileSync(scalePath, Buffer.from(scales.buffer));
  const metadata = {
    modelId,
    preprocessing: variant,
    dimension,
    count: embeddings.length,
    cardKeys: cards.map((card) => card.cardKey),
    float32Bytes: floatBuffer.length,
    int8Bytes: int8Buffer.length,
    int8ScaleBytes: scales.byteLength,
    createdAt: new Date().toISOString(),
  };
  writeJson(metadataPath, metadata);
  return { directory, metadataPath, metadata };
}

export function loadIndex(root, modelId, variant) {
  const directory = path.join(root, "indexes", safeModelName(modelId), variant);
  const metadata = readJson(path.join(directory, "index.json"));
  const floatBuffer = fs.readFileSync(path.join(directory, "index.float32.bin"));
  const int8Buffer = fs.readFileSync(path.join(directory, "index.int8.bin"));
  const scaleBuffer = fs.readFileSync(path.join(directory, "scales.float32.bin"));
  return {
    directory,
    metadata,
    float32: new Float32Array(
      floatBuffer.buffer,
      floatBuffer.byteOffset,
      floatBuffer.length / 4,
    ),
    int8: new Int8Array(int8Buffer.buffer, int8Buffer.byteOffset, int8Buffer.length),
    scales: new Float32Array(
      scaleBuffer.buffer,
      scaleBuffer.byteOffset,
      scaleBuffer.length / 4,
    ),
  };
}

export function searchFloat(index, query, topK = 10) {
  const { count, dimension, cardKeys } = index.metadata;
  const scores = [];
  for (let row = 0; row < count; row += 1) {
    const start = row * dimension;
    let score = 0;
    for (let column = 0; column < dimension; column += 1) {
      score += query[column] * index.float32[start + column];
    }
    scores.push({ index: row, cardKey: cardKeys[row], score });
  }
  scores.sort((a, b) => b.score - a.score);
  return scores.slice(0, topK);
}

export function searchInt8(index, query, topK = 10) {
  const { count, dimension, cardKeys } = index.metadata;
  const scores = [];
  for (let row = 0; row < count; row += 1) {
    const start = row * dimension;
    const scale = index.scales[row];
    let dot = 0;
    let indexNormSquared = 0;
    for (let column = 0; column < dimension; column += 1) {
      const value = index.int8[start + column] * scale;
      dot += query[column] * value;
      indexNormSquared += value * value;
    }
    scores.push({
      index: row,
      cardKey: cardKeys[row],
      score: indexNormSquared > 0 ? dot / Math.sqrt(indexNormSquared) : 0,
    });
  }
  scores.sort((a, b) => b.score - a.score);
  return scores.slice(0, topK);
}
