import { useEffect, useMemo, useState } from "react";
import {
  CirclePlus,
  Check,
  ChevronDown,
  Filter,
  Grid2X2,
  Heart,
  HeartOff,
  LayoutList,
  ListPlus,
  MousePointer2,
  RefreshCw,
  Search,
  SlidersHorizontal,
  X,
} from "lucide-react";
import { LANGUAGE_BY_CODE, LANGUAGES, REGIONS } from "../lib/constants";
import {
  filterCards,
  formatNumber,
  sortCardsByPrice,
} from "../lib/collection";
import {
  getStoredCopyGroupKey,
  getVisibleCards,
  getVisibleSets,
} from "../lib/cardGroups";
import type {
  AppData,
  CardFilters,
  CardSort,
  CardView,
  Catalog,
  CatalogCard,
  LanguageCode,
  MarketPrices,
  Region,
} from "../types";
import { CardTile } from "../components/CardTile";
import { EmptyState } from "../components/Shared";
import { loadMarketPrices } from "../lib/catalog";

interface CardsPageProps {
  catalog: Catalog;
  data: AppData;
  filters: CardFilters;
  setFilters: (filters: CardFilters) => void;
  view: CardView;
  setView: (view: CardView) => void;
  onOpenCard: (card: CatalogCard) => void;
  onAdd: (card: CatalogCard) => void;
  onRemove: (card: CatalogCard) => void;
  onWishlist: (card: CatalogCard) => void;
  onManageLists: (card: CatalogCard) => void;
  onBulkWishlist: (cards: CatalogCard[], add: boolean) => void;
  onBulkCollection: (cards: CatalogCard[]) => void;
  onBulkList: (cards: CatalogCard[]) => void;
  onSync: () => void;
  syncing: boolean;
}

const PAGE_SIZE = 72;
const PRICE_SORT_LIMIT = 1000;

