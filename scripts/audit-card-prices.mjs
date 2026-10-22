import fs from "node:fs";

const backup = JSON.parse(
  fs.readFileSync(
    "tcgcollection-backup-2026-10-21.json",
    "utf8",
  ),
);
const cards = [
  ...new Map(backup.data.collection.map((copy) => [copy.cardKey, copy])).values(),
];

function preferredType(copy, detail) {
  const preference = String(copy.variant ?? "").toLocaleLowerCase();
  const variants = detail.variants ?? {};
  const detailed = new Set(
    (detail.variants_detailed ?? []).map((variant) =>
      variant.type.toLocaleLowerCase(),
    ),
  );
  if (preference.includes("reverse") && variants.reverse) return "reverse";
  if (preference.includes("holo") && variants.holo) return "holo";
  if (variants.normal) return "normal";
  if (variants.holo || detailed.has("holo")) return "holo";
  if (variants.reverse || detailed.has("reverse")) return "reverse";
  return detail.variants_detailed?.[0]?.type?.toLocaleLowerCase() ?? "";
}

const audit = [];
let cursor = 0;
const worker = async () => {
  while (cursor < cards.length) {
    const copy = cards[cursor++];
    if (copy.cardId.startsWith("tcgcollector-")) {
      audit.push({
        name: copy.name,
        id: copy.cardId,
        set: copy.setName,
        cardmarket: false,
        tcgplayer: false,
        reason: "custom card",
      });
      continue;
    }
    try {
      const detail = await fetch(
        `https://api.tcgdex.net/v2/en/cards/${encodeURIComponent(copy.cardId)}`,
      ).then((response) => response.json());
      const type = preferredType(copy, detail);
      const variant = detail.variants_detailed?.find(
        (entry) => entry.type.toLocaleLowerCase() === type,
      ) ?? detail.variants_detailed?.[0];
      const tcgplayerProductId =
        variant?.thirdParty?.tcgplayer ?? detail.thirdParty?.tcgplayer;
      const points = tcgplayerProductId
        ? await fetch(
            `https://mpapi.tcgplayer.com/v2/product/${tcgplayerProductId}/pricepoints`,
          )
            .then((response) => (response.ok ? response.json() : []))
            .catch(() => [])
        : [];
      const printing = type === "holo" || type === "reverse" ? "Foil" : "Normal";
      const tcgplayerPrice = points.find(
        (point) => point.printingType === printing && point.marketPrice > 0,
      )?.marketPrice;
      audit.push({
        name: copy.name,
        id: copy.cardId,
        set: copy.setName,
        variant: type,
        cardmarket: detail.pricing?.cardmarket?.trend > 0,
        tcgplayer: Boolean(tcgplayerPrice),
        tcgplayerProductId: tcgplayerProductId ?? null,
        pricePoints: points.map((point) => ({
          printingType: point.printingType,
          marketPrice: point.marketPrice,
        })),
      });
    } catch (error) {
      audit.push({
        name: copy.name,
        id: copy.cardId,
        set: copy.setName,
        cardmarket: false,
        tcgplayer: false,
        reason: String(error),
      });
    }
  }
};

await Promise.all(Array.from({ length: 8 }, worker));
const missingBoth = audit.filter((item) => !item.cardmarket && !item.tcgplayer);
const missingCardmarket = audit.filter((item) => !item.cardmarket);
const missingTcgplayer = audit.filter((item) => !item.tcgplayer);

console.log(
  JSON.stringify(
    {
      cards: audit.length,
      missingBoth: missingBoth.length,
      missingCardmarket: missingCardmarket.length,
      missingTcgplayerCount: missingTcgplayer.length,
      missingBoth: missingBoth.map(({ name, set, id, variant, reason }) => ({
        name,
        set,
        id,
        variant,
        reason,
      })),
      missingTcgplayer: missingTcgplayer.slice(0, 40).map(
        ({ name, set, id, variant, tcgplayerProductId, pricePoints }) => ({
          name,
          set,
          id,
          variant,
          tcgplayerProductId,
          pricePoints,
        }),
      ),
    },
    null,
    2,
  ),
);
