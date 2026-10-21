import { useMemo, useState } from "react";
import { CalendarDays, ChevronDown, Layers3, Search } from "lucide-react";
import { LANGUAGE_BY_CODE, LANGUAGES, REGIONS } from "../lib/constants";
import { formatNumber, getSetProgress } from "../lib/collection";
import type { AppData, Catalog, CatalogSet, LanguageCode, Region } from "../types";
import { EmptyState, ProgressBar } from "../components/Shared";
import { getVisibleSets } from "../lib/cardGroups";

interface SetsPageProps {
  catalog: Catalog;
  data: AppData;
  onOpenSet: (set: CatalogSet) => void;
  onLanguageChange: (language: "all" | LanguageCode) => void;
}

const SET_PAGE_SIZE = 80;

export function SetsPage({ catalog, data, onOpenSet, onLanguageChange }: SetsPageProps) {
  const [query, setQuery] = useState("");
  const [region, setRegion] = useState<"all" | Region>("all");
  const [language, setLanguage] = useState<"all" | LanguageCode>(
    data.preferences.catalogLanguage,
  );
  const [visibleCount, setVisibleCount] = useState(SET_PAGE_SIZE);
  const progress = getSetProgress(data, catalog.sets);
  const uniqueSetCount = useMemo(
    () => getVisibleSets(catalog.sets, "all").length,
    [catalog.sets],
  );
  const sets = useMemo(() => {
    const normalizedQuery = query.trim().toLocaleLowerCase();
    return getVisibleSets(catalog.sets, language)
      .filter((set) => region === "all" || set.region === region)
      .filter(
        (set) =>
          !normalizedQuery ||
          set.name.toLocaleLowerCase().includes(normalizedQuery) ||
          set.series.toLocaleLowerCase().includes(normalizedQuery),
      )
      .sort((a, b) => {
        const releaseA = a.releaseDate ?? "";
        const releaseB = b.releaseDate ?? "";
        if (!releaseA && !releaseB) return a.name.localeCompare(b.name);
        if (!releaseA) return 1;
        if (!releaseB) return -1;
        return releaseB.localeCompare(releaseA);
      });
  }, [catalog.sets, language, query, region]);

  return (
    <div className="page-stack sets-page">
      <section className="catalog-heading">
        <div>
          <span className="eyebrow">Browse by release</span>
          <h1>Sets</h1>
          <p>
            Track completion from Base Set to the newest regional releases across{" "}
            {formatNumber(uniqueSetCount)} unique sets shown once.
          </p>
        </div>
      </section>

      <section className="sets-filter-row">
        <label className="catalog-search">
          <Search size={18} />
          <input
            type="search"
            value={query}
            onChange={(event) => {
              setQuery(event.target.value);
              setVisibleCount(SET_PAGE_SIZE);
            }}
            placeholder="Search sets or series…"
          />
        </label>
        <div className="segmented-wrap set-region-tabs">
          <button
            type="button"
            className={region === "all" ? "active" : ""}
            onClick={() => {
              setRegion("all");
              setLanguage("all");
              onLanguageChange("all");
            }}
          >
            All regions
          </button>
          {REGIONS.map((item) => (
            <button
              type="button"
              key={item}
              className={region === item ? "active" : ""}
              onClick={() => {
                setRegion(item);
                const firstLanguage = LANGUAGES.find((entry) => entry.region === item)?.code;
                setLanguage(firstLanguage ?? "all");
                onLanguageChange(firstLanguage ?? "all");
              }}
            >
              {item}
            </button>
          ))}
        </div>
        <label className="sort-select">
          <select
            value={language}
            onChange={(event) => {
              const nextLanguage = event.target.value as "all" | LanguageCode;
              setLanguage(nextLanguage);
              onLanguageChange(nextLanguage);
            }}
            aria-label="Set language"
          >
            <option value="all">All languages · English first</option>
            {LANGUAGES.filter((item) => region === "all" || item.region === region).map((item) => (
              <option value={item.code} key={item.code}>
                {item.flag} {item.label}
              </option>
            ))}
          </select>
          <ChevronDown size={14} />
        </label>
      </section>

      <div className="catalog-toolbar">
        <div><strong>{formatNumber(sets.length)}</strong> sets</div>
        <span className="muted-small">Progress is counted by unique catalog card</span>
      </div>

      {sets.length === 0 ? (
        <section className="surface">
          <EmptyState icon={<Layers3 size={28} />} title="No sets found">
            Try a broader region or a shorter search.
          </EmptyState>
        </section>
      ) : (
        <>
          <div className="set-grid">
            {sets.slice(0, visibleCount).map((set) => {
              const percent = progress.get(set.key) ?? 0;
              return (
                <button className="set-card" type="button" key={set.key} onClick={() => onOpenSet(set)}>
                  <div className="set-art">
                    {set.logo ? (
                      <img src={set.logo} alt={`${set.name} logo`} loading="lazy" />
                    ) : set.symbol ? (
                      <img src={set.symbol} alt="" loading="lazy" />
                    ) : (
                      <Layers3 size={34} />
                    )}
                  </div>
                  <div className="set-card-body">
                    <span className="set-series">{set.series}</span>
                    <h2>{set.name}</h2>
                    <div className="set-card-meta">
                      <span>{LANGUAGE_BY_CODE[set.language].flag} {set.languageLabel}</span>
                      <span>{set.total} cards</span>
                    </div>
                    <div className="set-date">
                      <CalendarDays size={13} />
                      {set.releaseDate
                        ? new Date(set.releaseDate).toLocaleDateString(undefined, {
                            year: "numeric",
                            month: "short",
                            day: "numeric",
                          })
                        : "Release date unavailable"}
                    </div>
                    <div className="set-progress-row">
                      <ProgressBar value={percent} />
                      <span>{percent ? `${percent.toFixed(0)}%` : "Not started"}</span>
                    </div>
                  </div>
                </button>
              );
            })}
          </div>
          {visibleCount < sets.length && (
            <div className="load-more-row">
              <button
                className="secondary-button large"
                type="button"
                onClick={() => setVisibleCount((count) => count + SET_PAGE_SIZE)}
              >
                Load more sets
              </button>
            </div>
          )}
        </>
      )}
    </div>
  );
}
