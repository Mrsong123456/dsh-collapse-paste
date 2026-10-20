/**
 * Browser half — the collapse-chip stylesheet.
 *
 * The pill's face mirrors the composer's own `@` reference chip face
 * (`ReferenceChip.module.css`, inlined in `dsh-client-ui-conversation`'s
 * bundle) property for property, so a collapsed run reads in-line exactly
 * like a file reference: 22px inline-flex pill, 6px radius,
 * `--dsw-alias-interactive-bg-hover` fill, business-primary text,
 * `0 6px` padding, 3px icon/label gap, 240px cap, `vertical-align:
 * bottom`, non-selectable, default cursor. The icon slot and ellipsized
 * label rules copy `yAWgPa_icon`/`yAWgPa_label` verbatim; the chevron
 * rotation per expanded state is the only plugin-side motion.
 *
 * The old floating-badge rules (`cm-badge` body portal + one-line clamp,
 * `cm-p`/`--cm-line`) are gone with the DOM design.
 *
 * The sheet travels as a TS string (no CSS-modules hashing: the DOM
 * checks must read the literal rule names).
 */
import { PLUGIN_ID } from "../plugin-meta.js";

/** The chip rules, as one string. */
export const COMPOSER_CSS =
    ".cm-chip{vertical-align:bottom;background:var(--dsw-alias-interactive-bg-hover);max-width:240px;height:22px;color:var(--dsw-alias-state-business-primary);user-select:none;cursor:default;border-radius:6px;align-items:center;gap:3px;padding:0 6px;line-height:22px;display:inline-flex}" +
    ".cm-chip-icon{flex:none;display:inline-flex;align-items:center;transition:transform .12s ease}" +
    ".cm-chip-label{text-overflow:ellipsis;white-space:nowrap;overflow:hidden}" +
    ".cm-chip.cm-expanded .cm-chip-icon{transform:rotate(90deg)}";

/** Style-tag identity: stable across reloads, unique per document. */
const TAG_ID = `${PLUGIN_ID}/composer.css`;

/** Ensure the sheet exists in this document; a no-op without a DOM. */
export function ensureComposerStyles(): void {
    if (typeof document === "undefined") return;
    if (document.querySelector(`style[data-plugin-css="${TAG_ID}"]`) !== null) return;
    const tag = document.createElement("style");
    tag.dataset.plugin = PLUGIN_ID;
    tag.dataset.pluginCss = TAG_ID;
    tag.textContent = COMPOSER_CSS;
    document.head.appendChild(tag);
}
