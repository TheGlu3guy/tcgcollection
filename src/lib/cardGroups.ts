import { LANGUAGE_BY_CODE, LANGUAGES } from "./constants";
import type { CardCopy, Catalog, CatalogCard, CatalogSet, LanguageCode } from "../types";

const LANGUAGE_PRIORITY = LANGUAGES.map((language) => language.code);

function normalizeSetId(setId: string): string {
  return setId.trim().toLocaleLowerCase();
}

function normalizeLocalId(localId: string): string {
  const decoded = decodeURIComponent(localId).trim().toLocaleLowerCase();
  return /^\d+$/.test(decoded) ? String(Number(decoded)) : decoded;
}

export function getCardGroupKey(card: Pick<CatalogCard, "id" | "localId" | "setId" | "name">): string {
  if (card.setId && card.localId) {
    return `${normalizeSetId(card.setId)}:${normalizeLocalId(card.localId)}`;
  }
  return `${normalizeSetId(card.setId)}:${card.id.toLocaleLowerCase()}:${card.name.toLocaleLowerCase()}`;
}

function sortLanguagePriority(a: LanguageCode, b: LanguageCode): number {
  return LANGUAGE_PRIORITY.indexOf(a) - LANGUAGE_PRIORITY.indexOf(b);
}

function chooseRepresentative(
  variants: CatalogCard[],
  mode: "all" | LanguageCode,
): CatalogCard | undefined {
  if (mode !== "all") {
    return variants.find((card) => card.language === mode);
  }
  return variants.slice().sort((a, b) => sortLanguagePriority(a.language, b.language))[0];
}

export function getVisibleCards(
  cards: CatalogCard[],
  mode: "all" | LanguageCode,
): CatalogCard[] {
  const groups = new Map<
    string,
    { cards: CatalogCard[]; searchTerms: Set<string>; representative: CatalogCard }
  >();

  for (const card of cards) {
    if (mode !== "all" && card.language !== mode) continue;
    const groupKey = card.groupKey || getCardGroupKey(card);
    const existing = groups.get(groupKey);
    if (existing) {
      existing.cards.push(card);
      existing.searchTerms.add(card.searchName);
      const preferred = chooseRepresentative(existing.cards, mode);
      if (preferred) existing.representative = preferred;
    } else {
      groups.set(groupKey, {
        cards: [card],
        searchTerms: new Set([card.searchName]),
        representative: card,
      });
    }
  }

  return [...groups.entries()].map(([groupKey, group]) => ({
    ...group.representative,
    groupKey,
    searchName: [...group.searchTerms].join(" "),
  }));
}

export function getLanguageVariants(
  cards: CatalogCard[],
  selected: CatalogCard,
): CatalogCard[] {
  const groupKey = selected.groupKey || getCardGroupKey(selected);
  const variants = new Map<LanguageCode, CatalogCard>();
  for (const card of cards) {
    if ((card.groupKey || getCardGroupKey(card)) !== groupKey) continue;
    if (!variants.has(card.language)) variants.set(card.language, card);
  }
  return [...variants.values()].sort((a, b) =>
    sortLanguagePriority(a.language, b.language),
  );
}

export function getVisibleSets(
  sets: CatalogSet[],
  mode: "all" | LanguageCode,
): CatalogSet[] {
  const groups = new Map<string, CatalogSet[]>();
  for (const set of sets) {
    if (mode !== "all" && set.language !== mode) continue;
    const groupKey = normalizeSetId(set.id);
    const existing = groups.get(groupKey);
    if (existing) existing.push(set);
    else groups.set(groupKey, [set]);
  }
  return [...groups.values()].map((variants) => {
    if (mode !== "all") return variants[0];
    return variants.sort((a, b) => sortLanguagePriority(a.language, b.language))[0];
  });
}

export function getStoredCopyGroupKey(
  copy: { cardKey: string; cardId: string; setId: string; name: string },
  cardsByKey: Map<string, CatalogCard>,
): string {
  const card = cardsByKey.get(copy.cardKey);
  if (card) return card.groupKey || getCardGroupKey(card);
  const prefix = `${copy.setId}-`;
  const localId = copy.cardId.startsWith(prefix)
    ? copy.cardId.slice(prefix.length)
    : copy.cardId.slice(copy.cardId.lastIndexOf("-") + 1);
  return getCardGroupKey({
    id: copy.cardId,
    localId,
    setId: copy.setId,
    name: copy.name,
  });
}

export function withRecoveredCards(catalog: Catalog, collection: CardCopy[]): Catalog {
  const knownKeys = new Set(catalog.cards.map((card) => card.key));
  const recovered = new Map<string, CatalogCard>();

  for (const copy of collection) {
    if (knownKeys.has(copy.cardKey) || recovered.has(copy.cardKey)) continue;
    const prefix = `${copy.setId}-`;
    const localId = copy.cardId.startsWith(prefix)
      ? copy.cardId.slice(prefix.length)
      : copy.cardId.slice(copy.cardId.lastIndexOf("-") + 1);
    const language = LANGUAGE_BY_CODE[copy.language];
    const card: CatalogCard = {
      key: copy.cardKey,
      groupKey: getCardGroupKey({
        id: copy.cardId,
        localId,
        setId: copy.setId,
        name: copy.name,
      }),
      id: copy.cardId,
      localId,
      name: copy.name,
      searchName: `${copy.name} ${copy.cardId} ${localId}`.toLocaleLowerCase(),
      image: copy.image,
      language: copy.language,
      languageLabel: language?.label ?? copy.language.toLocaleUpperCase(),
      region: language?.region ?? "International",
      setId: copy.setId,
      setName: copy.setName,
      setSeries: "Imported cards",
      setTotal: 0,
    };
    recovered.set(copy.cardKey, card);
  }

  return recovered.size
    ? { ...catalog, cards: [...catalog.cards, ...recovered.values()] }
    : catalog;
}
