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
  setLogo?: string;
  setReleaseDate?: string;
  setSeries: string;
  setTotal: number;
}

export interface Catalog {
  version: number;
  fetchedAt: string;
  cards: CatalogCard[];
  sets: CatalogSet[];
  failedLanguages: { language: LanguageCode; message: string }[];
}

export type SearchStatus = "all" | "collection" | "wishlist";
export type CardSort =
  | "release-new"
  | "release-old"
  | "name-asc"
  | "name-desc"
  | "number-asc"
  | "set-asc";
export type CardView = "grid" | "list";

export interface CardFilters {
  query: string;
  region: "all" | Region;
  language: "all" | LanguageCode;
  setId: "all" | string;
  status: SearchStatus;
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
  updatedAt?: string;
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
  pricing?: {
    cardmarket?: {
      unit?: string;
      trend?: number;
      avg?: number;
      low?: number;
      updated?: string;
    };
    tcgplayer?: {
      unit?: string;
      updated?: string;
      normal?: { marketPrice?: number; lowPrice?: number };
      holofoil?: { marketPrice?: number; lowPrice?: number };
      "reverse-holofoil"?: { marketPrice?: number; lowPrice?: number };
    };
  };
}

export type PageName = "dashboard" | "cards" | "sets" | "lists" | "pokedex";
