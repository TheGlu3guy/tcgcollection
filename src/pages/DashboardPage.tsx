import { useMemo } from "react";
import {
  ArrowRight,
  Bookmark,
  ChevronRight,
  Heart,
  Layers3,
  Library,
  ListChecks,
  Sparkles,
  TrendingUp,
} from "lucide-react";
import { LANGUAGE_BY_CODE } from "../lib/constants";
import {
  formatCurrency,
  formatNumber,
  getCollectionStats,
  getSetProgress,
} from "../lib/collection";
import type { AppData, Catalog, PageName } from "../types";
import { CardImage, ProgressBar } from "../components/Shared";
import { imageUrl } from "../lib/catalog";
import { getVisibleCards, getVisibleSets } from "../lib/cardGroups";

interface DashboardPageProps {
  catalog: Catalog;
  data: AppData;
  onNavigate: (page: PageName) => void;
  onBrowseSets: () => void;
  onOpenSet: (setKey: string) => void;
  onRandomCard: () => void;
}

function greeting(): string {
  const hour = new Date().getHours();
  if (hour < 12) return "Good morning";
  if (hour < 18) return "Good afternoon";
  return "Good evening";
}

export function DashboardPage({
  catalog,
  data,
  onNavigate,
  onBrowseSets,
  onOpenSet,
  onRandomCard,
}: DashboardPageProps) {
  const stats = getCollectionStats(data, catalog.cards);
  const setProgress = getSetProgress(data, catalog.sets);
  const visibleCards = useMemo(
    () => getVisibleCards(catalog.cards, data.preferences.catalogLanguage),
    [catalog.cards, data.preferences.catalogLanguage],
  );
  const visibleSets = useMemo(
    () => getVisibleSets(catalog.sets, data.preferences.catalogLanguage),
    [catalog.sets, data.preferences.catalogLanguage],
  );
  const uniquePrintCount = useMemo(
    () => getVisibleCards(catalog.cards, "all").length,
    [catalog.cards],
  );
  const uniqueSetCount = useMemo(
    () => getVisibleSets(catalog.sets, "all").length,
    [catalog.sets],
  );
  const recentSets = visibleSets
    .filter((set) => set.releaseDate)
    .slice(0, 6);
  const activeSets = [...visibleSets]
    .filter((set) => setProgress.get(set.key))
    .sort((a, b) => (setProgress.get(b.key) ?? 0) - (setProgress.get(a.key) ?? 0))
    .slice(0, 4);
  const wishlistGroups = new Set(
    data.wishlist.map(
      (key) => catalog.cards.find((card) => card.key === key)?.groupKey ?? key,
    ),
  );
  const wishlistCards = visibleCards
    .filter((card) => wishlistGroups.has(card.groupKey))
    .slice(0, 5);
  const heroCard =
    visibleCards.find((card) => card.image && card.language === "en") ??
    visibleCards.find((card) => card.image);
  const languageEntries = Object.entries(stats.languageCounts).sort((a, b) => b[1] - a[1]);

  return (
    <div className="page-stack dashboard-page">
      <section className="dashboard-hero">
        <div className="dashboard-hero-copy">
          <span className="hero-kicker">
            <Sparkles size={15} />
            Your collection desk
          </span>
          <h1>{greeting()}, collector.</h1>
          <p>
            Search more than {formatNumber(uniquePrintCount)}{" "}
            unique prints across {formatNumber(uniqueSetCount)} sets
            worldwide. Each card is shown once with its available languages.
          </p>
          <div className="hero-actions">
            <button className="primary-button" type="button" onClick={() => onNavigate("cards")}>
              Browse the catalog <ArrowRight size={17} />
            </button>
            <button className="ghost-button on-dark" type="button" onClick={onRandomCard}>
              Discover a random card
            </button>
          </div>
        </div>
        <div className="hero-art" aria-hidden="true">
          <div className="hero-orbit orbit-one" />
          <div className="hero-orbit orbit-two" />
          <div className="hero-pokeball">
            <span />
          </div>
          {heroCard && (
            <div className="hero-card-stack">
              <div className="stack-card stack-back" />
              <div className="stack-card stack-mid" />
              <div className="stack-card stack-front">
                <CardImage src={imageUrl(heroCard.image)} alt="" />
              </div>
            </div>
          )}
        </div>
      </section>

      <section className="metric-grid">
        <article className="metric-card accent-card">
          <div className="metric-icon"><Library size={20} /></div>
          <div>
            <span>Unique cards</span>
            <strong>{formatNumber(stats.uniqueCards)}</strong>
            <small>
              {formatNumber(stats.totalCopies)} total {stats.totalCopies === 1 ? "copy" : "copies"}
            </small>
          </div>
        </article>
        <article className="metric-card">
          <div className="metric-icon blue"><Layers3 size={20} /></div>
          <div>
            <span>Sets started</span>
            <strong>{formatNumber(stats.uniqueSets)}</strong>
            <small>
              across {languageEntries.length || 0}{" "}
              {languageEntries.length === 1 ? "language" : "languages"}
            </small>
          </div>
        </article>
        <article className="metric-card">
          <div className="metric-icon coral"><Heart size={20} /></div>
          <div>
            <span>Wishlist</span>
            <strong>{formatNumber(stats.wishlist)}</strong>
            <small>{stats.wishlist === 1 ? "card" : "cards"} to chase</small>
          </div>
        </article>
        <article className="metric-card">
          <div className="metric-icon green"><TrendingUp size={20} /></div>
          <div>
            <span>Tracked value</span>
            <strong>
              {formatCurrency(
                stats.estimatedValue,
                data.preferences.collectionValueCurrency || "EUR",
              )}
            </strong>
            <small>last known market estimate</small>
          </div>
        </article>
      </section>

      <div className="dashboard-columns">
        <section className="surface collection-snapshot">
          <div className="section-heading">
            <div>
              <span className="eyebrow">Collection pulse</span>
              <h2>Where you stand</h2>
            </div>
            <button className="text-button" type="button" onClick={() => onNavigate("lists")}>
              Open collection <ChevronRight size={15} />
            </button>
          </div>

          {stats.uniqueCards === 0 ? (
            <div className="first-run-card">
              <div className="first-run-pokeball" aria-hidden="true">
                <span />
              </div>
              <div>
                <h3>Your next great find starts here.</h3>
                <p>
                  Browse the full multilingual catalog, then add a card once to start
                  your set and Pokédex progress.
                </p>
                <button className="primary-button small" type="button" onClick={() => onNavigate("cards")}>
                  Find your first card
                </button>
              </div>
            </div>
          ) : (
            <>
              <div className="global-progress">
                <div>
                  <span>Catalog coverage</span>
                  <strong>{stats.collectionPercent.toFixed(2)}%</strong>
                </div>
                <ProgressBar value={stats.collectionPercent} />
              </div>
              <div className="language-bars">
                {languageEntries.map(([code, count]) => {
                  const language = LANGUAGE_BY_CODE[code as keyof typeof LANGUAGE_BY_CODE];
                  const max = Math.max(...languageEntries.map(([, value]) => value), 1);
                  return (
                    <div className="language-bar-row" key={code}>
                      <span>
                        {language?.flag} {language?.label ?? code}
                      </span>
                      <ProgressBar value={(count / max) * 100} color="#5878c8" />
                      <strong>{count}</strong>
                    </div>
                  );
                })}
              </div>
            </>
          )}
        </section>

        <section className="surface active-sets-card">
          <div className="section-heading">
            <div>
              <span className="eyebrow">Keep going</span>
              <h2>Sets in progress</h2>
            </div>
            <button className="text-button" type="button" onClick={onBrowseSets}>
              All sets <ChevronRight size={15} />
            </button>
          </div>
          {activeSets.length === 0 ? (
            <div className="small-empty">
              <Layers3 size={25} />
              <p>Set progress appears after you add your first card.</p>
            </div>
          ) : (
            <div className="active-set-list">
              {activeSets.map((set) => (
                <button className="active-set-row" type="button" key={set.key} onClick={() => onOpenSet(set.key)}>
                  <div className="set-symbol">
                    {set.symbol ? <img src={set.symbol} alt="" /> : <Layers3 size={18} />}
                  </div>
                  <div>
                    <strong>{set.name}</strong>
                    <span>{set.languageLabel} · {set.total} cards</span>
                  </div>
                  <ProgressBar value={setProgress.get(set.key) ?? 0} />
                  <span>{(setProgress.get(set.key) ?? 0).toFixed(0)}%</span>
                </button>
              ))}
            </div>
          )}
        </section>
      </div>

      <section className="surface">
        <div className="section-heading">
          <div>
            <span className="eyebrow">Fresh releases</span>
            <h2>Recently added sets</h2>
          </div>
          <button className="text-button" type="button" onClick={onBrowseSets}>
            Explore sets <ChevronRight size={15} />
          </button>
        </div>
        <div className="recent-set-grid">
          {recentSets.map((set) => (
            <button className="recent-set-tile" type="button" key={set.key} onClick={() => onOpenSet(set.key)}>
              <div className="recent-set-logo">
                {set.logo ? <img src={set.logo} alt="" loading="lazy" /> : <span>{set.abbreviation ?? "TCG"}</span>}
              </div>
              <strong>{set.name}</strong>
              <span>{set.releaseDate ? new Date(set.releaseDate).toLocaleDateString(undefined, { year: "numeric", month: "short" }) : "Date unknown"} · {set.total} cards</span>
            </button>
          ))}
        </div>
      </section>

      <section className="surface wishlist-strip">
        <div className="section-heading">
          <div>
            <span className="eyebrow">Next on the hunt</span>
            <h2>Wishlist</h2>
          </div>
          <button className="text-button" type="button" onClick={() => onNavigate("lists")}>
            View wishlist <ChevronRight size={15} />
          </button>
        </div>
        {wishlistCards.length === 0 ? (
          <div className="small-empty horizontal">
            <ListChecks size={24} />
            <p>Tap the heart on any card to build your personal wishlist.</p>
          </div>
        ) : (
          <div className="mini-card-row">
            {wishlistCards.map((card) => (
              <button
                className="mini-card"
                key={card.key}
                type="button"
                onClick={() => onNavigate("lists")}
              >
                <CardImage src={imageUrl(card.image)} alt={card.name} />
                <strong>{card.name}</strong>
                <span>{card.setName}</span>
              </button>
            ))}
            <button className="mini-card-placeholder" type="button" onClick={() => onNavigate("cards")}>
              <Bookmark size={22} />
              <span>Find another card</span>
            </button>
          </div>
        )}
      </section>
    </div>
  );
}
