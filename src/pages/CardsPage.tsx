import { useMemo, useState } from "react";
import {
  Check,
  ChevronDown,
  Filter,
  Grid2X2,
  Heart,
  LayoutList,
  RefreshCw,
  Search,
  SlidersHorizontal,
  X,
} from "lucide-react";
import { LANGUAGE_BY_CODE, LANGUAGES, REGIONS } from "../lib/constants";
import {
  filterCards,
  formatNumber,
  quantityForCard,
} from "../lib/collection";
import type {
  AppData,
  CardFilters,
  CardSort,
  CardView,
  Catalog,
  CatalogCard,
  LanguageCode,
  Region,
} from "../types";
import { CardTile } from "../components/CardTile";
import { EmptyState } from "../components/Shared";

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
  onSync: () => void;
  syncing: boolean;
}

const PAGE_SIZE = 72;

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
  onSync,
  syncing,
}: CardsPageProps) {
  const [visibleCount, setVisibleCount] = useState(PAGE_SIZE);
  const [advancedOpen, setAdvancedOpen] = useState(false);
  const filteredCards = useMemo(
    () => filterCards(catalog.cards, filters, data),
    [catalog.cards, data, filters],
  );
  const setsForLanguage = useMemo(
    () =>
      catalog.sets
        .filter((set) => filters.language === "all" || set.language === filters.language)
        .filter((set) => filters.region === "all" || set.region === filters.region)
        .sort((a, b) => (b.releaseDate ?? "").localeCompare(a.releaseDate ?? "")),
    [catalog.sets, filters.language, filters.region],
  );
  const visibleCards = filteredCards.slice(0, visibleCount);
  const activeFilterCount = [
    filters.region !== "all",
    filters.language !== "all",
    filters.setId !== "all",
    filters.status !== "all",
  ].filter(Boolean).length;

  const updateFilters = (patch: Partial<CardFilters>) => {
    setFilters({ ...filters, ...patch });
    setVisibleCount(PAGE_SIZE);
  };

  return (
    <div className="page-stack catalog-page">
      <section className="catalog-heading">
        <div>
          <span className="eyebrow">Multilingual database</span>
          <h1>Cards</h1>
          <p>
            {formatNumber(catalog.cards.length)} regional card records with images and live card details.
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
          </select>
          <ChevronDown size={14} />
        </label>
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
                  <option value="all">All languages</option>
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
            <div className="filter-group status-filter">
              <span>Show</span>
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
                  <Check size={13} /> Collection
                </button>
                <button
                  type="button"
                  className={filters.status === "wishlist" ? "active" : ""}
                  onClick={() => updateFilters({ status: "wishlist" })}
                >
                  <Heart size={13} /> Wishlist
                </button>
              </div>
            </div>
          </div>
          {activeFilterCount > 0 && (
            <button
              type="button"
              className="clear-filters"
              onClick={() =>
                updateFilters({ region: "all", language: "all", setId: "all", status: "all" })
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
        </div>
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
                    status: "all",
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
                quantity={quantityForCard(data.collection, card.key)}
                wishlisted={data.wishlist.includes(card.key)}
                listCount={data.lists.filter((list) => list.cardKeys.includes(card.key)).length}
                view={view}
                onOpen={() => onOpenCard(card)}
                onAdd={() => onAdd(card)}
                onRemove={() => onRemove(card)}
                onToggleWishlist={() => onWishlist(card)}
                onManageLists={() => onManageLists(card)}
              />
            ))}
          </div>
          {visibleCount < filteredCards.length && (
            <div className="load-more-row">
              <button
                className="secondary-button large"
                type="button"
                onClick={() => setVisibleCount((count) => count + PAGE_SIZE)}
              >
                Load more cards
                <span>
                  {formatNumber(Math.min(PAGE_SIZE, filteredCards.length - visibleCount))} remaining
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
