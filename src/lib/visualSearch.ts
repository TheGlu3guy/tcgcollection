import type { CatalogCard } from "../types";

const MODEL_ID = "Xenova/dinov2-small";
const MODEL_INPUT_SIZE = 224;
const TOP_RESULTS = 5;

interface VisualSearchManifestCard {
  cardKey: string;
  cardId: string;
  language: CatalogCard["language"];
  name: string;
  setId: string;
  setName: string;
  localId: string;
  setTotal: number;
  artist: string | null;
  imageUrl: string;
}

interface VisualSearchManifest {
  cards: VisualSearchManifestCard[];
}

interface VisualSearchIndexMetadata {
  modelId: string;
  preprocessing: string;
  dimension: number;
  count: number;
  cardKeys: string[];
}

interface VisualSearchAssets {
  manifest: VisualSearchManifest;
  metadata: VisualSearchIndexMetadata;
  int8: Int8Array;
  scales: Float32Array;
}

interface VisualSearchEngine {
  processor: {
    (images: unknown[]): Promise<unknown>;
  };
  model: {
    (inputs: unknown): Promise<Record<string, { data: Float32Array; dims: number[] }>>;
  };
  RawImage: new (
    data: Uint8ClampedArray,
    width: number,
    height: number,
    channels: 3 | 4,
  ) => { rgb(): unknown };
}

export interface VisualSearchResult {
  card: CatalogCard;
  score: number;
}

export interface VisualSearchProgress {
  phase: "model" | "search";
  percent: number | null;
  message: string;
}

let assetsPromise: Promise<VisualSearchAssets> | null = null;
let enginePromise: Promise<VisualSearchEngine> | null = null;

function assetUrl(relativePath: string): string {
  return new URL(
    `${import.meta.env.BASE_URL}image-search/${relativePath}`,
    window.location.href,
  ).href;
}

async function loadVisualSearchAssets(): Promise<VisualSearchAssets> {
  const [manifest, metadata, int8Response, scaleResponse] = await Promise.all([
    fetch(assetUrl("manifest.json")).then((response) => {
      if (!response.ok) throw new Error(`Manifest returned HTTP ${response.status}.`);
      return response.json() as Promise<VisualSearchManifest>;
    }),
    fetch(assetUrl("dinov2-small/whole/index.json")).then((response) => {
      if (!response.ok) throw new Error(`Index metadata returned HTTP ${response.status}.`);
      return response.json() as Promise<VisualSearchIndexMetadata>;
    }),
    fetch(assetUrl("dinov2-small/whole/index.int8.bin")),
    fetch(assetUrl("dinov2-small/whole/scales.float32.bin")),
  ]);
  if (!int8Response.ok || !scaleResponse.ok) {
    throw new Error("The image-search index could not be loaded.");
  }
  const int8Buffer = await int8Response.arrayBuffer();
  const scaleBuffer = await scaleResponse.arrayBuffer();
  const expectedBytes = metadata.count * metadata.dimension;
  if (int8Buffer.byteLength !== expectedBytes) {
    throw new Error(
      `Image-search index size mismatch: ${int8Buffer.byteLength} bytes for ${metadata.count} × ${metadata.dimension}.`,
    );
  }
  return {
    manifest,
    metadata,
    int8: new Int8Array(int8Buffer),
    scales: new Float32Array(scaleBuffer),
  };
}

async function loadVisualSearchEngine(
  onProgress: (progress: VisualSearchProgress) => void,
): Promise<VisualSearchEngine> {
  const { AutoImageProcessor, AutoModel, env, RawImage } = await import(
    "@huggingface/transformers"
  );
  env.allowLocalModels = false;
  env.allowRemoteModels = true;
  env.useBrowserCache = true;

  const progressCallback = (event: {
    status?: string;
    file?: string;
    progress?: number;
    loaded?: number;
    total?: number;
  }) => {
    const percent =
      typeof event.progress === "number"
        ? event.progress
        : typeof event.loaded === "number" && typeof event.total === "number" && event.total > 0
          ? (event.loaded / event.total) * 100
          : null;
    onProgress({
      phase: "model",
      percent,
      message:
        event.status === "ready"
          ? "Model ready"
          : `Loading DINOv2${event.file ? ` · ${event.file}` : ""}`,
    });
  };

  const [processor, model] = await Promise.all([
    AutoImageProcessor.from_pretrained(MODEL_ID, {
      progress_callback: progressCallback,
    }),
    AutoModel.from_pretrained(MODEL_ID, {
      dtype: "q8",
      progress_callback: progressCallback,
    }),
  ]);
  return {
    processor: processor as VisualSearchEngine["processor"],
    model: model as unknown as VisualSearchEngine["model"],
    RawImage: RawImage as VisualSearchEngine["RawImage"],
  };
}

