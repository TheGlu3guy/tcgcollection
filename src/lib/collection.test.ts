import { describe, expect, it } from "vitest";
import { DEFAULT_APP_DATA } from "./constants";
import {
  addCardCopy,
  decrementCardCopy,
  filterCards,
  getGenerationStats,
  normalizeAppData,
  quantityForCard,
  toggleListCard,
  toggleWishlist,
} from "./collection";
import type { AppData, CardFilters, CatalogCard } from "../types";

const card: CatalogCard = {
  key: "en:base1-4",
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
};

function freshData(): AppData {
  return structuredClone(DEFAULT_APP_DATA);
}

const baseFilters: CardFilters = {
  query: "",
  region: "all",
  language: "all",
  setId: "all",
  status: "all",
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

describe("filters and statistics", () => {
  it("filters by collection and wishlist status", () => {
    const data = toggleWishlist(
      addCardCopy(freshData(), card),
      card.key,
    );

    expect(
      filterCards([card], { ...baseFilters, status: "collection" }, data),
    ).toHaveLength(1);
    expect(
      filterCards([card], { ...baseFilters, query: "missing", status: "wishlist" }, data),
    ).toHaveLength(0);
  });

  it("places cards with unknown release dates after dated cards", () => {
    const unknown = { ...card, key: "en:unknown", id: "unknown-1", setReleaseDate: undefined, name: "Unown" };
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
});
