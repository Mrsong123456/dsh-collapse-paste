/**
 * dsh-collapse-paste — host half, public surface.
 *
 * Collapse multiline paste: a multiline paste in the Web composer collapses
 * to an inline `X chars / Y lines` pill that rides the draft exactly like an
 * `@file` reference chip. Click the pill to expand/re-collapse the block;
 * the full text is sent to the model unchanged. Long sent messages fold in
 * the transcript as well.
 *
 * The whole feature lives browser-side (the emitted `lib/client.js`). This
 * half exists only so the package resolves as a DSH bundle and the
 * `dsh.client` declaration is discovered.
 */
export { inject, name } from "./host/plugin-meta.js";
export { PLUGIN_ID, PLUGIN_NAME } from "./host/constants.js";
export { apply } from "./host/apply.js";
//# sourceMappingURL=index.d.ts.map