async function fileToRawImage(
  file: File,
  RawImage: VisualSearchEngine["RawImage"],
) {
  const bitmap = await createImageBitmap(file, {
    imageOrientation: "from-image",
  });
  try {
    const canvas =
      typeof OffscreenCanvas !== "undefined"
        ? new OffscreenCanvas(MODEL_INPUT_SIZE, MODEL_INPUT_SIZE)
        : Object.assign(document.createElement("canvas"), {
            width: MODEL_INPUT_SIZE,
            height: MODEL_INPUT_SIZE,
          });
    const context = canvas.getContext("2d", { willReadFrequently: true });
    if (!context) throw new Error("The browser could not create an image canvas.");
    context.drawImage(bitmap, 0, 0, MODEL_INPUT_SIZE, MODEL_INPUT_SIZE);
    const imageData = context.getImageData(0, 0, MODEL_INPUT_SIZE, MODEL_INPUT_SIZE);
    return new RawImage(
      new Uint8ClampedArray(imageData.data),
      MODEL_INPUT_SIZE,
      MODEL_INPUT_SIZE,
      4,
    ).rgb();
  } finally {
    bitmap.close();
  }
}

function normalize(values: ArrayLike<number>): Float32Array {
  const normalized = Float32Array.from(values);
  let squaredNorm = 0;
  for (const value of normalized) squaredNorm += value * value;
  const norm = Math.sqrt(squaredNorm);
  if (!Number.isFinite(norm) || norm <= 0) {
    throw new Error("The model returned an invalid image embedding.");
  }
  for (let index = 0; index < normalized.length; index += 1) {
    normalized[index] /= norm;
  }
  return normalized;
}

function modelEmbedding(output: Record<string, { data: Float32Array; dims: number[] }>) {
  const tensor = output.pooler_output ?? output.last_hidden_state;
  if (!tensor) throw new Error("DINOv2 returned no image features.");
  const dimension = tensor.dims.at(-1);
  if (!dimension) throw new Error("DINOv2 returned an invalid feature shape.");
  return normalize(tensor.data.slice(0, dimension));
}

function manifestCardToCatalogCard(card: VisualSearchManifestCard): CatalogCard {
  return {
    key: card.cardKey,
    groupKey: `${card.setId.toLocaleLowerCase()}:${card.localId.toLocaleLowerCase()}`,
    id: card.cardId,
    localId: card.localId,
    name: card.name,
    searchName: `${card.name} ${card.cardId} ${card.localId}`.toLocaleLowerCase(),
    image: card.imageUrl,
    language: card.language,
    languageLabel: card.language === "en" ? "English" : card.language.toLocaleUpperCase(),
    region: "International",
    setId: card.setId,
    setName: card.setName,
    setSeries: "Image search",
    setTotal: card.setTotal,
    artist: card.artist ?? undefined,
  };
}

export async function searchCardsByImage(
  file: File,
  catalogCards: CatalogCard[],
  onProgress: (progress: VisualSearchProgress) => void,
): Promise<VisualSearchResult[]> {
  onProgress({ phase: "model", percent: null, message: "Loading search index" });
  assetsPromise ??= loadVisualSearchAssets();
  let assets: VisualSearchAssets;
  try {
    assets = await assetsPromise;
  } catch (reason) {
    assetsPromise = null;
    throw reason;
  }
  enginePromise ??= loadVisualSearchEngine(onProgress);
  let engine: VisualSearchEngine;
  try {
    engine = await enginePromise;
  } catch (reason) {
    enginePromise = null;
    throw reason;
  }

  onProgress({ phase: "search", percent: null, message: "Reading photo" });
  const image = await fileToRawImage(file, engine.RawImage);
  const inputs = await engine.processor([image]);
  onProgress({ phase: "search", percent: null, message: "Generating visual embedding" });
  const output = await engine.model(inputs);
  const query = modelEmbedding(output);
  if (query.length !== assets.metadata.dimension) {
    throw new Error(
      `Embedding dimension mismatch: model ${query.length}, index ${assets.metadata.dimension}.`,
    );
  }

  const results: Array<{ index: number; cardKey: string; score: number }> = [];
  const { count, dimension } = assets.metadata;
  for (let row = 0; row < count; row += 1) {
    const offset = row * dimension;
    const scale = assets.scales[row];
    let dot = 0;
    let indexedNormSquared = 0;
    for (let column = 0; column < dimension; column += 1) {
      const value = assets.int8[offset + column] * scale;
      dot += query[column] * value;
      indexedNormSquared += value * value;
    }
    results.push({
      index: row,
      cardKey: assets.metadata.cardKeys[row],
      score: indexedNormSquared > 0 ? dot / Math.sqrt(indexedNormSquared) : 0,
    });
  }
  results.sort((left, right) => right.score - left.score);

  const cardsByKey = new Map(catalogCards.map((card) => [card.key, card]));
  return results.slice(0, TOP_RESULTS).map((result) => {
    const manifestCard = assets.manifest.cards[result.index];
    return {
      card: cardsByKey.get(result.cardKey) ?? manifestCardToCatalogCard(manifestCard),
      score: result.score,
    };
  });
}
