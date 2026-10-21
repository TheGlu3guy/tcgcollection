import { useMemo, useState } from "react";
import {
  Archive,
  Download,
  FolderHeart,
  Heart,
  Library,
  ListPlus,
  MoreHorizontal,
  Pencil,
  Plus,
  Search,
  Trash2,
} from "lucide-react";
import {
  formatCurrency,
  formatNumber,
} from "../lib/collection";
import { imageUrl } from "../lib/catalog";
import type { AppData, CardList, Catalog, CatalogCard } from "../types";
import { CardImage, EmptyState, ProgressBar } from "../components/Shared";
import { getStoredCopyGroupKey, getVisibleCards } from "../lib/cardGroups";

interface ListsPageProps {
  catalog: Catalog;
  data: AppData;
  onCreateList: () => void;
  onEditList: (list: CardList) => void;
  onDeleteList: (list: CardList) => void;
  onOpenCard: (card: CatalogCard) => void;
  onWishlist: (card: CatalogCard) => void;
  onAdd: (card: CatalogCard) => void;
  onRemove: (card: CatalogCard) => void;
  onManageLists: (card: CatalogCard) => void;
}

type ListKey = "collection" | "wishlist" | string;

function safeFileName(name: string): string {
  return name
    .toLocaleLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "");
}

