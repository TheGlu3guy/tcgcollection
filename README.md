# TCG Collection

A local-first Pokémon TCG collection tracker inspired by TCG Collector. It indexes the multilingual card catalog exposed by [TCGdex](https://tcgdex.dev), then keeps your collection, wishlist, custom lists, notes, and preferences in your browser.

## Features

- Multilingual search across every card record currently exposed by TCGdex in English, French, German, Spanish, Italian, Portuguese, Japanese, Chinese, Indonesian, and Thai.
- Card thumbnails with lazy loading and a fallback for records where the upstream image is unavailable.
- Live card details, attacks, abilities, legality, illustrator, and current Cardmarket/TCGplayer estimates when available.
- Collection quantities with condition and variant tracking, plus per-card notes.
- Wishlist, custom lists, list colors/descriptions, and CSV export.
- Collection dashboard, set completion, language breakdown, estimated value, and Pokédex species progress.
- IndexedDB catalog cache for fast repeat visits and one-click catalog sync.
- JSON backup/export and import for moving personal data between browsers.
- Responsive desktop and mobile layouts.
- Automatic GitHub Pages deployment.

## Run locally

```bash
npm install
npm run dev
```

Open the local URL printed by Vite. The first catalog sync fetches all supported regional card indexes and may take a few seconds. Later visits use the cached IndexedDB catalog for up to seven days.

Production build:

```bash
npm run build
npm run preview
```

Tests:

```bash
npm test
```

## Data and privacy

No API key, account, server database, or analytics service is required. Personal data lives in browser `localStorage`; the catalog cache lives in IndexedDB. Clearing site data removes personal data unless you exported a JSON backup.

Card metadata and images are provided by TCGdex. This is an unofficial fan project and is not affiliated with The Pokémon Company, Nintendo, Creatures, Game Freak, or Wizards of the Coast.

## Scope notes

The catalog includes every regional card record TCGdex currently exposes. The upstream service does not publish a usable image for every obscure record, and its list endpoints do not split every historical print variant into a separate record. The app therefore tracks variant, condition, language, and quantity on top of each card record. Exact parity with TCG Collector's proprietary regional/variant curation would require its own licensed data feed.

## GitHub Pages

The workflow in `.github/workflows/deploy.yml` builds and deploys the site whenever `main` is updated. In the GitHub repository, set **Settings → Pages → Build and deployment → Source** to **GitHub Actions** once. Routing uses URL hashes, so deep links work on GitHub Pages without server-side rewrite rules.
