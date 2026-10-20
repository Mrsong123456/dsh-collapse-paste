/**
 * Browser half — the locale surface.
 *
 * The `collapseMultiline` namespace is registered from this table; the
 * dictionary is keyed by tag (`en`, `zh`), exactly what `ctx.locale.register`
 * takes.
 */
import { en } from "./en-US.js";
import { zh } from "./zh-CN.js";

export const DICTIONARIES: Record<string, Record<string, string>> = { en, zh };