export function ListsPage({
  catalog,
  data,
  onCreateList,
  onEditList,
  onDeleteList,
  onOpenCard,
  onWishlist,
  onAdd,
  onRemove,
  onManageLists,
}: ListsPageProps) {
  const [selected, setSelected] = useState<ListKey>("collection");
  const [query, setQuery] = useState("");
  const [menuOpen, setMenuOpen] = useState(false);
  const cardByKey = useMemo(
    () => new Map(catalog.cards.map((card) => [card.key, card])),
    [catalog.cards],
  );
  const quantityByGroup = useMemo(
    () =>
      data.collection.reduce<Map<string, number>>((counts, copy) => {
        const groupKey = getStoredCopyGroupKey(copy, cardByKey);
        counts.set(groupKey, (counts.get(groupKey) ?? 0) + copy.quantity);
        return counts;
      }, new Map()),
    [cardByKey, data.collection],
  );
  const wishlistGroups = useMemo(
    () =>
      new Set(
        data.wishlist.map((key) => cardByKey.get(key)?.groupKey ?? key),
      ),
    [cardByKey, data.wishlist],
  );
  const collectionGroupCount = quantityByGroup.size;
  const selectedCustomList = data.lists.find((list) => list.id === selected);
  const selectedKeys = new Set(
    selected === "collection"
      ? data.collection.map((copy) => copy.cardKey)
      : selected === "wishlist"
        ? data.wishlist
        : (selectedCustomList?.cardKeys ?? []),
  );
  const selectedCards = [...selectedKeys]
    .map((key) => cardByKey.get(key))
    .filter((card): card is CatalogCard => Boolean(card));
  const cards = getVisibleCards(
    selectedCards,
    data.preferences.catalogLanguage,
  )
    .filter((card) => {
      const normalizedQuery = query.trim().toLocaleLowerCase();
      return (
        !normalizedQuery ||
        card.name.toLocaleLowerCase().includes(normalizedQuery) ||
        card.setName.toLocaleLowerCase().includes(normalizedQuery)
      );
    });
  const selectedName =
    selected === "collection"
      ? "My collection"
      : selected === "wishlist"
        ? "Wishlist"
        : (selectedCustomList?.name ?? "List");
  const selectedValue = cards.reduce(
    (total, card) =>
      total +
      data.collection
        .filter((copy) => copy.cardKey === card.key)
        .reduce((sum, copy) => sum + (copy.marketPrice ?? 0) * copy.quantity, 0),
    0,
  );

  const exportCsv = () => {
    const rows = cards.map((card) => {
      const copies = data.collection.filter((copy) => copy.cardKey === card.key);
      const quantity = copies.reduce((total, copy) => total + copy.quantity, 0);
      return [
        card.name,
        card.setName,
        card.localId,
        card.languageLabel,
        quantity,
        [...new Set(copies.map((copy) => copy.condition))].join(" / "),
        [...new Set(copies.map((copy) => copy.variant))].join(" / "),
        data.notes[card.key] ?? "",
      ]
        .map((value) => `"${String(value).replaceAll('"', '""')}"`)
        .join(",");
    });
    const csv = [
      "Card,Set,Number,Language,Quantity,Conditions,Variants,Notes",
      ...rows,
    ].join("\n");
    const url = URL.createObjectURL(new Blob([csv], { type: "text/csv;charset=utf-8" }));
    const link = document.createElement("a");
    link.href = url;
    link.download = `${safeFileName(selectedName)}.csv`;
    link.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="page-stack lists-page">
      <section className="catalog-heading">
        <div>
          <span className="eyebrow">Organize your way</span>
          <h1>Lists</h1>
          <p>Wishlist cards, plan trades, build binders, or curate a display shelf.</p>
        </div>
        <button className="primary-button" type="button" onClick={onCreateList}>
          <Plus size={17} /> New list
        </button>
      </section>

      <div className="lists-layout">
        <aside className="list-sidebar">
          <div className="list-sidebar-title">Your library</div>
          <button
            type="button"
            className={`list-nav-item ${selected === "collection" ? "active" : ""}`}
            onClick={() => setSelected("collection")}
          >
            <span className="list-nav-icon collection"><Library size={17} /></span>
            <div>
              <strong>My collection</strong>
              <span>{collectionGroupCount} unique</span>
            </div>
          </button>
          <button
            type="button"
            className={`list-nav-item ${selected === "wishlist" ? "active" : ""}`}
            onClick={() => setSelected("wishlist")}
          >
            <span className="list-nav-icon wishlist"><Heart size={17} /></span>
            <div>
              <strong>Wishlist</strong>
              <span>{wishlistGroups.size} {wishlistGroups.size === 1 ? "card" : "cards"}</span>
            </div>
          </button>

          <div className="list-sidebar-title custom">
            Custom lists
            <button type="button" onClick={onCreateList} aria-label="Create list">
              <Plus size={15} />
            </button>
          </div>
          {data.lists.length === 0 && (
            <p className="sidebar-empty-copy">Create a list for trades, decks, or that impossible chase.</p>
          )}
          {data.lists.map((list) => (
            <button
              type="button"
              key={list.id}
              className={`list-nav-item ${selected === list.id ? "active" : ""}`}
              onClick={() => setSelected(list.id)}
            >
              <span className="custom-list-dot" style={{ background: list.color }} />
              <div>
                <strong>{list.name}</strong>
                <span>
                  {new Set(list.cardKeys.map((key) => cardByKey.get(key)?.groupKey ?? key)).size}{" "}
                  {new Set(list.cardKeys.map((key) => cardByKey.get(key)?.groupKey ?? key)).size === 1
                    ? "card"
                    : "cards"}
                </span>
              </div>
            </button>
          ))}
        </aside>

        <main className="list-main">
          <div className="list-main-heading">
            <div>
              <span className="eyebrow">
                {selected === "wishlist"
                  ? "Cards to chase"
                  : selectedCustomList
                    ? selectedCustomList.description || "Custom collection list"
                    : "Everything you own"}
              </span>
              <h2>{selectedName}</h2>
              <p>
                {formatNumber(cards.length)} {cards.length === 1 ? "card" : "cards"}
                {selected === "collection" && ` · ${formatNumber(data.collection.reduce((sum, copy) => sum + copy.quantity, 0))} copies`}
                {selectedValue > 0 &&
                  ` · ${formatCurrency(selectedValue, data.preferences.collectionValueCurrency)} tracked value`}
              </p>
            </div>
            <div className="list-heading-actions">
              <label className="list-search">
                <Search size={16} />
                <input
                  type="search"
                  value={query}
                  onChange={(event) => setQuery(event.target.value)}
                  placeholder="Search this list…"
                />
              </label>
              <button className="icon-button" type="button" onClick={exportCsv} aria-label="Export list as CSV">
                <Download size={18} />
              </button>
              {selectedCustomList && (
                <div className="menu-wrap">
                  <button
                    className="icon-button"
                    type="button"
                    onClick={() => setMenuOpen((open) => !open)}
                    aria-label="List options"
                  >
                    <MoreHorizontal size={19} />
                  </button>
                  {menuOpen && (
                    <div className="context-menu">
                      <button
                        type="button"
                        onClick={() => {
                          setMenuOpen(false);
                          onEditList(selectedCustomList);
                        }}
                      >
                        <Pencil size={15} /> Edit list
                      </button>
                      <button
                        type="button"
                        className="danger"
                        onClick={() => {
                          setMenuOpen(false);
                          onDeleteList(selectedCustomList);
                          setSelected("collection");
                        }}
                      >
                        <Trash2 size={15} /> Delete list
                      </button>
                    </div>
                  )}
                </div>
              )}
            </div>
          </div>

          {cards.length === 0 ? (
            <EmptyState
              icon={
                selected === "wishlist" ? (
                  <Heart size={29} />
                ) : selectedCustomList ? (
                  <FolderHeart size={29} />
                ) : (
                  <Archive size={29} />
                )
              }
              title={
                query
                  ? "No cards match that search"
                  : selected === "wishlist"
                    ? "Your wishlist is waiting"
                    : selectedCustomList
                      ? "This list is empty"
                      : "Your binder is empty"
              }
              action={
                selectedCustomList ? (
                  <button className="secondary-button" type="button" onClick={() => setQuery("")}>
                    Clear search
                  </button>
                ) : undefined
              }
            >
              {query
                ? "Try a different card or set name."
                : "Open the card catalog and use the heart or plus controls to add cards."}
            </EmptyState>
          ) : (
            <div className="saved-card-grid">
              {cards.map((card) => {
                const quantity = quantityByGroup.get(card.groupKey) ?? 0;
                const wishlisted = wishlistGroups.has(card.groupKey);
                return (
                  <article className="saved-card" key={card.key}>
                    <button
                      className="saved-card-image"
                      type="button"
                      onClick={() => onOpenCard(card)}
                      aria-label={card.image ? `View ${card.name}` : `View ${card.name}, image unavailable`}
                    >
                      <CardImage src={imageUrl(card.image)} alt={card.name} />
                    </button>
                    <div className="saved-card-copy">
                      <div>
                        <button type="button" className="card-name-button" onClick={() => onOpenCard(card)}>
                          {card.name}
                        </button>
                        <span>{card.setName} · {card.localId} · {card.languageLabel}</span>
                      </div>
                      <div className="saved-card-actions">
                        <button
                          type="button"
                          className={wishlisted ? "heart-button active" : "heart-button"}
                          onClick={() => onWishlist(card)}
                          aria-label={wishlisted ? "Remove from wishlist" : "Add to wishlist"}
                        >
                          <Heart size={16} fill={wishlisted ? "currentColor" : "none"} />
                        </button>
                        <button type="button" className="mini-stepper-button" onClick={() => onRemove(card)} disabled={quantity === 0}>
                          −
                        </button>
                        <span>{quantity}</span>
                        <button type="button" className="mini-stepper-button" onClick={() => onAdd(card)}>
                          +
                        </button>
                        <button
                          type="button"
                          className="text-icon-button"
                          onClick={() => onManageLists(card)}
                          aria-label="Manage lists"
                        >
                          <ListPlus size={16} />
                        </button>
                      </div>
                    </div>
                  </article>
                );
              })}
            </div>
          )}
        </main>
      </div>
    </div>
  );
}