export function CardsPage({
  catalog,
  data,
  filters,
  setFilters,
  view,
  setView,
  onOpenCard,
  onAdd,
  onRemove,
  onWishlist,
  onManageLists,
  onBulkWishlist,
  onBulkCollection,
  onBulkList,
  onSync,
  syncing,
}: CardsPageProps) {
  const [visibleCount, setVisibleCount] = useState(PAGE_SIZE);
  const [advancedOpen, setAdvancedOpen] = useState(false);
  const [prices, setPrices] = useState<Record<string, MarketPrices>>({});
  const [pricingLoading, setPricingLoading] = useState<Set<string>>(new Set());
  const [priceChecked, setPriceChecked] = useState<Set<string>>(new Set());
  const [selectionMode, setSelectionMode] = useState(false);
  const [selectedKeys, setSelectedKeys] = useState<Set<string>>(new Set());
  const filteredCards = useMemo(
    () => filterCards(catalog.cards, filters, data),
    [catalog.cards, data, filters],
  );
  const cardsByKey = useMemo(
    () => new Map(catalog.cards.map((card) => [card.key, card])),
    [catalog.cards],
  );
  const quantityByGroup = useMemo(
    () =>
      data.collection.reduce<Map<string, number>>((counts, copy) => {
        const groupKey = getStoredCopyGroupKey(copy, cardsByKey);
        counts.set(groupKey, (counts.get(groupKey) ?? 0) + copy.quantity);
        return counts;
      }, new Map()),
    [cardsByKey, data.collection],
  );
  const wishlistGroups = useMemo(
    () =>
      new Set(
        data.wishlist.map((key) => cardsByKey.get(key)?.groupKey ?? key),
      ),
    [cardsByKey, data.wishlist],
  );
  const listCountByGroup = useMemo(() => {
    const counts = new Map<string, number>();
    for (const list of data.lists) {
      for (const groupKey of new Set(
        list.cardKeys.map((key) => cardsByKey.get(key)?.groupKey ?? key),
      )) {
        counts.set(groupKey, (counts.get(groupKey) ?? 0) + 1);
      }
    }
    return counts;
  }, [cardsByKey, data.lists]);
  const preferredVariantByCardKey = useMemo(() => {
    const variants = new Map<string, Set<string>>();
    for (const copy of data.collection) {
      const current = variants.get(copy.cardKey) ?? new Set<string>();
      current.add(copy.variant);
      variants.set(copy.cardKey, current);
    }
    return new Map(
      [...variants.entries()]
        .filter(([, values]) => values.size === 1)
        .map(([cardKey, values]) => [cardKey, [...values][0]]),
    );
  }, [data.collection]);
  const uniqueCardCount = useMemo(
    () => getVisibleCards(catalog.cards, filters.language).length,
    [catalog.cards, filters.language],
  );
  const setsForLanguage = useMemo(
    () =>
      getVisibleSets(catalog.sets, filters.language)
        .filter((set) => filters.region === "all" || set.region === filters.region)
        .sort((a, b) => (b.releaseDate ?? "").localeCompare(a.releaseDate ?? "")),
    [catalog.sets, filters.language, filters.region],
  );
  const priceSortActive = filters.sort === "price-asc" || filters.sort === "price-desc";
  const sortedCards = useMemo(
    () =>
      priceSortActive
        ? sortCardsByPrice(filteredCards, prices, filters.sort as "price-asc" | "price-desc")
        : filteredCards,
    [filteredCards, filters.sort, priceSortActive, prices],
  );
  const visibleCards = sortedCards.slice(0, visibleCount);
  const priceFetchCards = useMemo(
    () =>
      priceSortActive
        ? filteredCards.slice(0, PRICE_SORT_LIMIT)
        : visibleCards,
    [filteredCards, priceSortActive, visibleCards],
  );
  const selectedCards = useMemo(
    () => filteredCards.filter((card) => selectedKeys.has(card.key)),
    [filteredCards, selectedKeys],
  );
  const allFilteredSelected =
    filteredCards.length > 0 && selectedCards.length === filteredCards.length;
  const visiblePriceSignature = priceFetchCards
    .map(
      (card) =>
        `${card.key}:${preferredVariantByCardKey.get(card.key) ?? "auto"}`,
    )
    .join("|");
  const priceSortLoading =
    priceSortActive &&
    priceFetchCards.some((card) => !priceChecked.has(card.key));
  const priceSortTruncated =
    priceSortActive && filteredCards.length > PRICE_SORT_LIMIT;
  const activeFilterCount = [
    filters.region !== "all",
    filters.language !== "all",
    filters.setId !== "all",
    filters.artist.trim() !== "",
    filters.status !== "all",
    filters.listId !== "all",
  ].filter(Boolean).length;

  const updateFilters = (patch: Partial<CardFilters>) => {
    setFilters({ ...filters, ...patch });
    setVisibleCount(PAGE_SIZE);
    setSelectedKeys(new Set());
  };

  const toggleSelected = (cardKey: string) => {
    setSelectedKeys((current) => {
      const next = new Set(current);
      if (next.has(cardKey)) next.delete(cardKey);
      else next.add(cardKey);
      return next;
    });
  };

  const toggleSelectAll = () => {
    setSelectedKeys(
      allFilteredSelected
        ? new Set()
        : new Set(filteredCards.map((card) => card.key)),
    );
  };

  useEffect(() => {
    const controller = new AbortController();
    const batch = priceFetchCards;
    const batchKeys = batch.map((card) => card.key);
    setPricingLoading((current) => new Set([...current, ...batchKeys]));
    void loadMarketPrices(
      batch,
      (cardKey, price) => {
        setPrices((current) => ({ ...current, [cardKey]: price }));
        setPriceChecked((current) => new Set([...current, cardKey]));
        setPricingLoading((current) => {
          const next = new Set(current);
          next.delete(cardKey);
          return next;
        });
      },
      controller.signal,
      preferredVariantByCardKey,
    ).finally(() => {
      setPriceChecked((current) => new Set([...current, ...batchKeys]));
      setPricingLoading((current) => {
        const next = new Set(current);
        for (const key of batchKeys) next.delete(key);
        return next;
      });
    });
    return () => controller.abort();
  }, [visiblePriceSignature]);

  return (
    <div className="page-stack catalog-page">
      <section className="catalog-heading">
        <div>
          <span className="eyebrow">Multilingual database</span>
          <h1>Cards</h1>
          <p>
            {formatNumber(uniqueCardCount)} unique prints shown once.{" "}
            {filters.language === "all"
              ? "English is preferred, with another available language used as fallback."
              : `Showing the ${LANGUAGE_BY_CODE[filters.language].label} version where available.`}
          </p>
        </div>
        <button className="secondary-button" type="button" onClick={onSync} disabled={syncing}>
          <RefreshCw size={16} className={syncing ? "spin" : ""} />
          {syncing ? "Syncing…" : "Sync catalog"}
        </button>
      </section>

      <section className="filter-bar">
        <label className="catalog-search">
          <Search size={18} />
          <input
            type="search"
            value={filters.query}
            onChange={(event) => updateFilters({ query: event.target.value })}
            placeholder="Search by card name, number or ID…"
          />
          {filters.query && (
            <button type="button" onClick={() => updateFilters({ query: "" })} aria-label="Clear search">
              <X size={15} />
            </button>
          )}
        </label>
        <button
          type="button"
          className={`filter-button ${advancedOpen ? "is-open" : ""}`}
          onClick={() => setAdvancedOpen((open) => !open)}
        >
          <SlidersHorizontal size={17} />
          Filters
          {activeFilterCount > 0 && <span>{activeFilterCount}</span>}
          <ChevronDown size={15} />
        </button>
        <label className="sort-select">
          <Filter size={16} />
          <select
            value={filters.sort}
            onChange={(event) => updateFilters({ sort: event.target.value as CardSort })}
            aria-label="Sort cards"
          >
            <option value="release-new">Newest release</option>
            <option value="release-old">Oldest release</option>
            <option value="name-asc">Name A–Z</option>
            <option value="name-desc">Name Z–A</option>
            <option value="number-asc">Card number</option>
            <option value="set-asc">Set name</option>
            <option value="price-desc">Price: high to low</option>
            <option value="price-asc">Price: low to high</option>
          </select>
          <ChevronDown size={14} />
        </label>
      </section>

      <section className="collection-state-bar">
        <div className="filter-group status-filter">
          <span>Collection</span>
          <div className="segmented-wrap">
            <button
              type="button"
              className={filters.status === "all" ? "active" : ""}
              onClick={() => updateFilters({ status: "all" })}
            >
              All
            </button>
            <button
              type="button"
              className={filters.status === "collection" ? "active" : ""}
              onClick={() => updateFilters({ status: "collection" })}
            >
              <Check size={13} /> In collection
            </button>
            <button
              type="button"
              className={filters.status === "not-collection" ? "active" : ""}
              onClick={() => updateFilters({ status: "not-collection" })}
            >
              <X size={13} /> Not in collection
            </button>
          </div>
        </div>
        <label className="list-state-filter">
          <span>In list</span>
          <div className="select-wrap">
            <select
              value={filters.listId}
              onChange={(event) => updateFilters({ listId: event.target.value })}
            >
              <option value="all">No list filter</option>
              <option value="wishlist">Wishlist</option>
              {data.lists.map((list) => (
                <option key={list.id} value={list.id}>
                  {list.name}
                </option>
              ))}
            </select>
            <ChevronDown size={14} />
          </div>
        </label>
        {(filters.status !== "all" || filters.listId !== "all") && (
          <button
            type="button"
            className="clear-state-filter"
            onClick={() => updateFilters({ status: "all", listId: "all" })}
          >
            Clear
          </button>
        )}
      </section>

      {advancedOpen && (
        <section className="advanced-filters">
          <div className="filter-group">
            <span>Region</span>
            <div className="segmented-wrap">
              <button
                className={filters.region === "all" ? "active" : ""}
                type="button"
                onClick={() => updateFilters({ region: "all", setId: "all" })}
              >
                All
              </button>
              {REGIONS.map((region) => (
                <button
                  className={filters.region === region ? "active" : ""}
                  type="button"
                  key={region}
                  onClick={() => updateFilters({ region: region as Region, setId: "all" })}
                >
                  {region}
                </button>
              ))}
            </div>
          </div>
          <div className="filter-row">
            <label>
              <span>Language</span>
              <div className="select-wrap">
                <select
                  value={filters.language}
                  onChange={(event) =>
                    updateFilters({
                      language: event.target.value as "all" | LanguageCode,
                      setId: "all",
                    })
                  }
                >
                  <option value="all">All languages · English first</option>
                  {LANGUAGES.filter(
                    (language) => filters.region === "all" || language.region === filters.region,
                  ).map((language) => (
                    <option key={language.code} value={language.code}>
                      {language.flag} {language.label}
                    </option>
                  ))}
                </select>
                <ChevronDown size={14} />
              </div>
            </label>
            <label className="set-select-filter">
              <span>Set</span>
              <div className="select-wrap">
                <select
                  value={filters.setId}
                  onChange={(event) =>
                    updateFilters({
                      setId: event.target.value,
                      language:
                        event.target.value === "all"
                          ? filters.language
                          : (event.target.value.split(":")[0] as LanguageCode),
                    })
                  }
                >
                  <option value="all">All sets</option>
                  {setsForLanguage.map((set) => (
                    <option key={set.key} value={set.key}>
                      {set.languageLabel} · {set.name} ({set.total})
                    </option>
                  ))}
                </select>
                <ChevronDown size={14} />
              </div>
            </label>
            <label className="artist-filter">
              <span>Artist</span>
              <input
                type="search"
                value={filters.artist}
                onChange={(event) => updateFilters({ artist: event.target.value })}
                placeholder="Start typing an artist…"
                list="artist-options"
              />
              <datalist id="artist-options">
                {catalog.artists.map((artist) => (
                  <option value={artist} key={artist} />
                ))}
              </datalist>
            </label>
          </div>
          {activeFilterCount > 0 && (
            <button
              type="button"
              className="clear-filters"
              onClick={() =>
                updateFilters({
                  region: "all",
                  language: "all",
                  setId: "all",
                  artist: "",
                  status: "all",
                  listId: "all",
                })
              }
            >
              <X size={13} /> Clear filters
            </button>
          )}
        </section>
      )}

      <div className="catalog-toolbar">
        <div>
          <strong>{formatNumber(filteredCards.length)}</strong>{" "}
          {filteredCards.length === 1 ? "card" : "cards"}
          {filters.setId !== "all" && (
            <span className="active-set-label">
              {catalog.sets.find((set) => set.key === filters.setId)?.name}
            </span>
          )}
          {filters.artist.trim() && (
            <span className="active-set-label">
              Artist: {filters.artist.trim()}
            </span>
          )}
          {filters.listId !== "all" && (
            <span className="active-set-label">
              List:{" "}
              {filters.listId === "wishlist"
                ? "Wishlist"
                : data.lists.find((list) => list.id === filters.listId)?.name ??
                  "Unknown list"}
            </span>
          )}
          {priceSortActive && (
            <span className="active-set-label">
              {priceSortLoading
                ? "Loading prices to sort…"
                : priceSortTruncated
                  ? `Price sorted for the first ${formatNumber(PRICE_SORT_LIMIT)} filtered cards`
                  : "Sorted by market estimate · unavailable prices last"}
            </span>
          )}
        </div>
        <div className="catalog-toolbar-actions">
          <button
            type="button"
            className={`selection-trigger ${selectionMode ? "active" : ""}`}
            onClick={() => {
              setSelectionMode((active) => !active);
              setSelectedKeys(new Set());
            }}
          >
            <MousePointer2 size={15} />
            {selectionMode ? "Exit selection" : "Select cards"}
          </button>
          <div className="view-switcher">
          <button
            type="button"
            className={view === "grid" ? "active" : ""}
            onClick={() => setView("grid")}
          >
            <Grid2X2 size={16} /> Images
          </button>
          <button
            type="button"
            className={view === "list" ? "active" : ""}
            onClick={() => setView("list")}
          >
            <LayoutList size={16} /> List
          </button>
          </div>
        </div>
      </div>

      {selectionMode && (
        <section className="bulk-toolbar" aria-label="Bulk card actions">
          <div className="bulk-selection-summary">
            <button
              type="button"
              className={`bulk-check ${allFilteredSelected ? "active" : ""}`}
              onClick={toggleSelectAll}
              aria-pressed={allFilteredSelected}
              aria-label={
                allFilteredSelected
                  ? "Clear all selected cards"
                  : "Select all filtered cards"
              }
            >
              {allFilteredSelected && <Check size={14} />}
            </button>
            <div>
              <button type="button" onClick={toggleSelectAll}>
                {allFilteredSelected ? "Clear all" : "Select all"}
              </button>
              <span>
                {formatNumber(selectedCards.length)} selected ·{" "}
                {formatNumber(filteredCards.length)} filtered
              </span>
            </div>
          </div>
          <div className="bulk-actions">
            <button
              type="button"
              onClick={() => onBulkWishlist(selectedCards, true)}
              disabled={selectedCards.length === 0}
            >
              <Heart size={16} /> Add to wishlist
            </button>
            <button
              type="button"
              onClick={() => onBulkWishlist(selectedCards, false)}
              disabled={selectedCards.length === 0}
            >
              <HeartOff size={16} /> Remove wishlist
            </button>
            <button
              type="button"
              onClick={() => onBulkCollection(selectedCards)}
              disabled={selectedCards.length === 0}
            >
              <CirclePlus size={16} /> Add to collection
            </button>
            <button
              type="button"
              onClick={() => onBulkList(selectedCards)}
              disabled={selectedCards.length === 0}
            >
              <ListPlus size={16} /> Add to list
            </button>
            <button
              type="button"
              className="bulk-close"
              onClick={() => {
                setSelectionMode(false);
                setSelectedKeys(new Set());
              }}
              aria-label="Exit selection mode"
            >
              <X size={17} />
            </button>
          </div>
        </section>
      )}

      {visibleCards.length === 0 ? (
        <section className="surface">
          <EmptyState
            icon={<Search size={28} />}
            title="No cards match these filters"
            action={
              <button
                type="button"
                className="secondary-button"
                onClick={() =>
                  setFilters({
                    ...filters,
                    query: "",
                    region: "all",
                    language: "all",
                    setId: "all",
                    artist: "",
                    status: "all",
                    listId: "all",
                  })
                }
              >
                Reset search
              </button>
            }
          >
            Try a shorter card name, choose another set, or clear your collection filters.
          </EmptyState>
        </section>
      ) : (
        <>
          <div className={view === "grid" ? "card-grid" : "card-list"}>
            {visibleCards.map((card) => (
              <CardTile
                key={card.key}
                card={card}
                quantity={quantityByGroup.get(card.groupKey) ?? 0}
                wishlisted={wishlistGroups.has(card.groupKey)}
                listCount={listCountByGroup.get(card.groupKey) ?? 0}
                prices={prices[card.key]}
                priceLoading={pricingLoading.has(card.key)}
                view={view}
                selectionMode={selectionMode}
                selected={selectedKeys.has(card.key)}
                onToggleSelection={() => toggleSelected(card.key)}
                onOpen={() => onOpenCard(card)}
                onAdd={() => onAdd(card)}
                onRemove={() => onRemove(card)}
                onToggleWishlist={() => onWishlist(card)}
                onManageLists={() => onManageLists(card)}
              />
            ))}
          </div>
          {visibleCount < sortedCards.length && (
            <div className="load-more-row">
              <button
                className="secondary-button large"
                type="button"
                onClick={() => setVisibleCount((count) => count + PAGE_SIZE)}
              >
                Load more cards
                <span>
                  {formatNumber(Math.min(PAGE_SIZE, sortedCards.length - visibleCount))} remaining
                </span>
              </button>
            </div>
          )}
        </>
      )}

      {catalog.failedLanguages.length > 0 && (
        <p className="catalog-warning">
          Some regions could not sync:{" "}
          {catalog.failedLanguages.map((item) => LANGUAGE_BY_CODE[item.language].label).join(", ")}.
          Your cached results remain available.
        </p>
      )}
    </div>
  );
}
