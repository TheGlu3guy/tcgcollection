import fs from "node:fs";
import path from "node:path";
import {
  createRng,
  ensureDir,
  fileExists,
  findCachedImage,
  mapLimit,
  shuffle,
  sleep,
} from "./common.mjs";

const API_ROOT = "https://api.tcgdex.net/v2";

function compatibleImageUrl(image) {
  if (!image) return undefined;
  if (image.endsWith(".webp") || image.endsWith(".png") || image.endsWith(".jpg")) {
    return image;
  }
  return `${image}/high.webp`;
}

async function fetchJson(url, options = {}, attempts = 4) {
  let lastError;
  for (let attempt = 1; attempt <= attempts; attempt += 1) {
    try {
      const response = await fetch(url, {
        ...options,
        headers: {
          "User-Agent": "tcgcollection-image-search-spike/0.1",
          ...options.headers,
        },
      });
      if (!response.ok) {
        throw new Error(`${response.status} ${response.statusText}`);
      }
      return await response.json();
    } catch (error) {
      lastError = error;
      if (attempt < attempts) await sleep(500 * attempt);
    }
  }
  throw lastError;
}

function findSetForCard(card, sets) {
  return sets
    .slice()
    .sort((a, b) => b.id.length - a.id.length)
    .find((set) => card.id.toLocaleLowerCase().startsWith(`${set.id.toLocaleLowerCase()}-`));
}

async function fetchArtists() {
  const result = await fetchJson(`${API_ROOT}/graphql`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      query: "{ cards { id localId illustrator set { id } } }",
    }),
  });
  if (result.errors?.length) throw new Error(result.errors[0].message);
  return new Map(
    (result.data?.cards ?? []).map((card) => [
      `${card.set.id.toLocaleLowerCase()}:${String(card.localId).toLocaleLowerCase()}`,
      card.illustrator,
    ]),
  );
}

async function fetchLanguage(language) {
  const [sets, cards] = await Promise.all([
    fetchJson(`${API_ROOT}/${language}/sets`),
    fetchJson(`${API_ROOT}/${language}/cards`),
  ]);
  return { language, sets, cards };
}

function enrichCard(card, sets, artistByCard, language, selectedSetId, isDistractor) {
  const set = findSetForCard(card, sets);
  const localId = card.localId ?? card.id.split("-").slice(1).join("-");
  const imageUrl = compatibleImageUrl(card.image);
  if (!imageUrl) return null;
  return {
    cardKey: `${language}:${card.id}`,
    cardId: card.id,
    language,
    name: card.name,
    setId: set?.id ?? selectedSetId ?? "unknown",
    setName: set?.name ?? "Unknown set",
    localId,
    setTotal: set?.cardCount?.official ?? set?.cardCount?.total ?? 0,
    artist: artistByCard.get(
      `${(set?.id ?? "").toLocaleLowerCase()}:${String(localId).toLocaleLowerCase()}`,
    ),
    imageUrl,
    isDistractor,
  };
}

async function downloadImage(card, paths, delayMs) {
  const imageDirectory = path.join(paths.imageCache, card.language);
  ensureDir(imageDirectory);
  const basePath = path.join(imageDirectory, card.cardId.replace(/[^a-zA-Z0-9._-]/g, "_"));
  const existing = findCachedImage(basePath);
  if (existing) return path.relative(paths.root, existing).split(path.sep).join("/");

  for (let attempt = 1; attempt <= 4; attempt += 1) {
    try {
      const response = await fetch(card.imageUrl, {
        headers: { "User-Agent": "tcgcollection-image-search-spike/0.1" },
      });
      if (!response.ok) throw new Error(`${response.status} ${response.statusText}`);
      const contentType = response.headers.get("content-type") ?? "";
      if (!contentType.startsWith("image/")) {
        throw new Error(`Unexpected content type: ${contentType}`);
      }
      const extension = contentType.includes("png")
        ? ".png"
        : contentType.includes("jpeg")
          ? ".jpg"
          : ".webp";
      const target = `${basePath}${extension}`;
      fs.writeFileSync(target, Buffer.from(await response.arrayBuffer()));
      await sleep(delayMs);
      return path.relative(paths.root, target).split(path.sep).join("/");
    } catch (error) {
      if (attempt === 4) throw error;
      await sleep(500 * attempt);
    }
  }
  throw new Error(`Could not download ${card.imageUrl}`);
}

export async function buildSubset({ config, paths }) {
  const artistByCard = await fetchArtists();
  const selected = [];
  const distractorPool = [];
  const setSummary = [];

  for (const language of config.languages) {
    const data = await fetchLanguage(language);
    const selectedSetIds = new Set(config.setIds.map((id) => id.toLocaleLowerCase()));
    const setMap = new Map(data.sets.map((set) => [set.id.toLocaleLowerCase(), set]));

    for (const setId of config.setIds) {
      const set = setMap.get(setId.toLocaleLowerCase());
      if (!set) throw new Error(`TCGdex did not return set ${setId} for ${language}.`);
      const cards = data.cards
        .filter((card) => card.id.toLocaleLowerCase().startsWith(`${set.id.toLocaleLowerCase()}-`))
        .map((card) => enrichCard(card, data.sets, artistByCard, language, set.id, false))
        .filter(Boolean);
      selected.push(...cards);
      setSummary.push({
        language,
        setId: set.id,
        setName: set.name,
        releaseDate: set.releaseDate,
        cardsWithImages: cards.length,
      });
    }

    for (const card of data.cards) {
      const set = findSetForCard(card, data.sets);
      if (!card.image || (set && selectedSetIds.has(set.id.toLocaleLowerCase()))) continue;
      const enriched = enrichCard(card, data.sets, artistByCard, language, undefined, true);
      if (enriched) distractorPool.push(enriched);
    }
  }

  const rng = createRng(config.syntheticSeed);
  const distractors = shuffle(distractorPool, rng).slice(0, config.distractorCount);
  if (distractors.length < config.distractorCount) {
    throw new Error(
      `Requested ${config.distractorCount} distractors, but only ${distractors.length} were available.`,
    );
  }

  const cards = [...selected, ...distractors];
  const unique = [...new Map(cards.map((card) => [card.cardKey, card])).values()];
  let completed = 0;
  await mapLimit(unique, config.downloadConcurrency, async (card) => {
    card.imagePath = await downloadImage(card, { ...paths, root: paths.root }, config.requestDelayMs);
    completed += 1;
    if (completed % 100 === 0 || completed === unique.length) {
      process.stdout.write(`Images ${completed}/${unique.length}\n`);
    }
  });

  const manifest = {
    createdAt: new Date().toISOString(),
    generator: "spike/image-search/scripts/build-subset.mjs",
    languages: config.languages,
    selectedSets: setSummary,
    distractorCount: distractors.length,
    cardCount: unique.length,
    cards: unique.map((card) => ({
      cardKey: card.cardKey,
      cardId: card.cardId,
      language: card.language,
      name: card.name,
      setId: card.setId,
      setName: card.setName,
      localId: card.localId,
      setTotal: card.setTotal,
      artist: card.artist ?? null,
      imageUrl: card.imageUrl,
      imagePath: card.imagePath,
      isDistractor: card.isDistractor,
    })),
  };
  return manifest;
}

export function assertCachedImages(manifest, root) {
  const missing = manifest.cards.filter(
    (card) => !fileExists(path.join(root, card.imagePath)),
  );
  if (missing.length) {
    throw new Error(`Image cache is missing ${missing.length} files. Re-run subset.`);
  }
}
