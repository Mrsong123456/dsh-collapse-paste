/**
 * The package version, inlined into the browser bundle at build time.
 *
 * Single source of truth: `package.json`. `tsc` resolves the JSON for the
 * typecheck and esbuild inlines it into `lib/client.js`, so a release bump
 * only touches one file (a hardcoded copy used to drift behind the package).
 */
import pkg from "../../package.json";

/** The plugin version reported by `window.__DSH_COLLAPSE_PASTE__`. */
export const VERSION: string = pkg.version;
