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
  MarketPrices,
  PriceSnapshot,
  RawCardSummary,
  RawSet,
} from "../types";
import { getCardGroupKey } from "./cardGroups";

const API_ROOT = "https://api.tcgdex.net/v2";
const CACHE_TTL_MS = 1000 * 60 * 60 * 24 * 7;
const IDB_NAME = "tcgcollection";
const IDB_STORE = "catalog";
const PRICE_STORE = "prices";
const PRICE_CACHE_TTL_MS = 1000 * 60 * 60 * 24;
const PRICE_CACHE_VERSION = 6;

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

interface RawArtistCard {
  id: string;
  localId?: string;
  illustrator?: string;
  set: { id: string };
}

interface GraphqlCardsResponse {
  data?: {
    cards?: RawArtistCard[];
  };
  errors?: { message: string }[];
}

interface CacheEnvelope {
  key: string;
  catalog: Catalog;
}

interface PriceCacheEntry {
  key: string;
  version?: number;
  prices: MarketPrices;
  fetchedAt: string;
}

function openDatabase(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(IDB_NAME, 2);
    request.onupgradeneeded = () => {
      const database = request.result;
      if (!database.objectStoreNames.contains(IDB_STORE)) {
        database.createObjectStore(IDB_STORE, { keyPath: "key" });
      }
      if (!database.objectStoreNames.contains(PRICE_STORE)) {
        database.createObjectStore(PRICE_STORE, { keyPath: "key" });
      }
    };
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

async function readPriceCache(keys: string[]): Promise<Map<string, PriceCacheEntry>> {
  if (!keys.length) return new Map();
  const database = await openDatabase();
  return new Promise((resolve, reject) => {
    const transaction = database.transaction(PRICE_STORE, "readonly");
    const store = transaction.objectStore(PRICE_STORE);
    const entries = new Map<string, PriceCacheEntry>();
    for (const key of keys) {
      const request = store.get(key);
      request.onsuccess = () => {
        const entry = request.result as PriceCacheEntry | undefined;
        if (entry) entries.set(key, entry);
      };
    }
    transaction.oncomplete = () => {
      database.close();
      resolve(entries);
    };
    transaction.onerror = () => reject(transaction.error);
  });
}

async function writePriceCache(entry: PriceCacheEntry): Promise<void> {
  const database = await openDatabase();
  return new Promise((resolve, reject) => {
    const transaction = database.transaction(PRICE_STORE, "readwrite");
    transaction.objectStore(PRICE_STORE).put(entry);
    transaction.oncomplete = () => {
      database.close();
      resolve();
    };
    transaction.onerror = () => reject(transaction.error);
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

async function fetchGlobalCardArtists(signal: AbortSignal): Promise<RawArtistCard[]> {
  const query = "{ cards { id localId illustrator set { id } } }";
  const response = await fetch(`${API_ROOT}/graphql`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ query }),
    signal,
  });
  if (!response.ok) throw new Error(`${response.status} ${response.statusText}`);
  const result = (await response.json()) as GraphqlCardsResponse;
  if (!result.data?.cards) {
    throw new Error(result.errors?.[0]?.message ?? "Artist metadata was unavailable.");
  }
  return result.data.cards;
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
  const displayName =
    language === "en" && raw.id.toLocaleLowerCase() === "30th-c"
      ? "30th Celebration · Classic Collection"
      : raw.name;
  return {
    key: `${language}:${raw.id}`,
    id: raw.id,
    name: displayName,
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

export function isDigitalOnlySet(set: RawSet, metadata?: RawSet): boolean {
  const seriesId = (set.serie?.id ?? metadata?.serie?.id ?? "").toLocaleLowerCase();
  const seriesName = (set.serie?.name ?? metadata?.serie?.name ?? "").toLocaleLowerCase();
  return seriesId === "tcgp" || seriesName.includes("tcg pocket");
}

function buildCatalog(
  languageData: LanguageData[],
  globalSetMetadata: RawSet[],
  artistCards: RawArtistCard[],
): Catalog {
  const cards: CatalogCard[] = [];
  const sets: CatalogSet[] = [];
  const artists = new Set<string>();
  const metadataById = new Map(
    globalSetMetadata.map((set) => [set.id.toLocaleLowerCase(), set]),
  );
  const artistByCard = new Map(
    artistCards
      .filter((card) => card.illustrator)
      .map((card) => [
        `${card.set.id.toLocaleLowerCase()}:${(card.localId ?? card.id.slice(card.set.id.length + 1)).toLocaleLowerCase()}`,
        card.illustrator as string,
      ]),
  );

  for (const data of languageData) {
    const languageDefinition = LANGUAGE_BY_CODE[data.language];
    const physicalSets = data.sets.filter(
      (set) =>
        !isDigitalOnlySet(set, metadataById.get(set.id.toLocaleLowerCase())),
    );
    const physicalSetIds = new Set(
      physicalSets.map((set) => set.id.toLocaleLowerCase()),
    );
    const normalizedSets = physicalSets.map((set) =>
      toCatalogSet(set, data.language, metadataById.get(set.id.toLocaleLowerCase())),
    );
    sets.push(...normalizedSets);

    for (const card of data.cards) {
      const rawSet = findSetForCard(card, data.sets);
      if (
        rawSet &&
        !physicalSetIds.has(rawSet.id.toLocaleLowerCase())
      ) {
        continue;
      }
      const normalizedSet = rawSet
        ? normalizedSets.find((candidate) => candidate.id === rawSet.id)
        : undefined;
      const localId = card.localId ?? card.id.split("-").slice(1).join("-");
      const catalogCard: CatalogCard = {
        key: `${data.language}:${card.id}`,
        groupKey: "",
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
        artist: artistByCard.get(
          `${(rawSet?.id ?? "").toLocaleLowerCase()}:${localId.toLocaleLowerCase()}`,
        ),
      };
      if (catalogCard.artist) artists.add(catalogCard.artist);
      catalogCard.groupKey = getCardGroupKey(catalogCard);
      cards.push(catalogCard);
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
    artists: [...artists].sort((a, b) => a.localeCompare(b)),
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
  const artistsPromise = fetchGlobalCardArtists(signal).catch(
    () => [] as RawArtistCard[],
  );
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
  const [globalSetMetadata, artistCards] = await Promise.all([
    metadataPromise,
    artistsPromise,
  ]);
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

  const catalog = buildCatalog(successful, globalSetMetadata, artistCards);
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
  fresh = false,
): Promise<CardDetail> {
  const url = `${API_ROOT}/${language}/cards/${encodeURIComponent(id)}`;
  if (!fresh) return getJson<CardDetail>(url, signal);

  const cacheBucket = Math.floor(Date.now() / (5 * 60 * 1000));
  const response = await fetch(`${url}?fresh=${cacheBucket}`, {
    signal,
    cache: "no-store",
  });
  if (!response.ok) {
    throw new Error(`${response.status} ${response.statusText}`);
  }
  return response.json() as Promise<CardDetail>;
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
  const prices = getMarketPrices(detail);
  return prices.tcgplayer ?? prices.cardmarket;
}

export function getMarketPrices(detail: CardDetail | null): MarketPrices {
  const tcgplayer = detail?.pricing?.tcgplayer;
  const tcgVariant =
    tcgplayer?.normal?.marketPrice !== undefined
      ? tcgplayer.normal
      : tcgplayer?.["reverse-holofoil"]?.marketPrice !== undefined
        ? tcgplayer["reverse-holofoil"]
        : tcgplayer?.holofoil?.marketPrice !== undefined
          ? tcgplayer.holofoil
          : tcgplayer?.unlimited?.marketPrice !== undefined
            ? tcgplayer.unlimited
            : tcgplayer?.["1st-edition"]?.marketPrice !== undefined
              ? tcgplayer["1st-edition"]
              : undefined;
  const tcgAmount = tcgVariant?.marketPrice;
  const cardmarket = detail?.pricing?.cardmarket;
  const cardmarketAmount = cardmarket?.trend ?? cardmarket?.avg;
  const fallbackTcgplayerId = detail?.variants_detailed
    ?.map((variant) => variant.thirdParty?.tcgplayer)
    .find((id) => typeof id === "number");
  const fallbackCardmarketId =
    cardmarket?.idProduct ??
    detail?.variants_detailed
      ?.map((variant) => variant.thirdParty?.cardmarket)
      .find((id) => typeof id === "number");
  const tcgplayerId = tcgVariant?.productId ?? fallbackTcgplayerId;
  const tcgplayerUrl = tcgplayerId
    ? `https://www.tcgplayer.com/product/${tcgplayerId}`
    : undefined;
  const tcgplayerImageUrl = tcgplayerId
    ? `https://product-images.tcgplayer.com/fit-in/437x437/${tcgplayerId}.jpg`
    : undefined;
  const cardmarketUrl = fallbackCardmarketId
    ? `https://www.cardmarket.com/en/Pokemon/Products?idProduct=${fallbackCardmarketId}&language=1,2&minCondition=5&isFoil=`
    : undefined;
  return {
    tcgplayer: tcgAmount
      ? {
          amount: tcgAmount,
          currency: tcgplayer?.unit ?? "USD",
          source: "TCGplayer",
          url: tcgplayerUrl,
          updatedAt: tcgplayer?.updated,
        }
      : null,
    cardmarket: cardmarketAmount
      ? {
          amount: cardmarketAmount,
          currency: cardmarket?.unit ?? "EUR",
          source: "Cardmarket",
          url: cardmarketUrl,
          updatedAt: cardmarket?.updated,
        }
      : null,
    tcgplayerUrl,
    cardmarketUrl,
    imageUrl: tcgplayerImageUrl,
  };
}

export async function loadMarketPrices(
  cards: CatalogCard[],
  onPrice: (cardKey: string, prices: MarketPrices) => void,
  signal?: AbortSignal,
): Promise<void> {
  const uniqueCards = [
    ...new Map(cards.map((card) => [card.key, card])).values(),
  ];
  const cached = await readPriceCache(uniqueCards.map((card) => card.key)).catch(
    () => new Map<string, PriceCacheEntry>(),
  );
  const pending: CatalogCard[] = [];
  const now = Date.now();

  for (const card of uniqueCards) {
    const entry = cached.get(card.key);
    const isFresh =
      entry?.version === PRICE_CACHE_VERSION &&
      entry.prices &&
      now - new Date(entry.fetchedAt).getTime() < PRICE_CACHE_TTL_MS;
    if (isFresh) onPrice(card.key, entry.prices);
    else pending.push(card);
  }

  let cursor = 0;
  const worker = async () => {
    while (cursor < pending.length && !signal?.aborted) {
      const card = pending[cursor++];
      try {
        const detail = await loadCardDetail(card.language, card.id, signal, true);
        const prices = getMarketPrices(detail);
        onPrice(card.key, prices);
        await writePriceCache({
          key: card.key,
          version: PRICE_CACHE_VERSION,
          prices,
          fetchedAt: new Date().toISOString(),
        }).catch(() => undefined);
      } catch {
        // Pricing is optional and must not prevent the card catalog from loading.
      }
    }
  };

  await Promise.all(
    Array.from({ length: Math.min(6, pending.length) }, () => worker()),
  );
}
