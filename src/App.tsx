import { useCallback, useEffect, useMemo, useRef, useState } from "react";
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
  ScanLine,
  Search,
  Settings,
  ShieldCheck,
  Sparkles,
  X,
} from "lucide-react";
import { CardDetailModal } from "./components/CardDetailModal";
import {
  BulkListDialog,
  ListEditorDialog,
  ListPickerDialog,
  SettingsDialog,
} from "./components/Dialogs";
import { DashboardPage } from "./pages/DashboardPage";
import { CardsPage } from "./pages/CardsPage";
import { SetsPage } from "./pages/SetsPage";
import { ListsPage } from "./pages/ListsPage";
import { PokedexPage } from "./pages/PokedexPage";
import { ScanPage } from "./pages/ScanPage";
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
  decrementCardGroup,
  decrementCardCopy,
  formatNumber,
  mergeCloudData,
  normalizeAppData,
  quantityForCard,
  toggleListCard,
  toggleListCardGroup,
  toggleWishlist,
  toggleWishlistGroup,
  updateCardCopy,
} from "./lib/collection";
import {
  getLanguageVariants,
  getStoredCopyGroupKey,
  withRecoveredCards,
} from "./lib/cardGroups";
import {
  cloudErrorMessage,
  getCloudSession,
  INITIAL_CLOUD_STATE,
  isCloudConfigured,
  loadCloudCollection,
  requestCloudPasswordReset,
  saveCloudCollection,
  signInToCloud,
  signOutOfCloud,
  signUpForCloud,
  subscribeToCloudSession,
  updateCloudPassword,
} from "./lib/cloud";
import type { CloudSyncState } from "./lib/cloud";
import { usePwaInstall } from "./lib/pwa";
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

const PAGE_NAMES: PageName[] = ["dashboard", "cards", "sets", "lists", "pokedex", "scan"];
const CLOUD_CLIENT_KEY = "tcgcollection-cloud-client-id";

