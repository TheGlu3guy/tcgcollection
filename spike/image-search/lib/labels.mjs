import fs from "node:fs";
import path from "node:path";
import { normalizeName } from "./common.mjs";

export function parseCsv(text) {
  const rows = [];
  let row = [];
  let field = "";
  let quoted = false;
  for (let index = 0; index < text.length; index += 1) {
    const character = text[index];
    if (quoted) {
      if (character === '"' && text[index + 1] === '"') {
        field += '"';
        index += 1;
      } else if (character === '"') {
        quoted = false;
      } else {
        field += character;
      }
    } else if (character === '"') {
      quoted = true;
    } else if (character === ",") {
      row.push(field);
      field = "";
    } else if (character === "\n") {
      row.push(field.replace(/\r$/, ""));
      rows.push(row);
      row = [];
      field = "";
    } else {
      field += character;
    }
  }
  if (field || row.length) {
    row.push(field);
    rows.push(row);
  }
  if (!rows.length) return [];
  const [header, ...records] = rows;
  return records
    .filter((record) => record.some((value) => value.trim()))
    .map((record) =>
      Object.fromEntries(header.map((name, index) => [name.trim(), record[index] ?? ""])),
    );
}

function resolveCard(cards, rawKey) {
  const value = rawKey.trim();
  return (
    cards.find((card) => card.cardKey === value) ??
    cards.find((card) => card.cardId === value) ??
    cards.find((card) => card.cardKey.endsWith(`:${value}`))
  );
}

export function loadRealQueries({ root, manifest, sameArtworkGroups }) {
  const labelsPath = path.join(root, "photos", "labels.csv");
  if (!fs.existsSync(labelsPath)) return { queries: [], errors: [] };
  const labels = parseCsv(fs.readFileSync(labelsPath, "utf8"));
  const errors = [];
  const queries = [];
  for (const label of labels) {
    const filename = label.filename?.trim();
    if (!filename) continue;
    const photoPath = path.join(root, "photos", filename);
    if (!fs.existsSync(photoPath)) {
      errors.push(`${filename}: file not found`);
      continue;
    }
    const card = resolveCard(manifest.cards, label.card_key ?? "");
    if (!card) {
      errors.push(`${filename}: card key "${label.card_key}" not found in subset`);
      continue;
    }
    const artworkGroupKey = card.artist
      ? `${normalizeName(card.name)}|${normalizeName(card.artist)}`
      : `${normalizeName(card.name)}|missing-artist`;
    queries.push({
      id: filename,
      photoPath: path.relative(root, photoPath).split(path.sep).join("/"),
      cardKey: card.cardKey,
      exactCard: card,
      sameArtworkKeys: sameArtworkGroups.get(artworkGroupKey) ?? [card.cardKey],
      notes: label.notes ?? "",
      perturbation: null,
    });
  }
  return { queries, errors };
}
