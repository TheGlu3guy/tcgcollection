async () => {
  const STORAGE_KEY = "tcgcollection-personal-v1";
  const CATALOG_KEY = "tcgcollection-catalog-v8";
  const SOURCE_URL = "/tcgcollector-import.json";

  const openDatabase = () =>
    new Promise((resolve, reject) => {
      const request = indexedDB.open("tcgcollection", 2);
      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error);
    });
  const readCatalog = async (database) =>
    new Promise((resolve, reject) => {
      const transaction = database.transaction("catalog", "readonly");
      const request = transaction.objectStore("catalog").get(CATALOG_KEY);
      request.onsuccess = () => resolve(request.result?.catalog ?? null);
      request.onerror = () => reject(request.error);
    });
  const writeCatalog = async (database, catalog) =>
    new Promise((resolve, reject) => {
      const transaction = database.transaction("catalog", "readwrite");
      transaction.objectStore("catalog").put({ key: CATALOG_KEY, catalog });
      transaction.oncomplete = resolve;
      transaction.onerror = () => reject(transaction.error);
    });

  const normalize = (value) =>
    String(value ?? "")
      .normalize("NFKD")
      .replace(/[\u0300-\u036f]/g, "")
      .replace(/♂/g, " male ")
      .replace(/♀/g, " female ")
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, " ")
      .trim()
      .replace(/\s+/g, " ");
  const normalizeId = (value) => {
    const compact = String(value ?? "").toUpperCase().replace(/[^A-Z0-9]/g, "");
    return compact.replace(/^([A-Z]*?)0+(?=\d)/, "$1") || compact;
  };
  const groupKey = (setId, localId) =>
    `${setId.toLowerCase()}:${normalizeId(localId).toLowerCase()}`;

  const [database, source] = await Promise.all([
    openDatabase(),
    fetch(SOURCE_URL, { cache: "no-store" }).then((response) => {
      if (!response.ok) throw new Error(`Import data returned HTTP ${response.status}.`);
      return response.json();
    }),
  ]);
  const catalog = await readCatalog(database);
  if (!catalog?.cards?.length) {
    database.close();
    throw new Error("The local TCGdex catalog is not available.");
  }

  const defaultData = {
    schemaVersion: 1,
    collection: [],
    wishlist: [],
    lists: [],
    notes: {},
    preferences: {
      defaultCondition: "Near Mint",
      defaultVariant: "Unspecified",
      catalogLanguage: "all",
      showMissingImages: true,
      collectionValueCurrency: "EUR",
    },
  };
  const currentData = localStorage.getItem(STORAGE_KEY);
  const appData = currentData ? JSON.parse(currentData) : structuredClone(defaultData);
  appData.collection ??= [];
  appData.wishlist ??= [];
  appData.lists ??= [];
  appData.notes ??= {};
  appData.preferences ??= structuredClone(defaultData.preferences);

  const syntheticDefinitions = {
    "43876": {
      key: "en:tcgcollector-43876",
      groupKey: "tcgcollector-30th-c-venusaur:4",
      id: "tcgcollector-43876",
      localId: "004",
      name: "Paras",
      language: "en",
      languageLabel: "English",
      region: "International",
      setId: "tcgcollector-30th-c-venusaur",
      setName: "Pokémon TCG Classic (Venusaur)",
      setSeries: "Other",
      setTotal: 34,
      searchName: "paras tcgcollector 43876 004",
    },
    "51412": {
      key: "en:tcgcollector-51412",
      groupKey: "tcgcollector-tropical-mega-battle:11",
      id: "tcgcollector-51412",
      localId: "011",
      name: "Bruno's Hitmonchan",
      language: "en",
      languageLabel: "English",
      region: "International",
      setId: "tcgcollector-tropical-mega-battle",
      setName: "Tropical Mega Battle",
      setSeries: "Other",
      setTotal: 0,
      searchName: "bruno s hitmonchan tcgcollector 51412 011",
    },
  };

  for (const sourceCard of source.records) {
    const definition = syntheticDefinitions[sourceCard.cardId];
    if (!definition || catalog.cards.some((card) => card.key === definition.key)) continue;
    catalog.cards.push({
      ...definition,
      image: sourceCard.image,
    });
  }

  const englishCards = catalog.cards.filter(
    (card) => card.language === "en" && card.region === "International",
  );
  const cardsById = new Map();
  for (const card of englishCards) {
    const id = normalizeId(card.localId);
    const matches = cardsById.get(id) ?? [];
    matches.push(card);
    cardsById.set(id, matches);
  }

  const resolved = [];
  const unresolved = [];
  for (const sourceCard of source.records) {
    const synthetic = syntheticDefinitions[sourceCard.cardId];
    if (synthetic) {
      const card = catalog.cards.find((candidate) => candidate.key === synthetic.key);
      resolved.push({ sourceCard, card, matchKind: "preserved-local" });
      continue;
    }

    const trailingId = sourceCard.title.match(/([^ ()/]+)\/([^ ()/]+)\)\s*$/)?.[1] ?? "";
    const candidates = cardsById.get(normalizeId(trailingId)) ?? [];
    const sourceTitle = normalize(sourceCard.title);
    const exact = candidates.filter((card) =>
      sourceTitle.startsWith(normalize(`${card.name} (${card.setName}`)),
    );
    const setMatches = candidates
      .map((card) => {
        const setName = normalize(card.setName);
        let bestEnd = -1;
        let offset = sourceTitle.indexOf(setName);
        while (offset >= 0) {
          bestEnd = Math.max(bestEnd, offset + setName.length);
          offset = sourceTitle.indexOf(setName, offset + 1);
        }
        return { card, bestEnd, length: setName.length };
      })
      .filter((match) => match.bestEnd >= 0);
    const latestSetEnd = Math.max(-1, ...setMatches.map((match) => match.bestEnd));
    const latestSetMatches = setMatches.filter((match) => match.bestEnd === latestSetEnd);
    const longestSetLength = Math.max(
      -1,
      ...latestSetMatches.map((match) => match.length),
    );
    const bySet = latestSetMatches
      .filter((match) => match.length === longestSetLength)
      .map((match) => match.card);
    const byName = candidates.filter((card) =>
      sourceTitle.startsWith(normalize(card.name)),
    );
    const options = exact.length ? exact : bySet.length ? bySet : byName;
    if (options.length === 1) {
      resolved.push({
        sourceCard,
        card: options[0],
        matchKind: exact.length ? "exact" : bySet.length ? "set-match" : "name-and-number",
      });
    } else {
      unresolved.push({
        title: sourceCard.title,
        optionCount: options.length,
        options: options.slice(0, 10).map((card) => card.key),
      });
    }
  }
  if (unresolved.length) {
    database.close();
    throw new Error(`Could not safely resolve ${unresolved.length} cards: ${JSON.stringify(unresolved)}`);
  }

  const now = new Date().toISOString();
  const existingIds = new Set(appData.collection.map((copy) => copy.id));
  const imported = [];
  for (const { sourceCard, card } of resolved) {
    const id = `tcgcollector-import-${sourceCard.cardId}`;
    if (existingIds.has(id)) continue;
    imported.push({
      id,
      cardKey: card.key,
      cardId: card.id,
      language: "en",
      name: card.name,
      image: card.image,
      setId: card.setId,
      setName: card.setName,
      quantity: sourceCard.displayedQuantity,
      condition: "Unspecified",
      variant: sourceCard.ownedGroup === "parallel" ? "Reverse Holo" : "Normal",
      currency: appData.preferences.collectionValueCurrency ?? "EUR",
      notes: sourceCard.variants.find((variant) => variant.note)?.note ?? "",
      addedAt: now,
      updatedAt: now,
    });
  }

  appData.schemaVersion = 1;
  appData.collection.push(...imported);
  localStorage.setItem(STORAGE_KEY, JSON.stringify(appData));
  if (source.records.some((record) => syntheticDefinitions[record.cardId])) {
    await writeCatalog(database, catalog);
  }
  database.close();

  return {
    sourceCards: source.records.length,
    matched: resolved.length,
    importedNow: imported.length,
    skippedExisting: resolved.length - imported.length,
    unresolved,
    matchKinds: resolved.reduce((counts, item) => {
      counts[item.matchKind] = (counts[item.matchKind] ?? 0) + 1;
      return counts;
    }, {}),
    collectionCards: appData.collection.length,
    collectionCopies: appData.collection.reduce((total, copy) => total + copy.quantity, 0),
    wishlistCards: appData.wishlist.length,
    lists: appData.lists.length,
  };
};
