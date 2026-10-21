import { DEFAULT_APP_DATA, GENERATIONS } from "./constants";
import { getStoredCopyGroupKey, getVisibleCards } from "./cardGroups";
import type {
  AppData,
  CardCopy,
  CardFilters,
  CatalogCard,
  CatalogSet,
  MarketPrices,
} from "../types";

export function normalizeAppData(input: Partial<AppData> | null | undefined): AppData {
  if (!input || typeof input !== "object") {
    return structuredClone(DEFAULT_APP_DATA);
  }
  return {
    schemaVersion: 1,
    collection: Array.isArray(input.collection) ? input.collection : [],
    wishlist: Array.isArray(input.wishlist) ? input.wishlist.filter((key) => typeof key === "string") : [],
    lists: Array.isArray(input.lists)
      ? input.lists.filter((list) => list && typeof list.id === "string")
      : [],
    notes: input.notes && typeof input.notes === "object" ? input.notes : {},
    preferences: {
      ...DEFAULT_APP_DATA.preferences,
      ...(input.preferences ?? {}),
    },
  };
}

function newestByKey<T extends { id: string; updatedAt: string }>(remote: T[], local: T[]): T[] {
  const merged = new Map(remote.map((entry) => [entry.id, entry]));
  for (const entry of local) {
    const existing = merged.get(entry.id);
    if (!existing || entry.updatedAt >= existing.updatedAt) merged.set(entry.id, entry);
  }
  return [...merged.values()];
}

export function mergeCloudData(local: AppData, remote: AppData): AppData {
  return {
    schemaVersion: 1,
    collection: newestByKey(remote.collection, local.collection),
    wishlist: [...new Set([...remote.wishlist, ...local.wishlist])],
    lists: newestByKey(remote.lists, local.lists),
    notes: { ...remote.notes, ...local.notes },
    preferences: { ...remote.preferences, ...local.preferences },
  };
}

export function quantityForCard(collection: CardCopy[], cardKey: string): number {
  return collection
    .filter((copy) => copy.cardKey === cardKey)
    .reduce((total, copy) => total + copy.quantity, 0);
}

export function quantityForCardGroup(
  collection: CardCopy[],
  cards: CatalogCard[],
  groupKey: string,
): number {
  const cardsByKey = new Map(cards.map((card) => [card.key, card]));
  return collection
    .filter((copy) => getStoredCopyGroupKey(copy, cardsByKey) === groupKey)
    .reduce((total, copy) => total + copy.quantity, 0);
}

export function addCardCopy(
  data: AppData,
  card: CatalogCard,
  options: {
    condition?: string;
    variant?: string;
    quantity?: number;
    marketPrice?: number;
    currency?: string;
    types?: string[];
    dexIds?: number[];
    rarity?: string;
  } = {},
): AppData {
  const quantity = Math.max(1, Math.floor(options.quantity ?? 1));
  const condition = options.condition ?? data.preferences.defaultCondition;
  const variant = options.variant ?? data.preferences.defaultVariant;
  const now = new Date().toISOString();
  const existing = data.collection.find(
    (copy) =>
      copy.cardKey === card.key &&
      copy.condition === condition &&
      copy.variant === variant &&
      copy.currency === (options.currency ?? data.preferences.collectionValueCurrency),
  );

  const collection = existing
    ? data.collection.map((copy) =>
        copy.id === existing.id
          ? {
              ...copy,
              quantity: copy.quantity + quantity,
              marketPrice: options.marketPrice ?? copy.marketPrice,
              types: options.types ?? copy.types,
              dexIds: options.dexIds ?? copy.dexIds,
              rarity: options.rarity ?? copy.rarity,
              updatedAt: now,
            }
          : copy,
      )
    : [
        ...data.collection,
        {
          id: `${card.key}:${condition}:${variant}:${now}`,
          cardKey: card.key,
          cardId: card.id,
          language: card.language,
          name: card.name,
          image: card.image,
          setId: card.setId,
          setName: card.setName,
          quantity,
          condition,
          variant,
          marketPrice: options.marketPrice,
          currency: options.currency ?? data.preferences.collectionValueCurrency,
          notes: "",
          addedAt: now,
          updatedAt: now,
          types: options.types,
          dexIds: options.dexIds,
          rarity: options.rarity,
        },
      ];

  return { ...data, collection };
}

export function decrementCardCopy(data: AppData, cardKey: string): AppData {
  const firstCopy = data.collection.find((copy) => copy.cardKey === cardKey);
  if (!firstCopy) return data;
  if (firstCopy.quantity <= 1) {
    return {
      ...data,
      collection: data.collection.filter((copy) => copy.id !== firstCopy.id),
    };
  }
  return {
    ...data,
    collection: data.collection.map((copy) =>
      copy.id === firstCopy.id
        ? { ...copy, quantity: copy.quantity - 1, updatedAt: new Date().toISOString() }
        : copy,
    ),
  };
}

