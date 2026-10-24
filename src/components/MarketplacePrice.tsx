import { ArrowUpRight } from "lucide-react";
import { formatCurrency } from "../lib/collection";
import type { PriceSnapshot } from "../types";

interface MarketplacePriceProps {
  cardName: string;
  marketplace: "TCGplayer" | "Cardmarket";
  price?: PriceSnapshot | null;
  url?: string;
}

function formatPrice(price?: PriceSnapshot | null): string {
  return price
    ? formatCurrency(
        price.amount,
        price.currency,
        price.currency === "USD" ? "en-US" : undefined,
      )
    : "\u2014";
}

export function MarketplacePrice({
  cardName,
  marketplace,
  price,
  url,
}: MarketplacePriceProps) {
  const priceText = formatPrice(price);
  const content = (
    <>
      <span className={`price-source ${marketplace.toLocaleLowerCase()}`}>
        {marketplace}
        {price?.variant && <small>{price.variant}</small>}
      </span>
      <strong>{priceText}</strong>
      {url && <ArrowUpRight className="price-link-icon" size={10} />}
      {url && <span className="sr-only"> for {cardName}, opens in new tab</span>}
    </>
  );

  return url ? (
    <a
      className="price-market-link"
      href={url}
      target="_blank"
      rel="noopener noreferrer"
    >
      {content}
    </a>
  ) : (
    <div className={price ? "" : "empty"}>{content}</div>
  );
}
