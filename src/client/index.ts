/**
 * The public surface of the BROWSER half — re-export only; it decides
 * nothing.
 *
 * `apply` mounts every piece (locale dictionaries, the composer DOM engine,
 * the settings card and both stylesheets); `inject` is the service list the
 * shell must resolve before `apply` runs.
 */
export { apply } from "./apply.js";
export { inject } from "./plugin-meta.js";
