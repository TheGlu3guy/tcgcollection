import {
  CATALOG_CACHE_KEY,
  CATALOG_VERSION,
  LANGUAGE_BY_CODE,
  LANGUAGES,
} from "./constants";
import type {
  CardDetail,
  Catalog,
  CatalogCard,
  CatalogSet,
  LanguageCode,
  RawCardSummary,
  RawSet,
} from "../types";

const API_ROOT = "https://api.tcgdex.net/v2";
const CACHE_TTL_MS = 1000 * 60 * 60 * 24 * 7;
const IDB_NAME = "tcgcollection";
const IDB_STORE = "catalog";

interface LanguageData {
  language: LanguageCode;
  sets: RawSet[];
  cards: RawCardSummary[];
}

interface GraphqlSetsResponse {
  data?: {
    sets?: RawSet[];
  };
  errors?: { message: string }[];
}

interface CacheEnvelope {
  key: string;
  catalog: Catalog;
}

function openDatabase(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(IDB_NAME, 1);
    request.onupgradeneeded = () => {
      const database = request.result;
      if (!database.objectStoreNames.contains(IDB_STORE)) {
        database.createObjectStore(IDB_STORE, { keyPath: "key" });
      }
    };
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

async function readCatalogCache(): Promise<Catalog | null> {
  const database = await openDatabase();
  return new Promise((resolve, reject) => {
    const transaction = database.transaction(IDB_STORE, "readonly");
    const request = transaction.objectStore(IDB_STORE).get(CATALOG_CACHE_KEY);
    request.onsuccess = () => {
      const entry = request.result as CacheEnvelope | undefined;
      resolve(entry?.catalog ?? null);
    };
    request.onerror = () => reject(request.error);
    transaction.oncomplete = () => database.close();
  });
}

async function writeCatalogCache(catalog: Catalog): Promise<void> {
  const database = await openDatabase();
  return new Promise((resolve, reject) => {
    const transaction = database.transaction(IDB_STORE, "readwrite");
    transaction.objectStore(IDB_STORE).put({ key: CATALOG_CACHE_KEY, catalog });
    transaction.oncomplete = () => {
      database.close();
      resolve();
    };
    transaction.onerror = () => reject(transaction.error);
  });
}

async function clearCatalogCache(): Promise<void> {
  const database = await openDatabase();
  return new Promise((resolve, reject) => {
    const transaction = database.transaction(IDB_STORE, "readwrite");
    transaction.objectStore(IDB_STORE).delete(CATALOG_CACHE_KEY);
    transaction.oncomplete = () => {
      database.close();
      resolve();
    };
    transaction.onerror = () => reject(transaction.error);
  });
}

async function getJson<T>(url: string, signal?: AbortSignal): Promise<T> {
  const response = await fetch(url, { signal });
  if (!response.ok) {
    throw new Error(`${response.status} ${response.statusText}`);
  }
  return response.json() as Promise<T>;
}

async function fetchLanguage(
  language: LanguageCode,
  signal: AbortSignal,
): Promise<LanguageData> {
  const [sets, cards] = await Promise.all([
    getJson<RawSet[]>(`${API_ROOT}/${language}/sets`, signal),
    getJson<RawCardSummary[]>(`${API_ROOT}/${language}/cards`, signal),
  ]);
  return { language, sets, cards };
}

async function fetchGlobalSetMetadata(signal: AbortSignal): Promise<RawSet[]> {
  const query =
    "{ sets { id name releaseDate logo symbol cardCount { total official } serie { id name } } }";
  const response = await fetch(`${API_ROOT}/graphql`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ query }),
    signal,
  });
  if (!response.ok) throw new Error(`${response.status} ${response.statusText}`);
  const result = (await response.json()) as GraphqlSetsResponse;
  if (!result.data?.sets) {
    throw new Error(result.errors?.[0]?.message ?? "Set metadata was unavailable.");
  }
  return result.data.sets;
}

