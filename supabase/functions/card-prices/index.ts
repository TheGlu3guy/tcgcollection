const TCGPLAYER_PRICE_URL =
  "https://mpapi.tcgplayer.com/v2/product";
const CORS_HEADERS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

interface PricePoint {
  printingType: string;
  marketPrice: number | null;
  listedMedianPrice: number | null;
}

interface PriceRequest {
  productIds?: unknown;
}

function json(status: number, body: unknown): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: {
      ...CORS_HEADERS,
      "Content-Type": "application/json",
      "Cache-Control": "public, max-age=900",
    },
  });
}

Deno.serve(async (request) => {
  if (request.method === "OPTIONS") {
    return new Response("ok", { headers: CORS_HEADERS });
  }
  if (request.method !== "POST") {
    return json(405, { error: "POST required" });
  }

  let payload: PriceRequest;
  try {
    payload = await request.json();
  } catch {
    return json(400, { error: "Invalid JSON body" });
  }

  const productIds = [
    ...new Set(
      (Array.isArray(payload.productIds) ? payload.productIds : [])
        .map(Number)
        .filter((id) => Number.isSafeInteger(id) && id > 0),
    ),
  ].slice(0, 100);
  if (!productIds.length) return json(400, { error: "No valid product IDs" });

  const prices = (
    await Promise.all(
      productIds.map(async (productId) => {
        try {
          const response = await fetch(
            `${TCGPLAYER_PRICE_URL}/${productId}/pricepoints`,
          );
          if (!response.ok) return [];
          const points = (await response.json()) as PricePoint[];
          return points.map((point) => ({
            productId,
            printingType: point.printingType,
            marketPrice:
              typeof point.marketPrice === "number" && point.marketPrice > 0
                ? point.marketPrice
                : null,
            listedMedianPrice:
              typeof point.listedMedianPrice === "number" &&
              point.listedMedianPrice > 0
                ? point.listedMedianPrice
                : null,
          }));
        } catch {
          return [];
        }
      }),
    )
  ).flat();

  return json(200, { prices });
});
