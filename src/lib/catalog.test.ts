import { describe, expect, it } from "vitest";
import { getMarketPrice, getMarketPrices, isDigitalOnlySet } from "./catalog";
import { withRecoveredCards } from "./cardGroups";
import type { CardDetail, Catalog, CatalogCard } from "../types";

function detail(pricing: CardDetail["pricing"]): CardDetail {
  return {
    id: "base1-4",
    name: "Charizard",
    pricing,
  };
}

describe("market pricing", () => {
  it("prefers TCGplayer over Cardmarket", () => {
    const price = getMarketPrice(
      detail({
        cardmarket: { unit: "EUR", trend: 250, idProduct: 273699 },
        tcgplayer: {
          unit: "USD",
          holofoil: { marketPrice: 954.65, productId: 42382 },
        },
      }),
    );

    expect(price).toMatchObject({
      amount: 954.65,
      currency: "USD",
      source: "TCGplayer",
    });
  });

  it("falls back to a Cardmarket trend price", () => {
    const price = getMarketPrice(
      detail({
        cardmarket: { unit: "EUR", trend: 6.58 },
      }),
    );

    expect(price).toMatchObject({
      amount: 6.58,
      currency: "EUR",
      source: "Cardmarket",
    });
  });

  it("recognizes vintage TCGplayer unlimited and first-edition buckets", () => {
    const prices = getMarketPrices(
      detail({
        cardmarket: { unit: "EUR", trend: 0.32, idProduct: 274571 },
        tcgplayer: {
          unit: "USD",
          "1st-edition": { productId: 87856, marketPrice: 14.92 },
          unlimited: { productId: 87856, marketPrice: 2.82 },
        },
      }),
    );

    expect(prices.tcgplayer).toMatchObject({
      amount: 2.82,
      currency: "USD",
    });
    expect(prices.cardmarket).toMatchObject({
      amount: 0.32,
      currency: "EUR",
    });
  });

  it("returns both marketplaces independently", () => {
    const prices = getMarketPrices(
      detail({
        cardmarket: { unit: "EUR", trend: 250, idProduct: 273699 },
        tcgplayer: {
          unit: "USD",
          holofoil: { marketPrice: 954.65, productId: 42382 },
        },
      }),
    );

    expect(prices.tcgplayer?.amount).toBe(954.65);
    expect(prices.cardmarket?.amount).toBe(250);
    expect(prices.tcgplayerUrl).toBe("https://www.tcgplayer.com/product/42382");
    expect(prices.cardmarketUrl).toBe(
      "https://www.cardmarket.com/en/Pokemon/Products?idProduct=273699&language=1,2&minCondition=5&isFoil=",
    );
    expect(prices.imageUrl).toBe(
      "https://product-images.tcgplayer.com/fit-in/437x437/42382.jpg",
    );
  });

  it("uses the holo Cardmarket quote for a holo-only card", () => {
    const prices = getMarketPrices(
      {
        id: "ecard3-H22",
        name: "Piloswine",
        variants: { holo: true, normal: false, reverse: false },
        pricing: {
          cardmarket: {
            unit: "EUR",
            trend: 13.58,
            "trend-holo": 30.42,
          },
        },
      },
      "Normal",
    );

    expect(prices.cardmarket).toMatchObject({
      amount: 30.42,
      variant: "Holo",
    });
  });

  it("keeps normal and reverse-holo TCGplayer quotes separate", () => {
    const detail: CardDetail = {
      id: "ecard3-24",
      name: "Piloswine",
      variants: { holo: false, normal: true, reverse: true },
      pricing: {
        cardmarket: {
          unit: "EUR",
          trend: 128.71,
          "trend-holo": 19.57,
        },
        tcgplayer: {
          unit: "USD",
          normal: { productId: 88113, marketPrice: 10 },
          "reverse-holofoil": { productId: 88113, marketPrice: 20 },
        },
      },
    };

    expect(getMarketPrices(detail, "Normal").tcgplayer).toMatchObject({
      amount: 10,
      variant: "Normal",
    });
    expect(getMarketPrices(detail, "Reverse Holo").tcgplayer).toMatchObject({
      amount: 20,
      variant: "Reverse Holo",
    });
    expect(getMarketPrices(detail, "Reverse Holo").cardmarket).toMatchObject({
      amount: 128.71,
      variant: "Reverse Holo",
    });
  });

  it("uses the exact Cardmarket product link for duplicate-name cards", () => {
    const card: CatalogCard = {
      key: "en:ecard3-H22",
      groupKey: "ecard3:H22",
      id: "ecard3-H22",
      localId: "H22",
      name: "Piloswine",
      searchName: "piloswine ecard3-H22 H22",
      language: "en",
      languageLabel: "English",
      region: "International",
      setId: "ecard3",
      setName: "Skyridge",
      setSeries: "E-Card",
      setTotal: 144,
    };
    const prices = getMarketPrices(
      {
        id: "ecard3-H22",
        name: "Piloswine",
        variants: { holo: true, normal: false, reverse: false },
        pricing: {
          cardmarket: {
            unit: "EUR",
            idProduct: 275301,
            trend: 13.58,
            "trend-holo": 30.42,
          },
        },
      },
      "Holo",
      card,
    );

    expect(prices.cardmarketUrl).toBe(
      "https://www.cardmarket.com/en/Pokemon/Products/Singles/Skyridge/Piloswine-V1-SKH22?language=1,2&minCondition=5&isFoil=",
    );
  });

  it("returns null when no market quote exists", () => {
    expect(getMarketPrice(detail({}))).toBeNull();
  });
});

describe("catalog source filtering", () => {
  it("detects Pokémon TCG Pocket sets by series metadata", () => {
    expect(
      isDigitalOnlySet({
        id: "A1",
        name: "Genetic Apex",
        serie: { id: "tcgp", name: "Pokémon TCG Pocket" },
      }),
    ).toBe(true);
  });

  it("keeps physical Pokémon sets", () => {
    expect(
      isDigitalOnlySet({
        id: "sv10",
        name: "Destined Rivals",
        serie: { id: "sv", name: "Scarlet & Violet" },
      }),
    ).toBe(false);
  });
});

describe("restored card recovery", () => {
  it("adds collection cards missing from a refreshed upstream catalog", () => {
    const catalog: Catalog = {
      version: 8,
      fetchedAt: "2026-10-21T00:00:00.000Z",
      cards: [],
      sets: [],
      artists: [],
      failedLanguages: [],
    };
    const recovered = withRecoveredCards(catalog, [
      {
        id: "tcgcollector-import-43876",
        cardKey: "en:tcgcollector-43876",
        cardId: "tcgcollector-43876",
        language: "en",
        name: "Paras",
        image: "https://example.com/paras.jpg",
        setId: "tcgcollector-30th-c-venusaur",
        setName: "Pokémon TCG Classic (Venusaur)",
        quantity: 1,
        condition: "Unspecified",
        variant: "Normal",
        currency: "EUR",
        notes: "",
        addedAt: "2026-10-21T00:00:00.000Z",
        updatedAt: "2026-10-21T00:00:00.000Z",
      },
    ]);

    expect(recovered.cards).toHaveLength(1);
    expect(recovered.cards[0]).toMatchObject({
      key: "en:tcgcollector-43876",
      groupKey: "tcgcollector-30th-c-venusaur:43876",
      name: "Paras",
      image: "https://example.com/paras.jpg",
    });
  });
});
