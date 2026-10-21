import { useEffect, useMemo, useState } from "react";
import {
  ArrowUpRight,
  Bookmark,
  Check,
  ChevronDown,
  Heart,
  Library,
  LoaderCircle,
  Minus,
  Plus,
  Sparkles,
} from "lucide-react";
import { CONDITIONS, LANGUAGE_BY_CODE, VARIANTS } from "../lib/constants";
import { getMarketPrices, imageUrl, loadCardDetail } from "../lib/catalog";
import {
  formatCurrency,
  updateCardCopy,
} from "../lib/collection";
import type {
  AppData,
  CardCopy,
  CardDetail,
  CatalogCard,
} from "../types";
import { CardImage, CloseButton, Modal } from "./Shared";

interface CardDetailModalProps {
  card: CatalogCard;
  data: AppData;
  languageVariants: CatalogCard[];
  onClose: () => void;
  onAdd: (options: {
    condition: string;
    variant: string;
    marketPrice?: number;
    currency?: string;
    types?: string[];
    dexIds?: number[];
    rarity?: string;
  }) => void;
  onRemoveOne: () => void;
  onWishlist: () => void;
  onDataChange: (next: AppData) => void;
  onChangeList: (listId: string) => void;
  onCreateList: () => void;
  onSwitchLanguage: (card: CatalogCard) => void;
}