export function decrementCardGroup(
  data: AppData,
  cards: CatalogCard[],
  groupKey: string,
): AppData {
  const cardsByKey = new Map(cards.map((card) => [card.key, card]));
  const copy = data.collection.find(
    (entry) => getStoredCopyGroupKey(entry, cardsByKey) === groupKey,
  );
  return copy ? decrementCardCopy(data, copy.cardKey) : data;
}

export function updateCardCopy(data: AppData, copyId: string, patch: Partial<CardCopy>): AppData {
  const collection = data.collection
    .map((copy) =>
      copy.id === copyId
        ? {
            ...copy,
            ...patch,
            quantity: patch.quantity === undefined ? copy.quantity : Math.max(0, patch.quantity),
            updatedAt: new Date().toISOString(),
          }
        : copy,
    )
    .filter((copy) => copy.quantity > 0);
  return { ...data, collection };
}

export function toggleWishlist(data: AppData, cardKey: string): AppData {
  const hasCard = data.wishlist.includes(cardKey);
  return {
    ...data,
    wishlist: hasCard
      ? data.wishlist.filter((key) => key !== cardKey)
      : [...data.wishlist, cardKey],
  };
}

export function toggleWishlistGroup(
  data: AppData,
  cards: CatalogCard[],
  groupKey: string,
  selectedKey: string,
): AppData {
  const cardsByKey = new Map(cards.map((card) => [card.key, card]));
  const matchingKeys = new Set(
    data.wishlist.filter((key) => {
      const card = cardsByKey.get(key);
      return card && (card.groupKey || getStoredCopyGroupKey({
        cardKey: card.key,
        cardId: card.id,
        setId: card.setId,
        name: card.name,
      }, cardsByKey)) === groupKey;
    }),
  );
  return matchingKeys.size > 0
    ? { ...data, wishlist: data.wishlist.filter((key) => !matchingKeys.has(key)) }
    : { ...data, wishlist: [...data.wishlist, selectedKey] };
}

export function toggleListCard(
  data: AppData,
  listId: string,
  cardKey: string,
): AppData {
  return {
    ...data,
    lists: data.lists.map((list) => {
      if (list.id !== listId) return list;
      const cardKeys = list.cardKeys.includes(cardKey)
        ? list.cardKeys.filter((key) => key !== cardKey)
        : [...list.cardKeys, cardKey];
      return { ...list, cardKeys, updatedAt: new Date().toISOString() };
    }),
  };
}

export function toggleListCardGroup(
  data: AppData,
  listId: string,
  cards: CatalogCard[],
  groupKey: string,
  selectedKey: string,
): AppData {
  const cardsByKey = new Map(cards.map((card) => [card.key, card]));
  return {
    ...data,
    lists: data.lists.map((list) => {
      if (list.id !== listId) return list;
      const groupKeysInList = list.cardKeys.filter((key) => {
        const card = cardsByKey.get(key);
        return card?.groupKey === groupKey;
      });
      const cardKeys =
        groupKeysInList.length > 0
          ? list.cardKeys.filter((key) => !groupKeysInList.includes(key))
          : [...list.cardKeys, selectedKey];
      return { ...list, cardKeys, updatedAt: new Date().toISOString() };
    }),
  };
}

export function filterCards(
  cards: CatalogCard[],
  filters: CardFilters,
  data: AppData,
): CatalogCard[] {
  const query = filters.query.trim().toLocaleLowerCase();
  const cardsByKey = new Map(cards.map((card) => [card.key, card]));
  const owned = new Set(
    data.collection.map((copy) => getStoredCopyGroupKey(copy, cardsByKey)),
  );
  const wishlist = new Set(
    data.wishlist.map((key) => {
      const card = cardsByKey.get(key);
      return card ? card.groupKey : key;
    }),
  );
  const selectedList =
    filters.listId === "all" || filters.listId === "wishlist"
      ? undefined
      : data.lists.find((list) => list.id === filters.listId);
  const selectedListGroups = new Set(
    selectedList?.cardKeys.map((key) => cardsByKey.get(key)?.groupKey ?? key) ?? [],
  );
  const artistQuery = filters.artist.trim().toLocaleLowerCase();
  const visibleCards = getVisibleCards(cards, filters.language);

  const filtered = visibleCards.filter((card) => {
    if (filters.region !== "all" && card.region !== filters.region) return false;
    if (filters.setId !== "all" && `${card.language}:${card.setId}` !== filters.setId) return false;
    if (artistQuery && !card.artist?.toLocaleLowerCase().includes(artistQuery)) return false;
    if (filters.status === "collection" && !owned.has(card.groupKey)) return false;
    if (filters.status === "not-collection" && owned.has(card.groupKey)) return false;
    if (filters.listId === "wishlist" && !wishlist.has(card.groupKey)) return false;
    if (filters.listId !== "all" && filters.listId !== "wishlist" && !selectedListGroups.has(card.groupKey)) {
      return false;
    }
    if (query && !card.searchName.includes(query)) return false;
    return true;
  });

  return filtered.sort((a, b) => {
    const releaseA = a.setReleaseDate ?? "";
    const releaseB = b.setReleaseDate ?? "";
    switch (filters.sort) {
      case "release-old":
        if (!releaseA && !releaseB) return a.name.localeCompare(b.name);
        if (!releaseA) return 1;
        if (!releaseB) return -1;
        return releaseA.localeCompare(releaseB);
      case "name-asc":
        return a.name.localeCompare(b.name);
      case "name-desc":
        return b.name.localeCompare(a.name);
      case "number-asc":
        return a.localId.localeCompare(b.localId, undefined, { numeric: true });
      case "set-asc":
        return a.setName.localeCompare(b.setName) || a.localId.localeCompare(b.localId, undefined, { numeric: true });
      case "price-desc":
      case "price-asc":
        return a.name.localeCompare(b.name);
      case "release-new":
      default:
        if (!releaseA && !releaseB) return a.name.localeCompare(b.name);
        if (!releaseA) return 1;
        if (!releaseB) return -1;
        return (
          releaseB.localeCompare(releaseA) ||
          b.setTotal - a.setTotal ||
          a.setName.localeCompare(b.setName) ||
          a.localId.localeCompare(b.localId, undefined, { numeric: true })
        );
    }
  });
}

