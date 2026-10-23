export type LanguageCode =
  | "en"
  | "fr"
  | "de"
  | "es"
  | "it"
  | "pt"
  | "ja"
  | "zh-tw"
  | "zh-cn"
  | "id"
  | "th";

export type Region = "International" | "Japan" | "China" | "Indonesia" | "Thailand";

export interface LanguageDefinition {
  code: LanguageCode;
  label: string;
  shortLabel: string;
  region: Region;
  flag: string;
}

export interface RawCardSummary {
  id: string;
  localId?: string;
  name: string;
  image?: string;
}

export interface RawSetCount {
  official?: number;
  total?: number;
  normal?: number;
  holo?: number;
  reverse?: number;
}

export interface RawSet {
  id: string;
  name: string;
  logo?: string;
  symbol?: string;
  cardCount?: RawSetCount;
  releaseDate?: string;
  serie?: { id: string; name: string };
  abbreviation?: { official?: string };
  tcgOnline?: string;
}

export interface CatalogSet {
  key: string;
  id: string;
  name: string;
  language: LanguageCode;
  languageLabel: string;
  region: Region;
  logo?: string;
  symbol?: string;
  total: number;
  official: number;
  releaseDate?: string;
  series: string;
  seriesId: string;
  abbreviation?: string;
}

export interface CatalogCard {
  key: string;
  groupKey: string;
  id: string;
  localId: string;
  name: string;
  searchName: string;
  image?: string;
  language: LanguageCode;
  languageLabel: string;
  region: Region;
  setId: string;
  setName: string;
  setAbbreviation?: string;
  setLogo?: string;
  setReleaseDate?: string;
  setSeries: string;
  setTotal: number;
  artist?: string;
  ambiguousCardmarketProduct?: boolean;
}

export interface Catalog {
  version: number;
  fetchedAt: string;
  cards: CatalogCard[];
  sets: CatalogSet[];
  artists: string[];
  failedLanguages: { language: LanguageCode; message: string }[];
}

export type SearchStatus = "all" | "collection" | "not-collection";
export type CardSort =
  | "release-new"
  | "release-old"
  | "name-asc"
  | "name-desc"
  | "number-asc"
  | "set-asc"
  | "price-desc"
  | "price-asc";
export type CardView = "grid" | "list";

export interface CardFilters {
  query: string;
  region: "all" | Region;
  language: "all" | LanguageCode;
  setId: "all" | string;
  artist: string;
  status: SearchStatus;
  listId: "all" | "wishlist" | string;
  sort: CardSort;
}

export interface CardCopy {
  id: string;
  cardKey: string;
  cardId: string;
  language: LanguageCode;
  name: string;
  image?: string;
  setId: string;
  setName: string;
  quantity: number;
  condition: string;
  variant: string;
  purchasePrice?: number;
  marketPrice?: number;
  currency: string;
  notes: string;
  addedAt: string;
  updatedAt: string;
  types?: string[];
  dexIds?: number[];
  rarity?: string;
}

export interface CardList {
  id: string;
  name: string;
  description: string;
  color: string;
  cardKeys: string[];
  createdAt: string;
  updatedAt: string;
}

export interface AppPreferences {
  defaultCondition: string;
  defaultVariant: string;
  catalogLanguage: "all" | LanguageCode;
  showMissingImages: boolean;
  collectionValueCurrency: string;
}

export interface AppData {
  schemaVersion: number;
  collection: CardCopy[];
  wishlist: string[];
  lists: CardList[];
  notes: Record<string, string>;
  preferences: AppPreferences;
}

export interface Attack {
  name: string;
  cost?: string[];
  damage?: string | number;
  effect?: string;
}

export interface Ability {
  name: string;
  effect?: string;
  type?: string;
}

export interface PriceSnapshot {
  amount: number;
  currency: string;
  source: string;
  url?: string;
  updatedAt?: string;
  variant?: string;
}

export interface MarketPrices {
  tcgplayer: PriceSnapshot | null;
  cardmarket: PriceSnapshot | null;
  tcgplayerUrl?: string;
  tcgplayerProductId?: number;
  cardmarketUrl?: string;
  imageUrl?: string;
  marketVariant?: string;
}

export interface CardDetail {
  id: string;
  localId?: string;
  name: string;
  image?: string;
  category?: string;
  rarity?: string;
  illustrator?: string;
  hp?: number;
  types?: string[];
  stage?: string;
  dexId?: number[];
  description?: string;
  attacks?: Attack[];
  abilities?: Ability[];
  weaknesses?: { type: string; value: string }[];
  resistances?: { type: string; value: string }[];
  retreat?: number;
  regulationMark?: string;
  legal?: Record<string, boolean>;
  variants?: Record<string, boolean>;
  thirdParty?: {
    cardmarket?: number;
    tcgplayer?: number;
    cardtrader?: number;
  };
  pricing?: {
    cardmarket?: {
      unit?: string;
      idProduct?: number;
      trend?: number;
      avg?: number;
      low?: number;
      updated?: string;
      "trend-holo"?: number;
      "avg-holo"?: number;
      "low-holo"?: number;
    } | null;
    tcgplayer?: {
      unit?: string;
      updated?: string;
      normal?: { productId?: number; marketPrice?: number; lowPrice?: number };
      holofoil?: { productId?: number; marketPrice?: number; lowPrice?: number };
      "reverse-holofoil"?: { productId?: number; marketPrice?: number; lowPrice?: number };
      unlimited?: { productId?: number; marketPrice?: number; lowPrice?: number };
      "1st-edition"?: { productId?: number; marketPrice?: number; lowPrice?: number };
    } | null;
  };
  variants_detailed?: Array<{
    type: string;
    thirdParty?: { cardmarket?: number; tcgplayer?: number };
    pricing?: CardDetail["pricing"];
  }>;
}

export type PageName = "dashboard" | "cards" | "sets" | "lists" | "pokedex" | "scan";