export function CardDetailModal({
  card,
  data,
  languageVariants,
  onClose,
  onAdd,
  onRemoveOne,
  onWishlist,
  onDataChange,
  onChangeList,
  onCreateList,
  onSwitchLanguage,
}: CardDetailModalProps) {
  const [detail, setDetail] = useState<CardDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [condition, setCondition] = useState(data.preferences.defaultCondition);
  const [variant, setVariant] = useState(data.preferences.defaultVariant);
  const [notes, setNotes] = useState(data.notes[card.key] ?? "");

  useEffect(() => {
    const controller = new AbortController();
    setLoading(true);
    setError("");
    loadCardDetail(card.language, card.id, controller.signal, true)
      .then(setDetail)
      .catch((reason) => {
        if (!controller.signal.aborted) {
          setError(reason instanceof Error ? reason.message : "Details could not be loaded.");
        }
      })
      .finally(() => {
        if (!controller.signal.aborted) setLoading(false);
      });
    return () => controller.abort();
  }, [card.id, card.language]);

  const variantKeys = new Set(languageVariants.map((variant) => variant.key));
  const ownedCopies = data.collection.filter((copy) => variantKeys.has(copy.cardKey));
  const quantity = ownedCopies.reduce((total, copy) => total + copy.quantity, 0);
  const marketPrices = useMemo(() => getMarketPrices(detail), [detail]);
  const price = marketPrices.tcgplayer ?? marketPrices.cardmarket;
  const language = LANGUAGE_BY_CODE[card.language];
  const wishlisted = data.wishlist.some((key) => variantKeys.has(key));
  const inLists = data.lists.filter((list) =>
    list.cardKeys.some((key) => variantKeys.has(key)),
  );
  const image =
    imageUrl(detail?.image ?? card.image, "high") ?? marketPrices.imageUrl;

  const updateNotes = (value: string) => {
    setNotes(value);
    const next = { ...data, notes: { ...data.notes, [card.key]: value } };
    if (!value) delete next.notes[card.key];
    onDataChange(next);
  };

  const updateCopy = (copy: CardCopy, patch: Partial<CardCopy>) => {
    onDataChange(updateCardCopy(data, copy.id, patch));
  };

  return (
    <Modal onClose={onClose} className="card-detail-modal" labelledBy="card-detail-title">
      <div className="card-detail-topbar">
        <label className="detail-language-select">
          <span className={`region-dot region-${card.region.toLocaleLowerCase()}`} />
          <span>{language.flag}</span>
          <select
            value={card.language}
            onChange={(event) => {
              const next = languageVariants.find(
                (variant) => variant.language === event.target.value,
              );
              if (next) onSwitchLanguage(next);
            }}
            aria-label="Card language"
          >
            {languageVariants.map((variant) => (
              <option key={variant.key} value={variant.language}>
                {LANGUAGE_BY_CODE[variant.language].label}
              </option>
            ))}
          </select>
          <ChevronDown size={13} />
          <small>{languageVariants.length} available</small>
        </label>
        <CloseButton onClick={onClose} />
      </div>

      <div className="card-detail-layout">
        <div className="card-detail-visual">
          <CardImage src={image} alt={detail?.name ?? card.name} className="detail-card-image" />
          <div className="card-detail-quick-actions">
            <button
              type="button"
              className={`secondary-button ${wishlisted ? "is-active" : ""}`}
              onClick={onWishlist}
            >
              <Heart size={17} fill={wishlisted ? "currentColor" : "none"} />
              {wishlisted ? "Wishlisted" : "Wishlist"}
            </button>
            <button
              type="button"
              className="secondary-button"
              onClick={() => {
                const firstList = data.lists[0];
                if (firstList) onChangeList(firstList.id);
                else onCreateList();
              }}
            >
              <Bookmark size={17} />
              {inLists.length ? `In ${inLists.length} list${inLists.length > 1 ? "s" : ""}` : "Add to list"}
            </button>
          </div>
        </div>

        <div className="card-detail-content">
          <div className="card-detail-heading">
            <div>
              <p className="eyebrow">{card.setName}</p>
              <h2 id="card-detail-title">{detail?.name ?? card.name}</h2>
              <p className="card-detail-subtitle">
                #{card.localId}
                {card.setTotal ? ` / ${card.setTotal}` : ""}
                {detail?.illustrator ? ` · Illustrated by ${detail.illustrator}` : ""}
              </p>
            </div>
            <div className="market-price-block">
              <span>Market estimate</span>
              {loading ? (
                <LoaderCircle className="spin" size={21} />
              ) : price ? (
                <strong>{formatCurrency(price.amount, price.currency)}</strong>
              ) : (
                <strong>—</strong>
              )}
              {price && <small>{price.source}</small>}
            </div>
          </div>

          {error && (
            <div className="inline-notice">
              Card image and catalog basics are available, but live details could not be loaded. {error}
            </div>
          )}

          <div className="detail-facts">
            <div>
              <span>Category</span>
              <strong>{detail?.category ?? "Loading…"}</strong>
            </div>
            <div>
              <span>Rarity</span>
              <strong>{detail?.rarity ?? "—"}</strong>
            </div>
            <div>
              <span>Type</span>
              <strong>{detail?.types?.join(", ") ?? "—"}</strong>
            </div>
            <div>
              <span>HP</span>
              <strong>{detail?.hp ?? "—"}</strong>
            </div>
          </div>

          <div className="add-copy-panel">
            <div className="add-copy-title">
              <span className="panel-icon">
                <Library size={17} />
              </span>
              <div>
                <strong>Add to my collection</strong>
                <span>{quantity ? `${quantity} already owned` : "Keep track of every print and condition"}</span>
              </div>
            </div>
            <div className="add-copy-controls">
              <label>
                <span>Condition</span>
                <div className="select-wrap">
                  <select value={condition} onChange={(event) => setCondition(event.target.value)}>
                    {CONDITIONS.map((item) => (
                      <option key={item}>{item}</option>
                    ))}
                  </select>
                  <ChevronDown size={14} />
                </div>
              </label>
              <label>
                <span>Variant</span>
                <div className="select-wrap">
                  <select value={variant} onChange={(event) => setVariant(event.target.value)}>
                    {VARIANTS.map((item) => (
                      <option key={item}>{item}</option>
                    ))}
                  </select>
                  <ChevronDown size={14} />
                </div>
              </label>
              <button
                className="primary-button add-copy-button"
                type="button"
                onClick={() =>
                  onAdd({
                    condition,
                    variant,
                    marketPrice: price?.amount,
                    currency: price?.currency,
                    types: detail?.types,
                    dexIds: detail?.dexId,
                    rarity: detail?.rarity,
                  })
                }
              >
                <Plus size={18} />
                Add copy
              </button>
            </div>
            {quantity > 0 && (
              <div className="quantity-control">
                <button type="button" onClick={onRemoveOne} aria-label="Remove one copy">
                  <Minus size={16} />
                </button>
                <strong>{quantity}</strong>
                <button
                  type="button"
                  onClick={() =>
                    onAdd({
                      condition,
                      variant,
                      marketPrice: price?.amount,
                      currency: price?.currency,
                      types: detail?.types,
                      dexIds: detail?.dexId,
                      rarity: detail?.rarity,
                    })
                  }
                  aria-label="Add one copy"
                >
                  <Plus size={16} />
                </button>
                <span>copies in collection</span>
              </div>
            )}
          </div>

          {ownedCopies.length > 0 && (
            <details className="owned-copies">
              <summary>
                My copies <span>{ownedCopies.length} print group{ownedCopies.length > 1 ? "s" : ""}</span>
              </summary>
              <div className="owned-copy-list">
                {ownedCopies.map((copy) => (
                  <div className="owned-copy" key={copy.id}>
                    <span>{copy.quantity}×</span>
                    <select
                      value={copy.condition}
                      onChange={(event) => updateCopy(copy, { condition: event.target.value })}
                      aria-label="Copy condition"
                    >
                      {CONDITIONS.map((item) => (
                        <option key={item}>{item}</option>
                      ))}
                    </select>
                    <select
                      value={copy.variant}
                      onChange={(event) => updateCopy(copy, { variant: event.target.value })}
                      aria-label="Copy variant"
                    >
                      {VARIANTS.map((item) => (
                        <option key={item}>{item}</option>
                      ))}
                    </select>
                    <input
                      type="number"
                      min="1"
                      value={copy.quantity}
                      onChange={(event) =>
                        updateCopy(copy, { quantity: Math.max(1, Number(event.target.value)) })
                      }
                      aria-label="Quantity"
                    />
                    <button
                      className="text-danger"
                      type="button"
                      onClick={() => updateCopy(copy, { quantity: 0 })}
                    >
                      Remove
                    </button>
                  </div>
                ))}
              </div>
            </details>
          )}

          {data.lists.length > 0 && (
            <div className="detail-list-picker">
              <p className="section-mini-title">
                <Bookmark size={15} /> Lists
              </p>
              <div className="list-checks">
                {data.lists.map((list) => {
                  const checked = list.cardKeys.some((key) => variantKeys.has(key));
                  return (
                    <label key={list.id} className={checked ? "checked" : ""}>
                      <input
                        type="checkbox"
                        checked={checked}
                        onChange={() => onChangeList(list.id)}
                      />
                      <span className="list-color-dot" style={{ background: list.color }} />
                      {list.name}
                      {checked && <Check size={14} />}
                    </label>
                  );
                })}
                <button type="button" className="new-list-inline" onClick={onCreateList}>
                  <Plus size={14} /> New list
                </button>
              </div>
            </div>
          )}

          {!loading && detail && (
            <details className="card-rules" open>
              <summary>
                <Sparkles size={16} /> Card details
              </summary>
              {detail.abilities?.map((ability) => (
                <div className="rule-block ability-block" key={ability.name}>
                  <span>{ability.type ?? "Ability"}</span>
                  <strong>{ability.name}</strong>
                  {ability.effect && <p>{ability.effect}</p>}
                </div>
              ))}
              {detail.attacks?.map((attack) => (
                <div className="rule-block" key={attack.name}>
                  <div className="attack-heading">
                    <strong>{attack.name}</strong>
                    <span>{attack.damage ?? ""}</span>
                  </div>
                  {attack.effect && <p>{attack.effect}</p>}
                </div>
              ))}
              {detail.description && <p className="flavor-text">{detail.description}</p>}
              <div className="legal-row">
                {Object.entries(detail.legal ?? {}).map(([format, legal]) => (
                  <span key={format} className={legal ? "legal" : "not-legal"}>
                    {format}: {legal ? "Legal" : "Not legal"}
                  </span>
                ))}
              </div>
            </details>
          )}

          <label className="notes-field">
            <span>Personal note</span>
            <textarea
              value={notes}
              onChange={(event) => updateNotes(event.target.value)}
              placeholder="Where you got it, grading, trade history…"
              rows={3}
            />
          </label>

          <div className="card-detail-footer">
            <span>{card.setSeries}</span>
            <a
              href={`https://tcgdex.dev/cards/${card.language}/${encodeURIComponent(card.id)}`}
              target="_blank"
              rel="noreferrer"
            >
              View on TCGdex <ArrowUpRight size={14} />
            </a>
          </div>
        </div>
      </div>
    </Modal>
  );
}