export function sortCardsByPrice(
  cards: CatalogCard[],
  prices: Record<string, MarketPrices>,
  direction: "price-desc" | "price-asc",
): CatalogCard[] {
  const amountFor = (card: CatalogCard) =>
    prices[card.key]?.tcgplayer?.amount ??
    prices[card.key]?.cardmarket?.amount;
  return cards.slice().sort((a, b) => {
    const amountA = amountFor(a);
    const amountB = amountFor(b);
    if (amountA === undefined && amountB === undefined) {
      return a.name.localeCompare(b.name);
    }
    if (amountA === undefined) return 1;
    if (amountB === undefined) return -1;
    return direction === "price-desc"
      ? amountB - amountA || a.name.localeCompare(b.name)
      : amountA - amountB || a.name.localeCompare(b.name);
  });
}

export function getCollectionStats(data: AppData, cards: CatalogCard[]) {
  const cardsByKey = new Map(cards.map((card) => [card.key, card]));
  const uniqueKeys = new Set(
    data.collection.map((copy) => getStoredCopyGroupKey(copy, cardsByKey)),
  );
  const totalCopies = data.collection.reduce((total, copy) => total + copy.quantity, 0);
  const uniqueSets = new Set(
    data.collection.map((copy) => copy.setId.toLocaleLowerCase()),
  );
  const allDexIds = new Set(data.collection.flatMap((copy) => copy.dexIds ?? []));
  const languageCounts = data.collection.reduce<Record<string, number>>((counts, copy) => {
    counts[copy.language] = (counts[copy.language] ?? 0) + copy.quantity;
    return counts;
  }, {});
  const estimatedValue = data.collection.reduce(
    (total, copy) => total + (copy.marketPrice ?? 0) * copy.quantity,
    0,
  );
  return {
    totalCopies,
    uniqueCards: uniqueKeys.size,
    uniqueSets: uniqueSets.size,
    species: allDexIds.size,
    wishlist: data.wishlist.length,
    lists: data.lists.length,
    estimatedValue,
    languageCounts,
    collectionPercent: cards.length
      ? (uniqueKeys.size / getVisibleCards(cards, "all").length) * 100
      : 0,
  };
}

export function getSetProgress(data: AppData, sets: CatalogSet[]): Map<string, number> {
  const counts = new Map<string, number>();
  for (const copy of data.collection) {
    const key = copy.setId.toLocaleLowerCase();
    counts.set(key, (counts.get(key) ?? 0) + 1);
  }
  return new Map(
    sets.map((set) => [
      set.key,
      set.total
        ? Math.min(100, ((counts.get(set.id.toLocaleLowerCase()) ?? 0) / set.total) * 100)
        : 0,
    ]),
  );
}

export function getGenerationStats(data: AppData) {
  const dexIds = new Set(data.collection.flatMap((copy) => copy.dexIds ?? []));
  return GENERATIONS.map((generation) => {
    const caught = [...dexIds].filter(
      (dexId) => dexId >= generation.start && dexId <= generation.end,
    ).length;
    const total = generation.end - generation.start + 1;
    return { ...generation, caught, total, percent: (caught / total) * 100 };
  });
}

export function formatCurrency(amount: number, currency: string, locale?: string): string {
  try {
    return new Intl.NumberFormat(locale, {
      style: "currency",
      currency,
      maximumFractionDigits: 2,
    }).format(amount);
  } catch {
    return `${currency} ${amount.toFixed(2)}`;
  }
}

export function formatNumber(value: number): string {
  return new Intl.NumberFormat().format(value);
}
