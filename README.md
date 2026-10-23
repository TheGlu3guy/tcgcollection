# TCG Collection

A local-first Pokémon TCG collection tracker inspired by TCG Collector. It indexes the multilingual card catalog exposed by [TCGdex](https://tcgdex.dev), then keeps your collection, wishlist, custom lists, notes, and preferences in your browser.

## Features

- Multilingual search across every card record currently exposed by TCGdex in English, French, German, Spanish, Italian, Portuguese, Japanese, Chinese, Indonesian, and Thai.
- Searchable artist filtering backed by the TCGdex illustrator index.
- Physical Pokémon TCG catalog only; digital-exclusive Pokémon TCG Pocket sets are excluded.
- One deduplicated view per card print, with an **All languages** display mode that prefers English and falls back to another available translation.
- A per-card language switcher in the card detail view and a persistent global display-language preference.
- Card thumbnails with lazy loading, plus a TCGplayer product-image fallback for records where TCGdex does not publish an image.
- Separate clickable TCGplayer and Cardmarket listings beneath card tiles and list rows, with an empty marker when a quote is unavailable.
- Cardmarket links open filtered to English and French listings in Light Played condition or better.
- Live card details, attacks, abilities, legality, illustrator, and current Cardmarket/TCGplayer estimates when available.
- Collection quantities with condition and variant tracking, plus per-card notes.
- Wishlist, custom lists, list colors/descriptions, and CSV export.
- Cards can be filtered by collection state and by Wishlist or any custom list.
- Collection dashboard, set completion, language breakdown, estimated value, and Pokédex species progress.
- IndexedDB catalog cache for fast repeat visits and one-click catalog sync.
- JSON backup/export and import for moving personal data between browsers.
- Optional Supabase email/password accounts with automatic private cloud sync across devices.
- Responsive desktop and mobile layouts.
- Automatic GitHub Pages deployment.

## Run locally

```bash
npm install
npm run dev
```

Open the local URL printed by Vite. The first catalog sync fetches all supported regional card indexes and may take a few seconds. Later visits use the cached IndexedDB catalog for up to seven days.

## Cloud sync setup

Cloud sync uses Supabase Auth and one private collection row per authenticated user.

1. Create a Supabase project.
2. Open **SQL Editor**, paste the contents of [`supabase/schema.sql`](supabase/schema.sql), and run it once. This creates the collection table, Row Level Security policies, and conflict-aware save function.
3. In **Project Settings → API**, copy the Project URL and publishable/anon key.
4. Create `.env.local` from `.env.example` and fill in:

   ```env
   VITE_SUPABASE_URL=https://YOUR-PROJECT-REF.supabase.co
   VITE_SUPABASE_ANON_KEY=YOUR-PUBLISHABLE-OR-ANON-KEY
   ```

5. Restart `npm run dev`, open **Backup & settings → Cloud account**, and create an account.
6. Deploy the card-price connector once so TCGplayer quotes can be retrieved by exact product ID:

   ```bash
   npx supabase login
   npx supabase link --project-ref pfojujdqnnqqxunrtjgz
   npx supabase functions deploy card-prices
   ```

In **Authentication → URL Configuration**, use the deployed site as the Site URL and allow
these redirect patterns so confirmation and password-reset emails work in both environments:

```text
http://127.0.0.1:5173/**
http://localhost:5173/**
https://theglu3guy.github.io/tcgcollection/**
```

Never place the database password or a Supabase `service_role`/secret key in a Vite environment variable. Only the public publishable/anon key belongs in the browser.

The account flow supports email/password sign-in, email confirmation, password reset, sign-out, automatic save after changes, manual sync, and conflict merging. Once signed in on another phone or computer, it loads that account's cloud collection automatically.

For this personal repository, the GitHub Pages workflow already passes this project's public URL and publishable key into the production build. Both values are safe to expose to browser clients because all data access is protected by Row Level Security. Never commit the database password or a secret/service-role key.

Production build:

```bash
npm run build
npm run preview
```

Tests:

```bash
npm test
```

## Install as an app

The production build is an installable progressive web app. It includes a standalone
web app manifest, 192px and 512px icons, iOS home-screen metadata, and a service worker
that caches the application shell for offline launch.

- **Android / Chromium:** open **Backup & settings → Install app**, or use the browser's
  **Install app** menu action.
- **iPhone / iPad:** open the Share menu and choose **Add to Home Screen**.
- Your collection still synchronizes through Supabase after installation. Offline card
  data remains available from the app's existing IndexedDB and price caches.

## Data and privacy

The app remains usable without an account. Personal data then lives only in browser `localStorage`; the catalog cache lives in IndexedDB. Clearing site data removes local personal data unless you exported a JSON backup.

When cloud sync is configured and you sign in, the complete collection, wishlist, custom lists, notes, and preferences are stored in your private Supabase row. Catalog images and metadata still come from TCGdex, and the catalog itself remains a local cache rather than being copied into your account.

TCGdex currently omits most TCGplayer pricing fields even when it supplies a correct TCGplayer product ID. The `card-prices` Supabase function resolves those IDs against TCGplayer's public product price point endpoint and accepts batches of up to 100 IDs. If the function is unavailable, the app continues safely and shows `—` rather than substituting a different printing's price.

Card metadata and images are provided by TCGdex. This is an unofficial fan project and is not affiliated with The Pokémon Company, Nintendo, Creatures, Game Freak, or Wizards of the Coast.

## Scope notes

The catalog includes every regional card record TCGdex currently exposes. The upstream service does not publish a usable image for every obscure record, and its list endpoints do not split every historical print variant into a separate record. The app therefore tracks variant, condition, language, and quantity on top of each card record. Exact parity with TCG Collector's proprietary regional/variant curation would require its own licensed data feed.

## GitHub Pages

The workflow in `.github/workflows/deploy.yml` builds and deploys the site whenever `main` is updated. In the GitHub repository, set **Settings → Pages → Build and deployment → Source** to **GitHub Actions** once. Routing uses URL hashes, so deep links work on GitHub Pages without server-side rewrite rules.
