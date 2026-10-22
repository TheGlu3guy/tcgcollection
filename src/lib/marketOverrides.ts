export interface CardmarketOverride {
  url: string;
  sourceCardId?: string;
  amountField?: "trend" | "trend-holo";
  disablePrice?: boolean;
}

// TCGdex currently associates a few duplicate-name vintage cards with the
// Cardmarket version for the other card number. These verified overrides keep
// both the displayed estimate and outbound link attached to the correct print.
export const CARDMARKET_OVERRIDES: Record<string, CardmarketOverride> = {
  "ecard3-24": {
    sourceCardId: "ecard3-H22",
    amountField: "trend",
    url: "https://www.cardmarket.com/en/Pokemon/Products/Singles/Skyridge/Piloswine-V2-SK24",
  },
  "ecard3-H22": {
    sourceCardId: "ecard3-24",
    amountField: "trend",
    url: "https://www.cardmarket.com/en/Pokemon/Products/Singles/Skyridge/Piloswine-V1-SKH22",
  },
  "ecard3-H25": {
    url: "https://www.cardmarket.com/en/Pokemon/Products/Singles/Skyridge/Raichu-V1-SKH25",
  },
  "ecard3-43": {
    disablePrice: true,
    url: "https://www.cardmarket.com/en/Pokemon/Products/Singles/Skyridge/Piloswine-SK43",
  },
  "ecard3-107": {
    sourceCardId: "ecard3-108",
    amountField: "trend",
    url: "https://www.cardmarket.com/en/Pokemon/Products/Singles/Skyridge/Swinub-SK107",
  },
  "ecard3-108": {
    sourceCardId: "ecard3-107",
    amountField: "trend",
    url: "https://www.cardmarket.com/en/Pokemon/Products/Singles/Skyridge/Swinub-SK108",
  },
};
