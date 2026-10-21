import { useCallback, useEffect, useMemo, useState } from "react";
import {
  CheckCircle2,
  ChevronDown,
  Cloud,
  CloudOff,
  Grid3X3,
  Heart,
  Layers3,
  Library,
  LoaderCircle,
  Menu,
  RefreshCw,
  Search,
  Settings,
  ShieldCheck,
  Sparkles,
  X,
} from "lucide-react";
import { CardDetailModal } from "./components/CardDetailModal";
import {
  ListEditorDialog,
  ListPickerDialog,
  SettingsDialog,
} from "./components/Dialogs";
import { DashboardPage } from "./pages/DashboardPage";
import { CardsPage } from "./pages/CardsPage";
import { SetsPage } from "./pages/SetsPage";
import { ListsPage } from "./pages/ListsPage";
import { PokedexPage } from "./pages/PokedexPage";
import {
  APP_STORAGE_KEY,
  CATALOG_VERSION,
  DEFAULT_APP_DATA,
  DEFAULT_FILTERS,
  LIST_COLORS,
  LANGUAGES,
} from "./lib/constants";
import { imageUrl, loadCardDetail, loadCatalog } from "./lib/catalog";
import {
  addCardCopy,
  decrementCardCopy,
  formatNumber,
  normalizeAppData,
  quantityForCard,
  toggleListCard,
  toggleWishlist,
  updateCardCopy,
} from "./lib/collection";
import type {
  AppData,
  CardFilters,
  CardList,
  CardView,
  Catalog,
  CatalogCard,
  CatalogSet,
  PageName,
} from "./types";

const PAGE_NAMES: PageName[] = ["dashboard", "cards", "sets", "lists", "pokedex"];

function getStoredData(): AppData {
  try {
    const raw = localStorage.getItem(APP_STORAGE_KEY);
    return raw ? normalizeAppData(JSON.parse(raw)) : structuredClone(DEFAULT_APP_DATA);
  } catch {
    return structuredClone(DEFAULT_APP_DATA);
  }
}

