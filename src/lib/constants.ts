import type {
  AppData,
  CardFilters,
  LanguageCode,
  LanguageDefinition,
} from "../types";

export const LANGUAGES: LanguageDefinition[] = [
  { code: "en", label: "English", shortLabel: "EN", region: "International", flag: "🇬🇧" },
  { code: "fr", label: "French", shortLabel: "FR", region: "International", flag: "🇫🇷" },
  { code: "de", label: "German", shortLabel: "DE", region: "International", flag: "🇩🇪" },
  { code: "es", label: "Spanish", shortLabel: "ES", region: "International", flag: "🇪🇸" },
  { code: "it", label: "Italian", shortLabel: "IT", region: "International", flag: "🇮🇹" },
  { code: "pt", label: "Portuguese", shortLabel: "PT", region: "International", flag: "🇧🇷" },
  { code: "ja", label: "Japanese", shortLabel: "JA", region: "Japan", flag: "🇯🇵" },
  { code: "zh-tw", label: "Chinese (Traditional)", shortLabel: "繁中", region: "China", flag: "🇹🇼" },
  { code: "zh-cn", label: "Chinese (Simplified)", shortLabel: "简中", region: "China", flag: "🇨🇳" },
  { code: "id", label: "Indonesian", shortLabel: "ID", region: "Indonesia", flag: "🇮🇩" },
  { code: "th", label: "Thai", shortLabel: "TH", region: "Thailand", flag: "🇹🇭" },
];

export const LANGUAGE_BY_CODE = Object.fromEntries(
  LANGUAGES.map((language) => [language.code, language]),
) as Record<LanguageCode, LanguageDefinition>;

export const REGIONS = ["International", "Japan", "China", "Indonesia", "Thailand"] as const;

export const DEFAULT_FILTERS: CardFilters = {
  query: "",
  region: "all",
  language: "all",
  setId: "all",
  status: "all",
  sort: "release-new",
};

export const DEFAULT_APP_DATA: AppData = {
  schemaVersion: 1,
  collection: [],
  wishlist: [],
  lists: [],
  notes: {},
  preferences: {
    defaultCondition: "Near Mint",
    defaultVariant: "Unspecified",
    showMissingImages: true,
    collectionValueCurrency: "EUR",
  },
};

export const CONDITIONS = [
  "Near Mint",
  "Lightly Played",
  "Moderately Played",
  "Heavily Played",
  "Damaged",
  "Sealed",
];

export const VARIANTS = [
  "Unspecified",
  "Normal",
  "Holo",
  "Reverse Holo",
  "First Edition",
  "Promo",
  "Special",
];

export const LIST_COLORS = ["#ef6a3a", "#5d8bff", "#34a67a", "#e6ab36", "#a56de2", "#ef5d8d"];

export const GENERATIONS = [
  { id: 1, roman: "I", name: "Kanto", start: 1, end: 151, accent: "#e85f35" },
  { id: 2, roman: "II", name: "Johto", start: 152, end: 251, accent: "#d9a526" },
  { id: 3, roman: "III", name: "Hoenn", start: 252, end: 386, accent: "#37a273" },
  { id: 4, roman: "IV", name: "Sinnoh", start: 387, end: 493, accent: "#4e78c4" },
  { id: 5, roman: "V", name: "Unova", start: 494, end: 649, accent: "#67717c" },
  { id: 6, roman: "VI", name: "Kalos", start: 650, end: 721, accent: "#de5672" },
  { id: 7, roman: "VII", name: "Alola", start: 722, end: 809, accent: "#8b67c7" },
  { id: 8, roman: "VIII", name: "Galar", start: 810, end: 905, accent: "#c8544f" },
  { id: 9, roman: "IX", name: "Paldea", start: 906, end: 1025, accent: "#35a7b8" },
];

export const CATALOG_VERSION = 4;
export const CATALOG_CACHE_KEY = "tcgcollection-catalog-v4";
export const APP_STORAGE_KEY = "tcgcollection-personal-v1";
