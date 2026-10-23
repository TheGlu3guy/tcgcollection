import { describe, expect, it } from "vitest";
import { DEFAULT_APP_DATA } from "./constants";
import {
  addCardCopy,
  decrementCardCopy,
  filterCards,
  getGenerationStats,
  mergeCloudData,
  normalizeAppData,
  quantityForCard,
  sortCardsByPrice,
  toggleListCard,
  toggleWishlist,
} from "./collection";
import type { AppData, CardFilters, CatalogCard } from "../types";
import { getVisibleCards, getVisibleSets } from "./cardGroups";

const card: CatalogCard = {
  key: "en:base1-4",
  groupKey: "base1:4",
  id: "base1-4",
  localId: "4",
  name: "Charizard",
  searchName: "charizard base1-4 4",
  image: "https://assets.tcgdex.net/en/base/base1/4",
  language: "en",
  languageLabel: "English",
  region: "International",
  setId: "base1",
  setName: "Base Set",
  setReleaseDate: "1999-01-09",
  setSeries: "Base",
  setTotal: 102,
  artist: "Mitsuhiro Arita",
};

function freshData(): AppData {
  return structuredClone(DEFAULT_APP_DATA);
}

const baseFilters: CardFilters = {
  query: "",
  region: "all",
  language: "all",
  setId: "all",
  artist: "",
  status: "all",
  listId: "all",
  sort: "release-new",
};

describe("collection operations", () => {
  it("groups matching condition and variant copies", () => {
    let data = addCardCopy(freshData(), card, {
      condition: "Near Mint",
      variant: "Holo",
      marketPrice: 100,
      currency: "EUR",
      dexIds: [6],
    });
    data = addCardCopy(data, card, {
      condition: "Near Mint",
      variant: "Holo",
      marketPrice: 110,
      currency: "EUR",
      dexIds: [6],
    });

    expect(data.collection).toHaveLength(1);
    expect(quantityForCard(data.collection, card.key)).toBe(2);
    expect(data.collection[0].marketPrice).toBe(110);
  });

  it("creates separate print groups for different variants", () => {
    let data = addCardCopy(freshData(), card, { condition: "Near Mint", variant: "Holo" });
    data = addCardCopy(data, card, { condition: "Near Mint", variant: "Reverse Holo" });

    expect(data.collection).toHaveLength(2);
    expect(quantityForCard(data.collection, card.key)).toBe(2);
  });

  it("sorts priced cards while keeping unavailable prices last", () => {
    const cheap = { ...card, key: "en:cheap", name: "Cheap Card" };
    const expensive = { ...card, key: "en:expensive", name: "Expensive Card" };
    const missing = { ...card, key: "en:missing", name: "Missing Price" };
    const prices = {
      "en:cheap": {
        tcgplayer: { amount: 1, currency: "USD", source: "TCGplayer" },
        cardmarket: null,
      },
      "en:expensive": {
        tcgplayer: { amount: 50, currency: "USD", source: "TCGplayer" },
        cardmarket: null,
      },
      "en:missing": { tcgplayer: null, cardmarket: null },
    };

    expect(
      sortCardsByPrice([cheap, missing, expensive], prices, "price-desc").map(
        (item) => item.name,
      ),
    ).toEqual(["Expensive Card", "Cheap Card", "Missing Price"]);
    expect(
      sortCardsByPrice([cheap, missing, expensive], prices, "price-asc").map(
        (item) => item.name,
      ),
    ).toEqual(["Cheap Card", "Expensive Card", "Missing Price"]);
  });

  it("removes empty print groups when the last copy is removed", () => {
    let data = addCardCopy(freshData(), card);
    data = decrementCardCopy(data, card.key);

    expect(data.collection).toHaveLength(0);
  });

  it("keeps the same card unique across a list", () => {
    const data = {
      ...freshData(),
      lists: [
        {
          id: "binder",
          name: "Binder",
          description: "",
          color: "#fff",
          cardKeys: [],
          createdAt: "",
          updatedAt: "",
        },
      ],
    };
    const first = toggleListCard(data, "binder", card.key);
    const second = toggleListCard(first, "binder", card.key);
    const third = toggleListCard(second, "binder", card.key);

    expect(first.lists[0].cardKeys).toEqual([card.key]);
    expect(second.lists[0].cardKeys).toEqual([]);
    expect(third.lists[0].cardKeys).toEqual([card.key]);
  });

  it("toggles wishlist cards without duplicates", () => {
    const first = toggleWishlist(freshData(), card.key);
    const second = toggleWishlist(first, card.key);

    expect(first.wishlist).toEqual([card.key]);
    expect(second.wishlist).toEqual([]);
  });
});

describe("cloud collection merging", () => {
  it("keeps the newest copy and unions independent wishlist entries", () => {
    const local = freshData();
    local.collection = [
      {
        id: "copy-1",
        cardKey: "en:base1-4",
        cardId: "base1-4",
        language: "en",
        name: "Charizard",
        setId: "base1",
        setName: "Base Set",
        quantity: 2,
        condition: "Near Mint",
        variant: "Holo",
        currency: "EUR",
        notes: "",
        addedAt: "2026-01-01T00:00:00.000Z",
        updatedAt: "2026-01-02T00:00:00.000Z",
      },
    ];
    local.wishlist = ["en:base1-2"];
    const remote = freshData();
    remote.wishlist = ["en:base1-3"];

    const merged = mergeCloudData(local, remote);

    expect(merged.collection).toHaveLength(1);
    expect(merged.collection[0].quantity).toBe(2);
    expect(merged.wishlist).toEqual(["en:base1-3", "en:base1-2"]);
  });
});

