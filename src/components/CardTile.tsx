import {
  Check,
  Heart,
  ListPlus,
  Minus,
  Plus,
} from "lucide-react";
import { LANGUAGE_BY_CODE } from "../lib/constants";
import { imageUrl } from "../lib/catalog";
import type { CatalogCard } from "../types";
import { CardImage } from "./Shared";

interface CardTileProps {
  card: CatalogCard;
  quantity: number;
  wishlisted: boolean;
  listCount: number;
  view: "grid" | "list";
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
  view,
  onOpen,
  onAdd,
  onRemove,
  onToggleWishlist,
  onManageLists,
}: CardTileProps) {
  const language = LANGUAGE_BY_CODE[card.language];
  const image = imageUrl(card.image);
  const viewLabel = image
    ? `View ${card.name}`
    : `View ${card.name}, image unavailable`;

  if (view === "list") {
    return (
      <article className="card-row">
        <button className="card-row-image" type="button" onClick={onOpen} aria-label={viewLabel}>
          <CardImage src={image} alt={card.name} />
        </button>
        <div className="card-row-main">
          <button className="card-name-button" type="button" onClick={onOpen}>
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
        <div className="card-row-actions">
          <button
            className={`icon-button ${wishlisted ? "is-active" : ""}`}
            type="button"
            onClick={onToggleWishlist}
            aria-label={wishlisted ? "Remove from wishlist" : "Add to wishlist"}
          >
            <Heart size={18} fill={wishlisted ? "currentColor" : "none"} />
          </button>
          <button className="icon-button" type="button" onClick={onManageLists} aria-label="Manage lists">
            <ListPlus size={18} />
            {listCount > 0 && <span className="micro-badge">{listCount}</span>}
          </button>
          <div className="stepper">
            <button type="button" onClick={onRemove} disabled={quantity === 0} aria-label="Remove one copy">
              <Minus size={15} />
            </button>
            <span>{quantity}</span>
            <button type="button" onClick={onAdd} aria-label="Add one copy">
              <Plus size={15} />
            </button>
          </div>
        </div>
      </article>
    );
  }

  return (
    <article className="card-tile">
      <button className="card-tile-image" type="button" onClick={onOpen} aria-label={viewLabel}>
        <CardImage src={image} alt={card.name} />
        {quantity > 0 && (
          <span className="owned-pill">
            <Check size={13} /> {quantity} owned
          </span>
        )}
      </button>
      <div className="card-tile-overlay">
        <button
          className={`tile-action ${wishlisted ? "is-active" : ""}`}
          type="button"
          onClick={onToggleWishlist}
          aria-label={wishlisted ? "Remove from wishlist" : "Add to wishlist"}
        >
          <Heart size={17} fill={wishlisted ? "currentColor" : "none"} />
        </button>
        <button className="tile-action" type="button" onClick={onManageLists} aria-label="Manage lists">
          <ListPlus size={17} />
          {listCount > 0 && <span className="micro-badge">{listCount}</span>}
        </button>
      </div>
      <div className="card-tile-copy">
        <button className="card-name-button" type="button" onClick={onOpen}>
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
        <div className="card-tile-stepper">
          <button type="button" onClick={onRemove} disabled={quantity === 0} aria-label="Remove one copy">
            <Minus size={14} />
          </button>
          <span>{quantity}</span>
          <button type="button" onClick={onAdd} aria-label="Add one copy">
            <Plus size={14} />
          </button>
        </div>
      </div>
    </article>
  );
}
