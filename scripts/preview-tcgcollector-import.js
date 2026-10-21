async () => {
  const openDatabase = () =>
    new Promise((resolve, reject) => {
      const request = indexedDB.open("tcgcollection", 2);
      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error);
    });
  const readCatalog = async () => {
    const database = await openDatabase();
    const catalog = await new Promise((resolve, reject) => {
      const transaction = database.transaction("catalog", "readonly");
      const request = transaction
        .objectStore("catalog")
        .get("tcgcollection-catalog-v8");
      request.onsuccess = () => resolve(request.result?.catalog ?? null);
      request.onerror = () => reject(request.error);
    });
    database.close();
    return catalog;
  };

  const normalize = (value) =>
    String(value ?? "")
      .normalize("NFKD")
      .replace(/[\u0300-\u036f]/g, "")
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, " ")
      .trim()
      .replace(/\s+/g, " ");
  const normalizeId = (value) => {
    const compact = String(value ?? "").toUpperCase().replace(/[^A-Z0-9]/g, "");
    return compact.replace(/^([A-Z]*?)0+(?=\d)/, "$1") || compact;
  };
  const displayId = (card) => {
    const local = String(card.localId ?? "");
    const total = String(card.setTotal ?? "");
    return /^\d+$/.test(local) && /^\d+$/.test(total)
      ? local.padStart(total.length, "0")
      : local;
  };
  const exactTitle = (card) =>
    normalize(`${card.name} (${card.setName} ${displayId(card)}/${card.setTotal})`);
  const looseKey = (name, localId, setTotal) =>
    `${normalize(name)}|${normalizeId(localId)}|${normalizeId(setTotal)}`;

  const [catalog, importData] = await Promise.all([
    readCatalog(),
    fetch("/tcgcollector-import.json", { cache: "no-store" }).then((response) => response.json()),
  ]);
  if (!catalog?.cards?.length) throw new Error("The TCGdex catalog is not loaded.");

  const englishCards = catalog.cards.filter(
    (card) => card.language === "en" && card.region === "International",
  );
  const byExactTitle = new Map();
  const byLooseKey = new Map();
  for (const card of englishCards) {
    const titleKey = exactTitle(card);
    const titleMatches = byExactTitle.get(titleKey) ?? [];
    titleMatches.push(card);
    byExactTitle.set(titleKey, titleMatches);

    const fallbackKey = looseKey(card.name, card.localId, card.setTotal);
    const fallbackMatches = byLooseKey.get(fallbackKey) ?? [];
    fallbackMatches.push(card);
    byLooseKey.set(fallbackKey, fallbackMatches);
  }

  const matches = [];
  const unmatched = [];
  const ambiguous = [];
  for (const source of importData.records) {
    const titleKey = normalize(source.title);
    const exact = byExactTitle.get(titleKey) ?? [];
    const trailingMatch = source.title.match(/^(.*) \(([\s\S]+) ([^ ()/]+)\/([^ ()/]+)\)$/);
    const fallback = trailingMatch
      ? byLooseKey.get(looseKey(trailingMatch[1], trailingMatch[3], trailingMatch[4])) ?? []
      : [];
    const options = exact.length > 0 ? exact : fallback;
    if (options.length === 1) {
      matches.push({
        source,
        card: {
          key: options[0].key,
          id: options[0].id,
          name: options[0].name,
          image: options[0].image,
          setId: options[0].setId,
          setName: options[0].setName,
          localId: options[0].localId,
          setTotal: options[0].setTotal,
          artist: options[0].artist,
        },
        matchKind: exact.length === 1 ? "exact" : "name-number",
      });
    } else if (options.length > 1) {
      ambiguous.push({
        title: source.title,
        options: options.slice(0, 8).map((card) => ({
          key: card.key,
          name: card.name,
          setId: card.setId,
          setName: card.setName,
          localId: card.localId,
          setTotal: card.setTotal,
        })),
      });
    } else {
      unmatched.push(source.title);
    }
  }

  return {
    sourceCards: importData.records.length,
    matched: matches.length,
    unmatched,
    ambiguous,
    matchKinds: matches.reduce((result, item) => {
      result[item.matchKind] = (result[item.matchKind] ?? 0) + 1;
      return result;
    }, {}),
    sampleMatches: matches.slice(0, 12).map(({ source, card }) => ({
      source: source.title,
      matched: `${card.name} (${card.setName} ${card.localId}/${card.setTotal})`,
    })),
  };
}
