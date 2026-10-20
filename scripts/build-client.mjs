/**
 * Build the browser half with esbuild.
 *
 * The shell's client manifest fetches exactly ONE script per bundle
 * (`/plugins/<id>/client.js`), loaded as a plain `<script>` — no import
 * graph, no `type="module"`, nothing behind a second URL. So the browser
 * half can be ordinary modules at source level but must collapse into one
 * CJS-shaped factory body at emit time, requiring only the ids the shell
 * seeds into its module table.
 *
 * Two steps, mirroring the host half's separation of check and emit:
 *
 *   1. `tsc -p src/client/tsconfig.json` typechecks the browser modules (no
 *      emit) — their imports resolve against the structural views in
 *      `src/client/shell-modules.d.ts` plus the DOM lib;
 *   2. this script runs esbuild over `src/client/index.ts`: bundle, CJS
 *      output, `platform: "neutral"` (no Node or DOM globals assumed), the
 *      baseline ids kept external, and an external source map so the emitted
 *      bundle is debuggable back to `src/client/*.ts` (and `src/core.ts`,
 *      whose functions the bundle inlines — there is no embedded copy).
 *
 * One deviation from the reference build stays visible here: the reference
 * inlines `*.module.css` files through a CSS-modules plugin. This plugin's
 * DOM checks are structural — the collapse rules target `[data-composer-
 * input] > div` children directly and the badge is portaled to
 * `document.body` — so hashing the class names would break the injected-CSS
 * contract. The sheets therefore travel as TS strings under
 * `src/client/styles/`, injected DOM-checked per document.
 *
 * The bundle's shape is the loader's contract, not esbuild's: the factory
 * prologue/epilogue is supplied through esbuild's `banner`/`footer`, so the
 * generated body sits inside
 * `window.__ModuleLoader__.load({ id, factory: (require) => … })` exactly as
 * every other plugin's emitted half does.
 */
import { build } from "esbuild";
import { readFile } from "node:fs/promises";

const ROOT = new URL("../", import.meta.url);
const pkg = JSON.parse(await readFile(new URL("package.json", ROOT), "utf8"));

/**
 * Modules the shell seeds into `window.__ModuleLoader__` before this bundle
 * runs. They must stay external: bundling them would either duplicate the
 * shell's own copies (two Reacts) or, in the case of the `dsh-client-*`
 * packages, try to resolve ids that exist only inside the running GUI.
 */
const BASELINE_MODULES = [
    "react",
    "react/jsx-runtime",
    "@deepseek-ai/dsh-client-store",
    "@deepseek-ai/dsh-client-ui-primitives"
];

await build({
    entryPoints: ["src/client/index.ts"],
    outfile: "lib/client.js",
    bundle: true,
    format: "cjs",
    platform: "neutral",
    target: "es2022",
    external: BASELINE_MODULES,
    sourcemap: "linked",
    sourcesContent: true,
    // The tsconfig is pinned instead of discovered. esbuild would otherwise
    // walk up from the entry and pick up `src/client/tsconfig.json` (the
    // browser half's own editor config), whose `strict: false` silently drops
    // the CJS bundle's `"use strict"` directive: the emitted factory body
    // would run sloppy instead of strict, a difference no test catches.
    // Stating it here keeps strictness a property of THIS bundle, independent
    // of whichever config the editor happens to read.
    tsconfigRaw: { compilerOptions: { strict: true } },
    banner: {
        js: [
            "window.__ModuleLoader__.load({",
            `\tid: ${JSON.stringify(pkg.name)},`,
            "\tfactory: (require) => {",
            "\t\tvar module = { exports: {} };",
            "\t\tvar exports = module.exports;",
            '\t\tObject.defineProperty(exports, Symbol.toStringTag, { value: "Module" });'
        ].join("\n")
    },
    footer: {
        js: ["\treturn module.exports;", "\t}", "});"].join("\n")
    }
});