function normalize(key: string): string {
  return key
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLocaleLowerCase();
}

function findSetForCard(card: RawCardSummary, sets: RawSet[]): RawSet | undefined {
  const normalizedId = card.id.toLocaleLowerCase();
  return sets
    .slice()
    .sort((a, b) => b.id.length - a.id.length)
    .find((set) => normalizedId.startsWith(`${set.id.toLocaleLowerCase()}-`));
}

function toCatalogSet(
  raw: RawSet,
  language: LanguageCode,
  metadata?: RawSet,
): CatalogSet {
  const languageDefinition = LANGUAGE_BY_CODE[language];
  const combined = { ...metadata, ...raw };
  return {
    key: `${language}:${raw.id}`,
    id: raw.id,
    name: raw.name,
    language,
    languageLabel: languageDefinition.label,
    region: languageDefinition.region,
    logo: raw.logo ?? metadata?.logo,
    symbol: raw.symbol ?? metadata?.symbol,
    total:
      raw.cardCount?.total ??
      raw.cardCount?.official ??
      metadata?.cardCount?.total ??
      metadata?.cardCount?.official ??
      0,
    official:
      raw.cardCount?.official ??
      raw.cardCount?.total ??
      metadata?.cardCount?.official ??
      metadata?.cardCount?.total ??
      0,
    releaseDate: raw.releaseDate ?? metadata?.releaseDate,
    series: combined.serie?.name ?? "Other",
    seriesId: combined.serie?.id ?? "other",
    abbreviation: raw.abbreviation?.official,
  };
}

function buildCatalog(languageData: LanguageData[], globalSetMetadata: RawSet[]): Catalog {
  const cards: CatalogCard[] = [];
  const sets: CatalogSet[] = [];
  const metadataById = new Map(
    globalSetMetadata.map((set) => [set.id.toLocaleLowerCase(), set]),
  );

  for (const data of languageData) {
    const languageDefinition = LANGUAGE_BY_CODE[data.language];
    const normalizedSets = data.sets.map((set) =>
      toCatalogSet(set, data.language, metadataById.get(set.id.toLocaleLowerCase())),
    );
    sets.push(...normalizedSets);

    for (const card of data.cards) {
      const rawSet = findSetForCard(card, data.sets);
      const normalizedSet = rawSet
        ? normalizedSets.find((candidate) => candidate.id === rawSet.id)
        : undefined;
      const localId = card.localId ?? card.id.split("-").slice(1).join("-");
      cards.push({
        key: `${data.language}:${card.id}`,
        id: card.id,
        localId,
        name: card.name,
        searchName: `${normalize(card.name)} ${normalize(card.id)} ${normalize(localId)}`,
        image: card.image,
        language: data.language,
        languageLabel: languageDefinition.label,
        region: languageDefinition.region,
        setId: rawSet?.id ?? "",
        setName: normalizedSet?.name ?? rawSet?.name ?? "Unknown set",
        setLogo: normalizedSet?.logo,
        setReleaseDate: normalizedSet?.releaseDate,
        setSeries: normalizedSet?.series ?? "Other",
        setTotal: normalizedSet?.total ?? 0,
      });
    }
  }

  cards.sort((a, b) => {
    const releaseA = a.setReleaseDate ?? "";
    const releaseB = b.setReleaseDate ?? "";
    if (!releaseA && !releaseB) return a.name.localeCompare(b.name);
    if (!releaseA) return 1;
    if (!releaseB) return -1;
    const dateCompare = releaseB.localeCompare(releaseA);
    return dateCompare || a.name.localeCompare(b.name);
  });
  sets.sort((a, b) => {
    const releaseA = a.releaseDate ?? "";
    const releaseB = b.releaseDate ?? "";
    if (!releaseA && !releaseB) return a.name.localeCompare(b.name);
    if (!releaseA) return 1;
    if (!releaseB) return -1;
    return releaseB.localeCompare(releaseA);
  });

  return {
    version: CATALOG_VERSION,
    fetchedAt: new Date().toISOString(),
    cards,
    sets,
    failedLanguages: [],
  };
}