function initialPage(): PageName {
  const route = window.location.hash.replace(/^#\/?/, "").split("/")[0] as PageName;
  return PAGE_NAMES.includes(route) ? route : "dashboard";
}

interface Toast {
  id: number;
  message: string;
  kind: "success" | "error";
}

function formatSyncLanguage(code: string): string {
  return LANGUAGES.find((language) => language.code === code)?.shortLabel ?? code.toUpperCase();
}

export default function App() {
  const [data, setData] = useState<AppData>(getStoredData);
  const [catalog, setCatalog] = useState<Catalog | null>(null);
  const [loadingCatalog, setLoadingCatalog] = useState(true);
  const [syncing, setSyncing] = useState(false);
  const [catalogError, setCatalogError] = useState("");
  const [syncProgress, setSyncProgress] = useState(0);
  const [syncLanguage, setSyncLanguage] = useState("");
  const [page, setPage] = useState<PageName>(initialPage);
  const [filters, setFilters] = useState<CardFilters>(DEFAULT_FILTERS);
  const [view, setView] = useState<CardView>("grid");
  const [activeCard, setActiveCard] = useState<CatalogCard | null>(null);
  const [pickerCard, setPickerCard] = useState<CatalogCard | null>(null);
  const [listEditor, setListEditor] = useState<{
    list?: CardList;
    pendingCard?: CatalogCard;
  } | null>(null);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [mobileNavOpen, setMobileNavOpen] = useState(false);
  const [globalSearch, setGlobalSearch] = useState("");
  const [toasts, setToasts] = useState<Toast[]>([]);

  const pushToast = useCallback((message: string, kind: Toast["kind"] = "success") => {
    const id = Date.now() + Math.random();
    setToasts((items) => [...items, { id, message, kind }]);
    window.setTimeout(() => {
      setToasts((items) => items.filter((toast) => toast.id !== id));
    }, 3200);
  }, []);

  const fetchCatalog = useCallback(async (force = false) => {
    force ? setSyncing(true) : setLoadingCatalog(true);
    setCatalogError("");
    setSyncProgress(0);
    try {
      const loaded = await loadCatalog({
        force,
        onProgress: (completed, total, language) => {
          setSyncProgress((completed / total) * 100);
          setSyncLanguage(language);
        },
      });
      setCatalog(loaded);
      if (force) {
        pushToast(
          `Catalog synced: ${formatNumber(loaded.cards.length)} cards across ${loaded.sets.length} sets.`,
        );
      }
    } catch (reason) {
      const message = reason instanceof Error ? reason.message : "The card catalog could not be loaded.";
      setCatalogError(message);
      if (force) pushToast(message, "error");
    } finally {
      setLoadingCatalog(false);
      setSyncing(false);
      setSyncProgress(100);
    }
  }, [pushToast]);

  useEffect(() => {
    void fetchCatalog(false);
  }, [fetchCatalog]);

  useEffect(() => {
    try {
      localStorage.setItem(APP_STORAGE_KEY, JSON.stringify(data));
    } catch {
      pushToast("This browser could not save collection changes. Export a backup.", "error");
    }
  }, [data, pushToast]);

  useEffect(() => {
    const handleHashChange = () => setPage(initialPage());
    window.addEventListener("hashchange", handleHashChange);
    return () => window.removeEventListener("hashchange", handleHashChange);
  }, []);

  const navigate = useCallback((nextPage: PageName) => {
    setPage(nextPage);
    setMobileNavOpen(false);
    const nextHash = `#/${nextPage}`;
    if (window.location.hash !== nextHash) {
      window.history.pushState(null, "", nextHash);
    }
    window.scrollTo({ top: 0, behavior: "smooth" });
  }, []);

  const ensureDetailMetadata = useCallback(
    async (card: CatalogCard) => {
      try {
        const detail = await loadCardDetail(card.language, card.id);
        setData((current) => {
          const targetCopies = current.collection.filter((copy) => copy.cardKey === card.key);
          if (targetCopies.length === 0) return current;
          let next = current;
          for (const copy of targetCopies) {
            const price = detail.pricing?.cardmarket?.trend ?? detail.pricing?.cardmarket?.avg;
            next = updateCardCopy(next, copy.id, {
              types: detail.types,
              dexIds: detail.dexId,
              rarity: detail.rarity,
              marketPrice: price ?? copy.marketPrice,
              currency: price ? (detail.pricing?.cardmarket?.unit ?? "EUR") : copy.currency,
            });
          }
          return next;
        });
      } catch {
        // Quick-add should still succeed when the live detail endpoint is unavailable.
      }
    },
    [],
  );

  const addCard = useCallback(
    (card: CatalogCard) => {
      setData((current) => addCardCopy(current, card));
      void ensureDetailMetadata(card);
      pushToast(`${card.name} added to your collection.`);
    },
    [ensureDetailMetadata, pushToast],
  );

  const removeCard = useCallback((card: CatalogCard) => {
    setData((current) => decrementCardCopy(current, card.key));
  }, []);

  const wishlistCard = useCallback(
    (card: CatalogCard) => {
      const adding = !data.wishlist.includes(card.key);
      setData((current) => toggleWishlist(current, card.key));
      pushToast(adding ? `${card.name} added to your wishlist.` : `${card.name} removed from your wishlist.`);
    },
    [data.wishlist, pushToast],
  );

  const openSet = useCallback(
    (set: CatalogSet) => {
      setFilters({
        ...DEFAULT_FILTERS,
        language: set.language,
        setId: set.key,
        sort: "number-asc",
      });
      navigate("cards");
    },
    [navigate],
  );

  const randomCard = useCallback(() => {
    if (!catalog?.cards.length) return;
    const withImages = catalog.cards.filter((card) => card.image);
    const pool = withImages.length ? withImages : catalog.cards;
    setActiveCard(pool[Math.floor(Math.random() * pool.length)]);
  }, [catalog]);

  const createOrUpdateList = (
    values: Pick<CardList, "name" | "description" | "color">,
  ) => {
    const existing = listEditor?.list;
    const now = new Date().toISOString();
    if (existing) {
      setData((current) => ({
        ...current,
        lists: current.lists.map((list) =>
          list.id === existing.id ? { ...list, ...values, updatedAt: now } : list,
        ),
      }));
      pushToast("List updated.");
    } else {
      const id = crypto.randomUUID();
      const pendingKey = listEditor?.pendingCard?.key;
      setData((current) => ({
        ...current,
        lists: [
          ...current.lists,
          {
            id,
            ...values,
            cardKeys: pendingKey ? [pendingKey] : [],
            createdAt: now,
            updatedAt: now,
          },
        ],
      }));
      pushToast(pendingKey ? "List created and card added." : "List created.");
    }
    setListEditor(null);
  };

  const deleteList = (list: CardList) => {
    if (!window.confirm(`Delete "${list.name}"? Cards in the list remain in your collection.`)) return;
    setData((current) => ({
      ...current,
      lists: current.lists.filter((item) => item.id !== list.id),
    }));
    pushToast("List deleted.");
  };

  const exportBackup = () => {
    const payload = {
      app: "tcgcollection",
      schemaVersion: 1,
      exportedAt: new Date().toISOString(),
      data,
    };
    const blob = new Blob([JSON.stringify(payload, null, 2)], {
      type: "application/json",
    });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = `tcgcollection-backup-${new Date().toISOString().slice(0, 10)}.json`;
    link.click();
    URL.revokeObjectURL(url);
    pushToast("Backup exported.");
  };

  const importBackup = async (file: File) => {
    const parsed = JSON.parse(await file.text()) as { app?: string; data?: Partial<AppData> };
    if (parsed.app && parsed.app !== "tcgcollection") {
      throw new Error("This is not a TCG Collection backup.");
    }
    const imported = normalizeAppData(parsed.data ?? (parsed as Partial<AppData>));
    setData(imported);
    setSettingsOpen(false);
    pushToast(
      `Import complete: ${formatNumber(imported.collection.length)} collection entries restored.`,
    );
  };

  const activeCardDetail = activeCard ? (
    <CardDetailModal
      card={activeCard}
      data={data}
      onClose={() => setActiveCard(null)}
      onAdd={(options) => {
        setData((current) => addCardCopy(current, activeCard, options));
        pushToast(`${activeCard.name} added.`);
      }}
      onRemoveOne={() => removeCard(activeCard)}
      onWishlist={() => wishlistCard(activeCard)}
      onDataChange={setData}
      onChangeList={(listId) => {
        setData((current) => toggleListCard(current, listId, activeCard.key));
      }}
      onCreateList={() => setListEditor({ pendingCard: activeCard })}
    />
  ) : null;

  return (
    <div className="app-shell">
      <header className="site-header">
        <div className="header-inner">
          <button className="brand" type="button" onClick={() => navigate("dashboard")}>
            <span className="brand-mark" aria-hidden="true">
              <span />
            </span>
            <span className="brand-text">TCG<span>Collection</span></span>
          </button>
          <nav className="desktop-nav" aria-label="Main navigation">
            {[
              ["dashboard", "Dashboard"],
              ["cards", "Cards"],
              ["sets", "Sets"],
              ["lists", "Lists"],
              ["pokedex", "Pokédex"],
            ].map(([pageName, label]) => (
              <button
                type="button"
                key={pageName}
                className={page === pageName ? "active" : ""}
                onClick={() => navigate(pageName as PageName)}
              >
                {label}
              </button>
            ))}
          </nav>
          <form
            className="global-search"
            onSubmit={(event) => {
              event.preventDefault();
              setFilters({ ...filters, query: globalSearch });
              navigate("cards");
            }}
          >
            <Search size={16} />
            <input
              value={globalSearch}
              onChange={(event) => setGlobalSearch(event.target.value)}
              placeholder="Quick find…"
              aria-label="Quick search cards"
            />
          </form>
          <div className="header-actions">
            <div className={`sync-status ${syncing ? "syncing" : ""}`} title="Catalog sync status">
              {syncing ? (
                <RefreshCw size={16} className="spin" />
              ) : catalog ? (
                <Cloud size={16} />
              ) : (
                <CloudOff size={16} />
              )}
              <span>{syncing ? `${Math.round(syncProgress)}%` : catalog ? "Local" : "Offline"}</span>
            </div>
            <button
              type="button"
              className="avatar-button"
              onClick={() => setSettingsOpen(true)}
              aria-label="Settings and backup"
            >
              <Settings size={18} />
            </button>
            <button
              type="button"
              className="mobile-menu-button"
              onClick={() => setMobileNavOpen((open) => !open)}
              aria-label="Toggle navigation menu"
              aria-expanded={mobileNavOpen}
            >
              {mobileNavOpen ? <X size={22} /> : <Menu size={22} />}
            </button>
          </div>
        </div>
        {mobileNavOpen && (
          <nav className="mobile-nav" aria-label="Mobile navigation">
            {[
              ["dashboard", "Dashboard", Grid3X3],
              ["cards", "Cards", Library],
              ["sets", "Sets", Layers3],
              ["lists", "Lists", Heart],
              ["pokedex", "Pokédex", Sparkles],
            ].map(([pageName, label, Icon]) => (
              <button
                type="button"
                key={pageName as string}
                className={page === pageName ? "active" : ""}
                onClick={() => navigate(pageName as PageName)}
              >
                <Icon size={17} />
                {label as string}
              </button>
            ))}
          </nav>
        )}
        {loadingCatalog && !catalog && (
          <div className="sync-progress" style={{ width: `${Math.max(4, syncProgress)}%` }} />
        )}
      </header>

      <main>
        {loadingCatalog && !catalog ? (
          <section className="catalog-loader">
            <div className="loader-card-stack" aria-hidden="true">
              <span />
              <span />
              <span>
                <LoaderCircle size={28} className="spin" />
              </span>
            </div>
            <span className="eyebrow">Building your card index</span>
            <h1>Connecting the multilingual catalog</h1>
            <p>
              Fetching {LANGUAGES.length} regional card libraries. The first sync is stored
              locally for fast searching next time.
            </p>
            <div className="loading-progress-wrap">
              <div className="progress-track">
                <span style={{ width: `${Math.max(4, syncProgress)}%` }} />
              </div>
              <div>
                <span>{syncLanguage ? `Loaded ${formatSyncLanguage(syncLanguage)}` : "Connecting…"}</span>
                <strong>{Math.round(syncProgress)}%</strong>
              </div>
            </div>
            <div className="loader-source">
              <ShieldCheck size={15} /> Card catalog and images provided by TCGdex
            </div>
          </section>
        ) : catalogError && !catalog ? (
          <section className="catalog-error">
            <CloudOff size={36} />
            <h1>Catalog unavailable</h1>
            <p>{catalogError}</p>
            <button className="primary-button" type="button" onClick={() => void fetchCatalog(false)}>
              <RefreshCw size={16} /> Try again
            </button>
          </section>
        ) : catalog ? (
          <div className="page-container page-enter" key={page}>
            {page === "dashboard" && (
              <DashboardPage
                catalog={catalog}
                data={data}
                onNavigate={navigate}
                onBrowseSets={() => navigate("sets")}
                onOpenSet={(setKey) => {
                  const set = catalog.sets.find((item) => item.key === setKey);
                  if (set) openSet(set);
                }}
                onRandomCard={randomCard}
              />
            )}
            {page === "cards" && (
              <CardsPage
                catalog={catalog}
                data={data}
                filters={filters}
                setFilters={setFilters}
                view={view}
                setView={setView}
                onOpenCard={setActiveCard}
                onAdd={addCard}
                onRemove={removeCard}
                onWishlist={wishlistCard}
                onManageLists={setPickerCard}
                onSync={() => void fetchCatalog(true)}
                syncing={syncing}
              />
            )}
            {page === "sets" && (
              <SetsPage catalog={catalog} data={data} onOpenSet={openSet} />
            )}
            {page === "lists" && (
              <ListsPage
                catalog={catalog}
                data={data}
                onCreateList={() => setListEditor({})}
                onEditList={(list) => setListEditor({ list })}
                onDeleteList={deleteList}
                onOpenCard={setActiveCard}
                onWishlist={wishlistCard}
                onAdd={addCard}
                onRemove={removeCard}
                onManageLists={setPickerCard}
              />
            )}
            {page === "pokedex" && (
              <PokedexPage catalog={catalog} data={data} onOpenCard={setActiveCard} />
            )}
          </div>
        ) : null}
      </main>

      <footer className="site-footer">
        <div>
          <span className="footer-brand-mark" />
          <strong>TCG Collection</strong>
          <span>Your local-first Pokémon card companion.</span>
        </div>
        <p>
          Unofficial fan project. Card data and images are provided by{" "}
          <a href="https://tcgdex.dev" target="_blank" rel="noreferrer">TCGdex</a>.
          Pokémon and related properties belong to their respective owners.
        </p>
        <button type="button" onClick={() => setSettingsOpen(true)}>
          Backup & settings <ChevronDown size={13} />
        </button>
      </footer>

      {activeCardDetail}
      {pickerCard && (
        <ListPickerDialog
          card={pickerCard}
          data={data}
          onClose={() => setPickerCard(null)}
          onToggle={(listId) =>
            setData((current) => toggleListCard(current, listId, pickerCard.key))
          }
          onCreate={() => {
            const card = pickerCard;
            setPickerCard(null);
            setListEditor({ pendingCard: card });
          }}
        />
      )}
      {listEditor && (
        <ListEditorDialog
          list={listEditor.list}
          onClose={() => setListEditor(null)}
          onSave={createOrUpdateList}
        />
      )}
      {settingsOpen && catalog && (
        <SettingsDialog
          data={data}
          catalog={catalog}
          onClose={() => setSettingsOpen(false)}
          onDataChange={setData}
          onSync={() => void fetchCatalog(true)}
          onBackup={exportBackup}
          onImport={importBackup}
          syncing={syncing}
        />
      )}

      <div className="toast-stack" aria-live="polite">
        {toasts.map((toast) => (
          <div className={`toast ${toast.kind}`} key={toast.id}>
            {toast.kind === "success" ? <CheckCircle2 size={17} /> : <CloudOff size={17} />}
            {toast.message}
          </div>
        ))}
      </div>
    </div>
  );
}
