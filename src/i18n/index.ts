/** Language layer (UI-161). See README, "Languages". */
export { CATALOG, flatten, rawMessage, t, tEn, translator, type EnMessages, type MessageKey, type Namespace, type Translate } from "./catalog.ts";
export { interpolate, placeholderNames, splitTemplate } from "./format.ts";
export {
  LOCALE_KEY,
  applyDocumentLang,
  detectLocale,
  getLocale,
  getServerLocale,
  isLocale,
  readSavedLocale,
  reloadLocale,
  resolveLocale,
  saveLocale,
  setLocale,
  subscribeLocale,
} from "./locale.ts";
export { I18nProvider, richFor, useT, type I18n, type Rich } from "./react.tsx";
export { DEFAULT_LOCALE, LOCALES, type Locale, type Messages, type Paths, type RichVars, type Vars } from "./types.ts";
