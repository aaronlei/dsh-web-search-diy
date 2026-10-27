/**
 * Client-half constants: the loader id, the locale namespace and the two host
 * endpoints this card talks to.
 */
/** Stable plugin id, stamped into the loader handoff. */
export const ID = "dsh-web-search-diy";
/** Locale namespace for this card's strings. */
export const NS = "dshWebSearchDiy";
/** Config endpoint the host half serves. */
export const CONFIG_URL = "/api/web-search-diy/config";
/** Endpoint for one dry-run search with the staged draft. */
export const TEST_URL = "/api/web-search-diy/test";