describe("filters and statistics", () => {
  it("filters collection state and wishlist membership independently", () => {
    const data = toggleWishlist(
      addCardCopy(freshData(), card),
      card.key,
    );

    expect(
      filterCards([card], { ...baseFilters, status: "collection" }, data),
    ).toHaveLength(1);
    expect(
      filterCards([card], { ...baseFilters, listId: "wishlist" }, data),
    ).toHaveLength(1);
    expect(
      filterCards([card], { ...baseFilters, status: "not-collection" }, freshData()),
    ).toHaveLength(1);
  });

  it("filters membership in a custom list", () => {
    const data = {
      ...freshData(),
      lists: [{
        id: "binder",
        name: "Binder",
        description: "",
        color: "#fff",
        cardKeys: [card.key],
        createdAt: "",
        updatedAt: "",
      }],
    };

    expect(
      filterCards([card], { ...baseFilters, listId: "binder" }, data),
    ).toHaveLength(1);
    expect(
      filterCards([card], { ...baseFilters, listId: "other" }, data),
    ).toHaveLength(0);
  });

  it("filters artists case-insensitively from a partial name", () => {
    expect(
      filterCards(
        [card],
        { ...baseFilters, artist: "ARITA" },
        freshData(),
      ),
    ).toHaveLength(1);
    expect(
      filterCards(
        [card],
        { ...baseFilters, artist: "morii" },
        freshData(),
      ),
    ).toHaveLength(0);
  });

  it("places cards with unknown release dates after dated cards", () => {
    const unknown = {
      ...card,
      key: "en:unknown",
      groupKey: "unknown:1",
      id: "unknown-1",
      localId: "1",
      setId: "unknown",
      setReleaseDate: undefined,
      name: "Unown",
    };
    const sorted = filterCards([unknown, card], baseFilters, freshData());

    expect(sorted.map((item) => item.name)).toEqual(["Charizard", "Unown"]);
  });

  it("counts a species once across matching cards", () => {
    let data = addCardCopy(freshData(), card, { dexIds: [6] });
    const otherPrint = { ...card, key: "fr:base1-4", language: "fr" as const };
    data = addCardCopy(data, otherPrint, { dexIds: [6] });
    const kanto = getGenerationStats(data)[0];

    expect(kanto.caught).toBe(1);
    expect(kanto.total).toBe(151);
  });

  it("normalizes incomplete imported backups", () => {
    const restored = normalizeAppData({ collection: [], wishlist: ["en:base1-4"] });

    expect(restored.wishlist).toEqual(["en:base1-4"]);
    expect(restored.preferences.defaultCondition).toBe("Near Mint");
    expect(restored.lists).toEqual([]);
  });

  it("shows one card in English-first mode across translations", () => {
    const french = {
      ...card,
      key: "fr:base1-4",
      language: "fr" as const,
      languageLabel: "French",
      name: "Dracaufeu",
      searchName: "dracaufeu base1-4 4",
    };
    const visible = getVisibleCards([french, card], "all");

    expect(visible).toHaveLength(1);
    expect(visible[0].language).toBe("en");
  });

  it("keeps collection status when the owned translation differs from the displayed one", () => {
    const french = {
      ...card,
      key: "fr:base1-4",
      language: "fr" as const,
      languageLabel: "French",
      name: "Dracaufeu",
      searchName: "dracaufeu base1-4 4",
    };
    const data = addCardCopy(freshData(), french);
    const visible = filterCards(
      [french, card],
      { ...baseFilters, status: "collection" },
      data,
    );

    expect(visible).toHaveLength(1);
    expect(visible[0].language).toBe("en");
  });

  it("falls back to an available language when English is missing", () => {
    const french = {
      ...card,
      key: "fr:base1-4",
      language: "fr" as const,
      languageLabel: "French",
      name: "Dracaufeu",
      searchName: "dracaufeu base1-4 4",
    };
    const visible = getVisibleCards([french], "all");

    expect(visible).toHaveLength(1);
    expect(visible[0].language).toBe("fr");
  });

  it("filters by illustrator", () => {
    const otherArtist = {
      ...card,
      key: "en:base1-5",
      groupKey: "base1:5",
      id: "base1-5",
      localId: "5",
      name: "Gyarados",
      searchName: "gyarados base1-5 5",
      artist: "Mitsuhiro Arita",
    };
    const filtered = filterCards(
      [card, otherArtist],
      { ...baseFilters, artist: "mitsuhiro" },
      freshData(),
    );

    expect(filtered.map((item) => item.name)).toEqual(["Charizard", "Gyarados"]);
  });

  it("deduplicates sets while retaining the preferred language", () => {
    const englishSet = {
      key: "en:base1",
      id: "base1",
      name: "Base Set",
      language: "en" as const,
      languageLabel: "English",
      region: "International" as const,
      total: 102,
      official: 102,
      series: "Base",
      seriesId: "base",
    };
    const frenchSet = {
      ...englishSet,
      key: "fr:base1",
      name: "Set de Base",
      language: "fr" as const,
      languageLabel: "French",
    };

    expect(getVisibleSets([frenchSet, englishSet], "all")).toEqual([englishSet]);
  });
});
