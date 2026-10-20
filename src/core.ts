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
export const PUA_RE = /[\uE100-\uE11D\uFFFC]/gu;

/** Strip the same PUA placeholders DSH strips on paste. */
export function sanitize(text: string): string {
    return text.replace(PUA_RE, "");
}

/** Number of lines in a text ("" → 0, "a" → 1, "a\nb" → 2). */
export function countLines(text: string): number {
    if (text === "") return 0;
    return text.split("\n").length;
}

/** Whether pasted text crosses both collapse thresholds. */
export function meetsThreshold(text: string, config: { minLines: number; minChars: number }): boolean {
    return countLines(text) >= config.minLines && text.length >= config.minChars;
}

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
export function diffPaste(prev: string, next: string): PasteDiff {
    const min = Math.min(prev.length, next.length);
    let p = 0;
    while (p < min && prev.charCodeAt(p) === next.charCodeAt(p)) p += 1;
    let s = 0;
    const maxSuffix = Math.min(prev.length - p, next.length - p);
    while (s < maxSuffix && prev.charCodeAt(prev.length - 1 - s) === next.charCodeAt(next.length - 1 - s)) s += 1;
    return {
        start: p,
        removed: prev.slice(p, prev.length - s),
        inserted: next.slice(p, next.length - s)
    };
}

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
export function locateLeaves(texts: string[], start: number, length: number): LeafSpan | null {
    if (length <= 0 || start < 0) return null;
    const end = start + length;
    let pos = 0;
    let first = -1;
    let last = -1;
    let startOffset = 0;
    let endOffset = 0;
    for (let i = 0; i < texts.length; i++) {
        const len = texts[i].length;
        if (len > 0) {
            const leafEnd = pos + len;
            if (first === -1 && leafEnd > start) {
                first = i;
                startOffset = start - pos;
            }
            if (first !== -1 && leafEnd >= end) {
                last = i;
                endOffset = end - pos;
                break;
            }
            if (first !== -1) last = i;
        }
        pos += len;
    }
    if (first === -1) return null;
    if (last === -1) last = first;
    return { first, last, startOffset, endOffset };
}