function getCloudClientId(): string {
  const existing = localStorage.getItem(CLOUD_CLIENT_KEY);
  if (existing) return existing;
  const id = crypto.randomUUID();
  localStorage.setItem(CLOUD_CLIENT_KEY, id);
  return id;
}

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
  const [filters, setFilters] = useState<CardFilters>({
    ...DEFAULT_FILTERS,
    language: data.preferences.catalogLanguage,
  });
  const [view, setView] = useState<CardView>("grid");
  const [activeCard, setActiveCard] = useState<CatalogCard | null>(null);
  const [pickerCard, setPickerCard] = useState<CatalogCard | null>(null);
  const [listEditor, setListEditor] = useState<{
    list?: CardList;
    pendingCard?: CatalogCard;
    pendingCards?: CatalogCard[];
  } | null>(null);
  const [bulkListCards, setBulkListCards] = useState<CatalogCard[] | null>(null);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [mobileNavOpen, setMobileNavOpen] = useState(false);
  const [globalSearch, setGlobalSearch] = useState("");
  const [toasts, setToasts] = useState<Toast[]>([]);
  const [cloud, setCloud] = useState<CloudSyncState>(INITIAL_CLOUD_STATE);
  const pwa = usePwaInstall();
  const [passwordRecovery, setPasswordRecovery] = useState(false);
  const cloudRevisionRef = useRef<number | null>(null);
  const cloudUserIdRef = useRef<string | null>(null);
  const cloudSessionInFlightRef = useRef<string | null>(null);
  const cloudHydratedRef = useRef(false);
  const cloudLastSavedRef = useRef("");
  const cloudClientIdRef = useRef(getCloudClientId());
  const dataRef = useRef(data);
  dataRef.current = data;

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
    if (!catalog) return;
    setCatalog((current) =>
      current ? withRecoveredCards(current, data.collection) : current,
    );
  }, [catalog, data.collection]);

  const applyRemoteCloud = useCallback((remote: NonNullable<Awaited<ReturnType<typeof loadCloudCollection>>>) => {
    const remoteData = normalizeAppData(remote.data);
    cloudRevisionRef.current = remote.revision;
    cloudLastSavedRef.current = JSON.stringify(remoteData);
    cloudHydratedRef.current = true;
    setData(remoteData);
    setCloud((current) => ({
      ...current,
      authReady: true,
      status: "synced",
      lastSyncedAt: remote.updatedAt,
      error: null,
    }));
  }, []);

  const loadSessionCloud = useCallback(
    async (session: NonNullable<Awaited<ReturnType<typeof getCloudSession>>>) => {
      const userId = session.user.id;
      if (
        cloudHydratedRef.current &&
        cloudUserIdRef.current === userId
      ) {
        return;
      }
      if (cloudSessionInFlightRef.current === userId) return;
      cloudSessionInFlightRef.current = userId;
      cloudUserIdRef.current = userId;
      cloudHydratedRef.current = false;
      cloudRevisionRef.current = null;
      setCloud((current) => ({
        ...current,
        configured: true,
        authReady: true,
        status: "loading",
        email: session.user.email ?? null,
        error: null,
        message: null,
      }));

      try {
        const remote = await loadCloudCollection(userId);
        if (remote) {
          applyRemoteCloud(remote);
          pushToast("Cloud collection loaded.");
          return;
        }

        const localSnapshot = dataRef.current;
        const result = await saveCloudCollection(
          localSnapshot,
          0,
          cloudClientIdRef.current,
        );
        if (!result.saved) {
          const racedRemote = await loadCloudCollection(userId);
          if (!racedRemote) {
            throw new Error("The cloud collection changed but could not be loaded.");
          }
          applyRemoteCloud(racedRemote);
          return;
        }

        cloudRevisionRef.current = result.revision;
        cloudLastSavedRef.current = JSON.stringify(localSnapshot);
        cloudHydratedRef.current = true;
        setCloud((current) => ({
          ...current,
          status: "synced",
          lastSyncedAt: new Date().toISOString(),
          error: null,
        }));
        pushToast("This browser's collection was uploaded to your account.");
      } catch (reason) {
        setCloud((current) => ({
          ...current,
          status: "error",
          error: cloudErrorMessage(reason),
        }));
      } finally {
        if (cloudSessionInFlightRef.current === userId) {
          cloudSessionInFlightRef.current = null;
        }
      }
    },
    [applyRemoteCloud, pushToast],
  );

  useEffect(() => {
    if (!isCloudConfigured) {
      setCloud(INITIAL_CLOUD_STATE);
      return;
    }
    let active = true;
    const applySession = async (
      session: Awaited<ReturnType<typeof getCloudSession>>,
    ) => {
      if (!active) return;
      if (session) {
        await loadSessionCloud(session);
        return;
      }
      cloudHydratedRef.current = false;
      cloudRevisionRef.current = null;
      cloudUserIdRef.current = null;
      cloudSessionInFlightRef.current = null;
      setCloud((current) => ({
        ...INITIAL_CLOUD_STATE,
        configured: true,
        authReady: true,
        status: current.status === "error" ? "error" : "signed-out",
        error: current.status === "error" ? current.error : null,
      }));
    };

    void getCloudSession()
      .then(applySession)
      .catch((reason) =>
        active &&
        setCloud((current) => ({
          ...current,
          authReady: true,
          status: "error",
          error: cloudErrorMessage(reason),
        })),
      );
    const unsubscribe = subscribeToCloudSession((session, event) => {
      if (event === "PASSWORD_RECOVERY") setPasswordRecovery(true);
      void applySession(session);
    });
    return () => {
      active = false;
      unsubscribe();
    };
  }, [loadSessionCloud]);

  const commitCloudData = useCallback(async (snapshot: AppData) => {
    const userId = cloudUserIdRef.current;
    const baseRevision = cloudRevisionRef.current;
    if (!userId || baseRevision === null || !cloudHydratedRef.current) {
      throw new Error("Sign in to sync your collection.");
    }

    setCloud((current) => ({ ...current, status: "saving", error: null }));
    try {
      let candidate = snapshot;
      let result = await saveCloudCollection(
        candidate,
        baseRevision,
        cloudClientIdRef.current,
      );
      if (!result.saved) {
        const remote = await loadCloudCollection(userId);
        if (!remote) throw new Error("A cloud sync conflict could not be resolved.");
        candidate = mergeCloudData(candidate, normalizeAppData(remote.data));
        result = await saveCloudCollection(
          candidate,
          remote.revision,
          cloudClientIdRef.current,
        );
        if (!result.saved) {
          throw new Error("The cloud changed again. Press Sync now to retry.");
        }
        setData(candidate);
      }

      cloudRevisionRef.current = result.revision;
      cloudLastSavedRef.current = JSON.stringify(candidate);
      const syncedAt = new Date().toISOString();
      setCloud((current) => ({
        ...current,
        status: "synced",
        lastSyncedAt: syncedAt,
        error: null,
      }));
      return candidate;
    } catch (reason) {
      setCloud((current) => ({
        ...current,
        status: "error",
        error: cloudErrorMessage(reason),
      }));
      throw reason;
    }
  }, []);

  useEffect(() => {
    if (
      !cloudHydratedRef.current ||
      !cloud.email ||
      cloudRevisionRef.current === null
    ) {
      return;
    }
    const payload = JSON.stringify(data);
    if (payload === cloudLastSavedRef.current) return;
    const snapshot = data;
    const timeout = window.setTimeout(() => {
      if (JSON.stringify(snapshot) === cloudLastSavedRef.current) return;
      void commitCloudData(snapshot).catch(() => undefined);
    }, 700);
    return () => window.clearTimeout(timeout);
  }, [cloud.email, commitCloudData, data]);

  useEffect(() => {
    const handleHashChange = () => setPage(initialPage());
    window.addEventListener("hashchange", handleHashChange);
    return () => window.removeEventListener("hashchange", handleHashChange);
  }, []);

  useEffect(() => {
    setFilters((current) =>
      current.language === data.preferences.catalogLanguage
        ? current
        : { ...current, language: data.preferences.catalogLanguage, setId: "all" },
    );
  }, [data.preferences.catalogLanguage]);

  useEffect(() => {
    if (passwordRecovery) setSettingsOpen(true);
  }, [passwordRecovery]);

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

  const removeCard = useCallback(
    (card: CatalogCard) => {
      setData((current) =>
        catalog
          ? decrementCardGroup(current, catalog.cards, card.groupKey)
          : decrementCardCopy(current, card.key),
      );
    },
    [catalog],
  );

  const wishlistCard = useCallback(
    (card: CatalogCard) => {
      const variants = catalog ? getLanguageVariants(catalog.cards, card) : [card];
      const adding = !variants.some((variant) => data.wishlist.includes(variant.key));
      setData((current) =>
        catalog
          ? toggleWishlistGroup(current, catalog.cards, card.groupKey, card.key)
          : toggleWishlist(current, card.key),
      );
      pushToast(adding ? `${card.name} added to your wishlist.` : `${card.name} removed from your wishlist.`);
    },
    [catalog, data.wishlist, pushToast],
  );

  const openSet = useCallback(
    (set: CatalogSet) => {
      setFilters({
        ...DEFAULT_FILTERS,
        language: data.preferences.catalogLanguage,
        setId: set.key,
        sort: "number-asc",
      });
      navigate("cards");
    },
    [data.preferences.catalogLanguage, navigate],
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
      const pendingKeys =
        listEditor?.pendingCards?.map((card) => card.key) ??
        (listEditor?.pendingCard ? [listEditor.pendingCard.key] : []);
      setData((current) => ({
        ...current,
        lists: [
          ...current.lists,
          {
            id,
            ...values,
            cardKeys: [...new Set(pendingKeys)],
            createdAt: now,
            updatedAt: now,
          },
        ],
      }));
      pushToast(
        pendingKeys.length
          ? `List created and ${pendingKeys.length} card${pendingKeys.length === 1 ? "" : "s"} added.`
          : "List created.",
      );
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

  const bulkWishlist = (cards: CatalogCard[], add: boolean) => {
    if (!catalog || cards.length === 0) return;
    const cardsByKey = new Map(catalog.cards.map((card) => [card.key, card]));
    const selectedGroups = new Set(cards.map((card) => card.groupKey));
    if (add) {
      const existingGroups = new Set(
        data.wishlist.map((key) => cardsByKey.get(key)?.groupKey ?? key),
      );
      const additions = cards
        .filter(
          (card, index, list) =>
            !existingGroups.has(card.groupKey) &&
            list.findIndex((item) => item.groupKey === card.groupKey) === index,
        )
        .map((card) => card.key);
      setData({
        ...data,
        wishlist: [...new Set([...data.wishlist, ...additions])],
      });
      pushToast(
        `${additions.length} card${additions.length === 1 ? "" : "s"} added to your wishlist.`,
      );
    } else {
      const nextWishlist = data.wishlist.filter((key) => {
        const groupKey = cardsByKey.get(key)?.groupKey ?? key;
        return !selectedGroups.has(groupKey);
      });
      const removed = data.wishlist.length - nextWishlist.length;
      setData({ ...data, wishlist: nextWishlist });
      pushToast(
        `${removed} card${removed === 1 ? "" : "s"} removed from your wishlist.`,
      );
    }
  };

  const bulkCollection = (cards: CatalogCard[]) => {
    if (!catalog || cards.length === 0) return;
    const cardsByKey = new Map(catalog.cards.map((card) => [card.key, card]));
    const ownedGroups = new Set(
      data.collection.map((copy) => getStoredCopyGroupKey(copy, cardsByKey)),
    );
    const additions = cards.filter(
      (card, index, list) =>
        !ownedGroups.has(card.groupKey) &&
        list.findIndex((item) => item.groupKey === card.groupKey) === index,
    );
    let next = data;
    for (const card of additions) next = addCardCopy(next, card);
    setData(next);
    pushToast(
      additions.length
        ? `${additions.length} new card${additions.length === 1 ? "" : "s"} added to your collection.`
        : "All selected cards are already in your collection.",
    );
  };

  const addBulkCardsToList = (listId: string, cards: CatalogCard[]) => {
    if (!catalog) return;
    const cardsByKey = new Map(catalog.cards.map((card) => [card.key, card]));
    const targetList = data.lists.find((list) => list.id === listId);
    const existingGroups = new Set(
      targetList?.cardKeys.map(
        (key) => cardsByKey.get(key)?.groupKey ?? key,
      ) ?? [],
    );
    const additions = cards.filter(
      (card, index, list) =>
        !existingGroups.has(card.groupKey) &&
        list.findIndex((item) => item.groupKey === card.groupKey) === index,
    );
    setData({
      ...data,
      lists: data.lists.map((list) =>
        list.id === listId
          ? {
              ...list,
              cardKeys: [
                ...list.cardKeys,
                ...additions.map((card) => card.key),
              ],
              updatedAt: new Date().toISOString(),
            }
          : list,
      ),
    });
    setBulkListCards(null);
    pushToast(
      `${additions.length} card${additions.length === 1 ? "" : "s"} added to ${targetList?.name ?? "the list"}.`,
    );
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

  const cloudSignIn = async (email: string, password: string) => {
    await signInToCloud(email, password);
  };

  const cloudSignUp = async (email: string, password: string) => {
    const hasSession = await signUpForCloud(email, password);
    if (!hasSession) {
      setCloud((current) => ({
        ...current,
        status: "signed-out",
        message: "Check your email to confirm the account.",
      }));
    }
  };

  const cloudSignOut = async () => {
    await signOutOfCloud();
    cloudHydratedRef.current = false;
    cloudRevisionRef.current = null;
    cloudUserIdRef.current = null;
    setCloud((current) => ({
      ...current,
      status: "signed-out",
      email: null,
      lastSyncedAt: null,
      error: null,
      message: "Signed out. This browser still keeps a local copy.",
    }));
  };

  const cloudPasswordReset = async (email: string) => {
    await requestCloudPasswordReset(email);
  };

  const cloudUpdatePassword = async (password: string) => {
    await updateCloudPassword(password);
    setPasswordRecovery(false);
    pushToast("Password updated.");
  };

  const cloudSyncNow = async () => {
    await commitCloudData(dataRef.current);
  };

  const activeCardDetail = activeCard ? (
    <CardDetailModal
      card={activeCard}
      data={data}
      languageVariants={
        catalog ? getLanguageVariants(catalog.cards, activeCard) : [activeCard]
      }
      onClose={() => setActiveCard(null)}
      onAdd={(options) => {
        setData((current) => addCardCopy(current, activeCard, options));
        pushToast(`${activeCard.name} added.`);
      }}
      onRemoveOne={() => removeCard(activeCard)}
      onWishlist={() => wishlistCard(activeCard)}
      onDataChange={setData}
      onChangeList={(listId) => {
        setData((current) =>
          catalog
            ? toggleListCardGroup(
                current,
                listId,
                catalog.cards,
                activeCard.groupKey,
                activeCard.key,
              )
            : toggleListCard(current, listId, activeCard.key),
        );
      }}
      onCreateList={() => setListEditor({ pendingCard: activeCard })}
      onSwitchLanguage={setActiveCard}
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
              ["scan", "Scan"],
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
            <div
              className={`sync-status ${syncing || cloud.status === "saving" ? "syncing" : ""} ${cloud.email ? "cloud-connected" : ""}`}
              title={
                cloud.email
                  ? `Cloud account: ${cloud.email}`
                  : isCloudConfigured
                    ? "Local collection · cloud account available in settings"
                    : "Local collection"
              }
            >
              {syncing ? (
                <RefreshCw size={16} className="spin" />
              ) : cloud.status === "saving" ? (
                <RefreshCw size={16} className="spin" />
              ) : cloud.email ? (
                <Cloud size={16} />
              ) : catalog ? (
                <Cloud size={16} />
              ) : (
                <CloudOff size={16} />
              )}
              <span>
                {syncing
                  ? `${Math.round(syncProgress)}%`
                  : cloud.status === "saving"
                    ? "Saving"
                    : cloud.email
                      ? "Cloud"
                      : catalog
                        ? "Local"
                        : "Offline"}
              </span>
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
              ["scan", "Scan", ScanLine],
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
                setFilters={(nextFilters) => {
                  setFilters(nextFilters);
                  if (nextFilters.language !== data.preferences.catalogLanguage) {
                    setData((current) => ({
                      ...current,
                      preferences: {
                        ...current.preferences,
                        catalogLanguage: nextFilters.language,
                      },
                    }));
                  }
                }}
                view={view}
                setView={setView}
                onOpenCard={setActiveCard}
                onAdd={addCard}
                onRemove={removeCard}
                onWishlist={wishlistCard}
                onManageLists={setPickerCard}
                onBulkWishlist={bulkWishlist}
                onBulkCollection={bulkCollection}
                onBulkList={setBulkListCards}
                onSync={() => void fetchCatalog(true)}
                syncing={syncing}
              />
            )}
            {page === "sets" && (
              <SetsPage
                catalog={catalog}
                data={data}
                onOpenSet={openSet}
                onLanguageChange={(catalogLanguage) => {
                  setData((current) => ({
                    ...current,
                    preferences: { ...current.preferences, catalogLanguage },
                  }));
                }}
              />
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
            {page === "scan" && (
              <ScanPage catalog={catalog} onOpenCard={setActiveCard} />
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
          variantKeys={
            catalog
              ? getLanguageVariants(catalog.cards, pickerCard).map((card) => card.key)
              : [pickerCard.key]
          }
          data={data}
          onClose={() => setPickerCard(null)}
          onToggle={(listId) =>
            setData((current) =>
              catalog
                ? toggleListCardGroup(
                    current,
                    listId,
                    catalog.cards,
                    pickerCard.groupKey,
                    pickerCard.key,
                  )
                : toggleListCard(current, listId, pickerCard.key),
            )
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
      {bulkListCards && (
        <BulkListDialog
          count={bulkListCards.length}
          lists={data.lists}
          onClose={() => setBulkListCards(null)}
          onAdd={(listId) => addBulkCardsToList(listId, bulkListCards)}
          onCreate={() => {
            setListEditor({ pendingCards: bulkListCards });
            setBulkListCards(null);
          }}
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
          cloud={cloud}
          onCloudSignIn={cloudSignIn}
          onCloudSignUp={cloudSignUp}
          onCloudSignOut={cloudSignOut}
          onCloudPasswordReset={cloudPasswordReset}
          passwordRecovery={passwordRecovery}
          onCloudUpdatePassword={cloudUpdatePassword}
          onCloudSync={cloudSyncNow}
          pwa={pwa}
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