export interface CatalogLoadOptions {
  force?: boolean;
  onProgress?: (completed: number, total: number, language: LanguageCode) => void;
  signal?: AbortSignal;
}

export async function loadCatalog(options: CatalogLoadOptions = {}): Promise<Catalog> {
  let cached: Catalog | null = null;
  try {
    cached = await readCatalogCache();
  } catch {
    cached = null;
  }

  const cacheAge = cached ? Date.now() - new Date(cached.fetchedAt).getTime() : Infinity;
  const cacheIsFresh = cached?.version === CATALOG_VERSION && cacheAge < CACHE_TTL_MS;
  if (!options.force && cacheIsFresh) {
    return cached as Catalog;
  }

  const controller = new AbortController();
  const timeout = window.setTimeout(() => controller.abort(), 90_000);
  const signal = options.signal ?? controller.signal;
  let completedLanguages = 0;
  const metadataPromise = fetchGlobalSetMetadata(signal).catch(() => [] as RawSet[]);
  const results = await Promise.allSettled(
    LANGUAGES.map(async (language) => {
      const data = await fetchLanguage(language.code, signal);
      completedLanguages += 1;
      options.onProgress?.(
        completedLanguages,
        LANGUAGES.length,
        language.code,
      );
      return data;
    }),
  );
  const globalSetMetadata = await metadataPromise;
  window.clearTimeout(timeout);

  const successful = results
    .filter((result): result is PromiseFulfilledResult<LanguageData> => result.status === "fulfilled")
    .map((result) => result.value);
  const failedLanguages = results.flatMap((result, index) =>
    result.status === "rejected"
      ? [
          {
            language: LANGUAGES[index].code,
            message:
              result.reason instanceof Error ? result.reason.message : String(result.reason),
          },
        ]
      : [],
  );

  if (successful.length === 0) {
    if (cached) return cached;
    throw new Error(
      "The multilingual card catalog could not be reached. Check your connection and try again.",
    );
  }

  const catalog = buildCatalog(successful, globalSetMetadata);
  catalog.failedLanguages = failedLanguages;
  await writeCatalogCache(catalog).catch(() => undefined);
  return catalog;
}

export async function clearCatalog(): Promise<void> {
  await clearCatalogCache();
}

export async function loadCardDetail(
  language: LanguageCode,
  id: string,
  signal?: AbortSignal,
): Promise<CardDetail> {
  return getJson<CardDetail>(
    `${API_ROOT}/${language}/cards/${encodeURIComponent(id)}`,
    signal,
  );
}

export function imageUrl(image: string | undefined, quality: "low" | "high" = "high"): string | undefined {
  if (!image) return undefined;
  if (image.endsWith(".webp") || image.endsWith(".png") || image.endsWith(".jpg")) {
    return image;
  }
  return `${image}/${quality}.webp`;
}

export function getMarketPrice(detail: CardDetail | null): {
  amount: number;
  currency: string;
  source: string;
  updatedAt?: string;
} | null {
  const tcgplayer = detail?.pricing?.tcgplayer;
  const tcgAmount =
    tcgplayer?.normal?.marketPrice ??
    tcgplayer?.["reverse-holofoil"]?.marketPrice ??
    tcgplayer?.holofoil?.marketPrice;
  if (tcgAmount) {
    return {
      amount: tcgAmount,
      currency: tcgplayer?.unit ?? "USD",
      source: "TCGplayer",
      updatedAt: tcgplayer?.updated,
    };
  }

  const cardmarket = detail?.pricing?.cardmarket;
  const marketAmount = cardmarket?.trend ?? cardmarket?.avg;
  if (marketAmount) {
    return {
      amount: marketAmount,
      currency: cardmarket?.unit ?? "EUR",
      source: "Cardmarket",
      updatedAt: cardmarket?.updated,
    };
  }
  return null;
}
