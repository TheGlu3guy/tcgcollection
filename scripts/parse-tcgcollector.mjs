import fs from "node:fs";
import path from "node:path";
import { JSDOM } from "jsdom";

const root = process.cwd();
const snapshotFiles = [
  "Search for Pokémon cards (International TCG) – TCG Collector.html",
  "Search for Pokémon cards (International TCG) – TCG Collector2.html",
  "Search for Pokémon cards (International TCG) – TCG Collector3.html",
];

const clean = (value) => String(value ?? "").replace(/\s+/g, " ").trim();
const records = [];

function extractEmbeddedAppState(html, filename) {
  const marker = "appState:";
  const markerIndex = html.indexOf(marker);
  const start = markerIndex < 0 ? -1 : html.indexOf("{", markerIndex + marker.length);
  if (start < 0) throw new Error(`Could not locate TCG Collector app state in ${filename}`);

  let depth = 0;
  let inString = false;
  let escaped = false;
  for (let index = start; index < html.length; index += 1) {
    const character = html[index];
    if (inString) {
      if (escaped) escaped = false;
      else if (character === "\\") escaped = true;
      else if (character === '"') inString = false;
      continue;
    }
    if (character === '"') inString = true;
    else if (character === "{") depth += 1;
    else if (character === "}") {
      depth -= 1;
      if (depth === 0) return JSON.parse(html.slice(start, index + 1));
    }
  }
  throw new Error(`TCG Collector app state is incomplete in ${filename}`);
}

for (const filename of snapshotFiles) {
  const html = fs.readFileSync(path.join(root, filename), "utf8");
  const dom = new JSDOM(html, { runScripts: "outside-only" });
  const { window } = dom;
  const appState = extractEmbeddedAppState(html, filename);

  const collectionMap =
    appState.cardIdToCardCollectionCardDtoMap ??
    appState.cardIdToCardCollectionCardDTOMap ??
    {};
  const variantMap =
    appState.idToCardVariantTypeDtoMap ??
    appState.idToCardVariantTypeDTOMap ??
    {};
  const variantIdsByCard =
    appState.cardIdToCardVariantTypeIdsMap ??
    appState.cardIdToCardVariantTypeIDsMap ??
    {};
  const languageMap =
    appState.idToCardLanguageDtoMap ??
    appState.idToCardLanguageDTOMap ??
    {};

  for (const element of window.document.querySelectorAll(".card-search-result-item[data-card-id]")) {
    const cardId = clean(element.getAttribute("data-card-id"));
    const title = clean(
      element.querySelector(".card-image-grid-item-link")?.getAttribute("title") ??
      element.querySelector("img")?.getAttribute("alt"),
    );
    const imageElement = element.querySelector(".card-image-grid-item-image");
    const image =
      imageElement?.getAttribute("srcset")?.split(",").at(-1)?.trim().split(/\s+/)[0] ??
      imageElement?.getAttribute("src") ??
      "";
    const displayedQuantity = Number(clean(element.querySelector(".number-spinner-value")?.textContent) || 1);
    const collectionEntry = collectionMap[cardId];
    const variants = Array.isArray(collectionEntry?.entries)
      ? collectionEntry.entries
      : collectionEntry?.entries
        ? [collectionEntry.entries]
        : [];
    const catalogVariantIds = (variantIdsByCard[cardId] ?? []).map((id) => ({
      id: clean(id),
      name: clean(variantMap[id]?.name ?? variantMap[id]?.title),
      isStandard: Boolean(variantMap[id]?.isStandardSetType),
      isParallel: Boolean(variantMap[id]?.isParallelSetType),
      isFirstEdition: Boolean(variantMap[id]?.isFirstEditionPrint),
    }));
    const indicatorClasses = [...element.querySelectorAll(".card-collection-card-indicator.active")]
      .map((indicator) => clean(indicator.className))
      .join(" ");
    const ownedGroup = indicatorClasses.includes("standard-set")
      ? "standard"
      : indicatorClasses.includes("parallel-set")
        ? "parallel"
        : indicatorClasses.includes("other-variants")
          ? "other"
          : "any";
    const ownedVariants =
      variants.length > 0
        ? variants
        : catalogVariantIds
            .filter((variant) => {
              if (ownedGroup === "standard") return variant.isStandard;
              if (ownedGroup === "parallel") return variant.isParallel;
              if (ownedGroup === "other") return !variant.isStandard && !variant.isParallel;
              return true;
            })
            .slice(0, 1)
            .map((variant) => ({
              quantity: displayedQuantity,
              variantId: variant.id,
              variant: variant.name,
              languageId: "1",
              language: "English",
              conditionId: "8",
              condition: "",
              note: "",
            }));

    records.push({
      cardId,
      title,
      image: /^https?:\/\//.test(image) ? image : "",
      displayedQuantity,
      catalogVariantIds,
      ownedGroup,
      variants: ownedVariants.map((entry) => ({
        quantity: Number(entry.quantity ?? entry.cardCount ?? 1),
        variantId: clean(entry.cardVariantTypeId),
        variant: clean(
          variantMap[entry.cardVariantTypeId]?.name ??
          variantMap[entry.cardVariantTypeId]?.title ??
          entry.cardVariantTypeName,
        ),
        languageId: clean(entry.cardLanguageId),
        language: clean(languageMap[entry.cardLanguageId]?.name),
        conditionId: clean(entry.cardConditionId),
        condition: clean(entry.cardConditionName),
        note: clean(entry.note),
      })),
    });
  }
}

const unique = new Map(records.map((record) => [record.cardId, record]));
const summary = {
  generatedAt: new Date().toISOString(),
  sourceCards: records.length,
  uniqueCards: unique.size,
  sourceCopies: records.reduce((sum, record) => sum + record.displayedQuantity, 0),
  variantCopies: records.reduce(
    (sum, record) => sum + record.variants.reduce((inner, entry) => inner + entry.quantity, 0),
    0,
  ),
  records: [...unique.values()],
};

if (summary.uniqueCards !== 254 || summary.sourceCopies !== 254) {
  throw new Error(
    `Unexpected snapshot totals: ${summary.uniqueCards} unique cards and ${summary.sourceCopies} copies`,
  );
}

fs.mkdirSync(path.join(root, "public"), { recursive: true });
fs.writeFileSync(
  path.join(root, "public", "tcgcollector-import.json"),
  JSON.stringify(summary),
);

console.log(
  `Parsed ${summary.uniqueCards} unique cards and ${summary.sourceCopies} copies.`,
);
