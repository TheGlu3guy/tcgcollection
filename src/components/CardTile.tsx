import {
  Check,
  Heart,
  ListPlus,
  Minus,
  Plus,
} from "lucide-react";
import { LANGUAGE_BY_CODE } from "../lib/constants";
import { imageUrl } from "../lib/catalog";
import type { CatalogCard, MarketPrices } from "../types";
import { MarketplacePrice } from "./MarketplacePrice";
import { CardImage } from "./Shared";

interface CardTileProps {
  card: CatalogCard;
  quantity: number;
  wishlisted: boolean;
  listCount: number;
  prices?: MarketPrices | null;
  priceLoading: boolean;
  selectionMode: boolean;
  selected: boolean;
  view: "grid" | "list";
  onToggleSelection: () => void;
  onOpen: () => void;
  onAdd: () => void;
  onRemove: () => void;
  onToggleWishlist: () => void;
  onManageLists: () => void;
}

export function CardTile({
  card,
  quantity,
  wishlisted,
  listCount,
  prices,
  priceLoading,
  selectionMode,
  selected,
  view,
  onToggleSelection,
  onOpen,
  onAdd,
  onRemove,
  onToggleWishlist,
  onManageLists,
}: CardTileProps) {
  const language = LANGUAGE_BY_CODE[card.language];
  const image = imageUrl(card.image) ?? prices?.imageUrl;
  const viewLabel = image
    ? `View ${card.name}`
    : `View ${card.name}, image unavailable`;
  const imageAccessibleLabel =
    quantity > 0 ? `${viewLabel}, ${quantity} owned` : viewLabel;
  const listActionLabel =
    listCount > 0 ? `Manage lists, ${listCount} selected` : "Manage lists";
  const openOrSelect = selectionMode ? onToggleSelection : onOpen;

  if (view === "list") {
    return (
      <article className={`card-row ${selectionMode ? "selection-mode" : ""} ${selected ? "selected" : ""}`}>
        <button
          className="card-row-image"
          type="button"
          onClick={openOrSelect}
          aria-label={selectionMode ? `${selected ? "Deselect" : "Select"} ${card.name}` : imageAccessibleLabel}
          aria-pressed={selectionMode ? selected : undefined}
        >
          <CardImage src={image} alt={card.name} />
          {selectionMode && (
            <span className="row-selection-mark">
              {selected && <Check size={14} />}
            </span>
          )}
        </button>
        <div className="card-row-main">
          <button className="card-name-button" type="button" onClick={openOrSelect}>
            <strong>{card.name}</strong>
          </button>
          <span>
            {card.setName} · {card.localId}
            {card.setTotal ? `/${card.setTotal}` : ""}
          </span>
        </div>
        <div className="card-row-language">
          <span aria-hidden="true">{language.flag}</span>
          {language.shortLabel}
        </div>
        <div className={`list-card-prices ${priceLoading ? "loading" : ""}`}>
          <MarketplacePrice
            cardName={card.name}
            marketplace="TCGplayer"
            price={prices?.tcgplayer}
            url={prices?.tcgplayerUrl}
          />
          <MarketplacePrice
            cardName={card.name}
            marketplace="Cardmarket"
            price={prices?.cardmarket}
            url={prices?.cardmarketUrl}
          />
        </div>
        {!selectionMode && <div className="card-row-actions">
          <button
            className={`icon-button ${wishlisted ? "is-active" : ""}`}
            type="button"
            onClick={onToggleWishlist}
            aria-label={wishlisted ? "Remove from wishlist" : "Add to wishlist"}
          >
            <Heart size={18} fill={wishlisted ? "currentColor" : "none"} />
          </button>
          <button
            className="icon-button"
            type="button"
            onClick={onManageLists}
            aria-label={listActionLabel}
          >
            <ListPlus size={18} />
            {listCount > 0 && <span className="micro-badge">{listCount}</span>}
          </button>
          <div className="stepper">
            <button
              type="button"
              onClick={onRemove}
              disabled={quantity === 0}
              aria-label="Remove one copy"
            >
              <Minus size={15} />
            </button>
            <span>{quantity}</span>
            <button type="button" onClick={onAdd} aria-label="Add one copy">
              <Plus size={15} />
            </button>
          </div>
        </div>}
      </article>
    );
  }

  return (
    <article className={`card-tile ${selectionMode ? "selection-mode" : ""} ${selected ? "selected" : ""}`}>
      <button
        className="card-tile-image"
        type="button"
        onClick={openOrSelect}
        aria-label={selectionMode ? `${selected ? "Deselect" : "Select"} ${card.name}` : imageAccessibleLabel}
        aria-pressed={selectionMode ? selected : undefined}
      >
        <CardImage src={image} alt={card.name} />
        {quantity > 0 && (
          <span className="owned-pill">
            <Check size={13} /> {quantity} owned
          </span>
        )}
      </button>
      {selectionMode ? (
        <span className={`card-selection-mark ${selected ? "active" : ""}`}>
          {selected && <Check size={16} />}
        </span>
      ) : <div className="card-tile-overlay">
        <button
          className={`tile-action ${wishlisted ? "is-active" : ""}`}
          type="button"
          onClick={onToggleWishlist}
          aria-label={wishlisted ? "Remove from wishlist" : "Add to wishlist"}
        >
          <Heart size={17} fill={wishlisted ? "currentColor" : "none"} />
        </button>
        <button
          className="tile-action"
          type="button"
          onClick={onManageLists}
          aria-label={listActionLabel}
        >
          <ListPlus size={17} />
          {listCount > 0 && <span className="micro-badge">{listCount}</span>}
        </button>
      </div>}
      <div className="card-tile-copy">
        <button className="card-name-button" type="button" onClick={openOrSelect}>
          {card.name}
        </button>
        <div className="card-meta">
          <span className="language-chip" title={language.label}>
            {language.flag} {language.shortLabel}
          </span>
          <span title={card.setName}>
            {card.setName} · {card.localId}
          </span>
        </div>
        <div className={`card-prices ${priceLoading ? "loading" : ""}`}>
          <MarketplacePrice
            cardName={card.name}
            marketplace="TCGplayer"
            price={prices?.tcgplayer}
            url={prices?.tcgplayerUrl}
          />
          <MarketplacePrice
            cardName={card.name}
            marketplace="Cardmarket"
            price={prices?.cardmarket}
            url={prices?.cardmarketUrl}
          />
        </div>
        {!selectionMode && <div className="card-tile-stepper">
          <button
            type="button"
            onClick={onRemove}
            disabled={quantity === 0}
            aria-label="Remove one copy"
          >
            <Minus size={14} />
          </button>
          <span>{quantity}</span>
          <button type="button" onClick={onAdd} aria-label="Add one copy">
            <Plus size={14} />
          </button>
        </div>}
      </div>
    </article>
  );
}
