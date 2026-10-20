/**
 * @comecaramelos/dsh-collapse-multiline-paste — pure core.
 *
 * DOM-independent helpers shared by both emitted halves:
 *
 * - the HOST build (this file also compiles to `lib/core.js` for the node
 *   tests in `test/core.test.mjs`);
 * - the BROWSER bundle: `src/client/engine/*` imports these functions
 *   directly and `scripts/build-client.mjs` inlines them into
 *   `lib/client.js` (esbuild, one bundle, no import graph).
 *
 * One source of truth: there is no embedded copy to keep in step any more,
 * so both halves run byte-identical logic by construction.
 *
 * Keep this module dependency-free: no DOM, no browser globals, no imports.
 *
 * @module src/core
 */
/** Private-use placeholders DSH's facade.paste strips before insertion. */
export declare const PUA_RE: RegExp;
/** Strip the same PUA placeholders DSH strips on paste. */
export declare function sanitize(text: string): string;
/** Number of lines in a text ("" → 0, "a" → 1, "a\nb" → 2). */
export declare function countLines(text: string): number;
/** Whether pasted text crosses both collapse thresholds. */
export declare function meetsThreshold(text: string, config: {
    minLines: number;
    minChars: number;
}): boolean;
/** One edit decomposed into the maximal common prefix and the two slices. */
export interface PasteDiff {
    /** Offset of the common prefix A's end (= the insertion/removal start). */
    start: number;
    /** The removed slice ("" for a pure insertion). */
    removed: string;
    /** The inserted slice. */
    inserted: string;
}
/** A flat insertion: its offset plus the inserted text. */
export interface Insertion {
    start: number;
    text: string;
}
/**
 * Split one edit between two flat draft snapshots into the maximal common
 * prefix A, the removed slice R and the inserted slice I:
 * prev = A + R + B, next = A + I + B (B = maximal common suffix). A paste is
 * a pure insertion (R = "") or a selection-replacement (R = the selection).
 * The decomposition is total: every pair splits, with I or R possibly "".
 *
 * @param prev - flat text before the edit.
 * @param next - flat text after the edit.
 * @returns offset of A's end + the two slices.
 */
export declare function diffPaste(prev: string, next: string): PasteDiff;
/** A flat insertion located across a sequence of contributed leaf texts. */
export interface LeafSpan {
    /** Index of the first overlapping leaf. */
    first: number;
    /** Index of the last overlapping leaf. */
    last: number;
    /** Local offset where the range starts inside the first leaf. */
    startOffset: number;
    /** Local offset where the range ends inside the last leaf. */
    endOffset: number;
}
/**
 * Map one flat insertion onto a sequence of leaf texts (the ordered,
 * contributed text of every document leaf — a chip marker contributes ""
 * and lands nowhere). Zero-length leaves never span a range, so an
 * insertion landing exactly on a leaf boundary belongs to the leaf that
 * FOLLOWS (offset 0), never a previous empty one.
 *
 * @param texts - leaf texts in document order.
 * @param start - flat offset of the insertion start.
 * @param length - inserted text length.
 * @returns the leaf span + local offsets, or null when nothing overlaps.
 */
export declare function locateLeaves(texts: string[], start: number, length: number): LeafSpan | null;
/** The complete browser-side settings shape, every field defaulting. */
export interface CollapseConfig {
    /** Master switch for the composer fold. */
    active: boolean;
    /** Minimum pasted lines that collapse in the composer. */
    minLines: number;
    /** Extra character floor for the composer fold (0 = lines only). */
    minChars: number;
    /** Whether long sent messages fold in the transcript. */
    foldSent: boolean;
    /** Transcript fold: minimum message characters. */
    sentMinChars: number;
    /** Transcript fold: minimum message lines. */
    sentMinLines: number;
}
/** Defaults, also used by "Reset to defaults". */
export declare const DEFAULT_COLLAPSE_CONFIG: CollapseConfig;
/** Clamp booleans and numbers into the complete shape. */
export declare function normalizeCollapseConfig(value: Partial<CollapseConfig> | null | undefined): CollapseConfig;
//# sourceMappingURL=core.d.ts.map