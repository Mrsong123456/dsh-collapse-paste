/**
 * Engine half — the document collapse: an inline pill between the text.
 *
 * A multiline paste, once DSH's own paste pipeline has committed it, is
 * folded into an inline `cm-collapse` chip (see `chip.ts`) that sits in the
 * document between the surrounding text, exactly like the composer's `@`
 * reference. The pasted characters STAY in plain text leaves and are hidden
 * by a state-level `display:none` style; the chip carries no text, so
 * DSH's draft projection is byte-identical to stock — the text is simply
 * not shown until the pill is clicked.
 *
 * The plugin mutates Lexical state, but ONLY through the registered inline
 * chip marker and the visible/hidden style of text leaves that keep their
 * text. It never hand-writes the DOM inside the contenteditable root (that
 * the DOM→state observer absorbs and destroys the draft), and it never
 * consumes a paste. It only OBSERVES: a document-capture `paste` for the
 * clipboard text + the pre-edit baseline (read from committed state), and a
 * MutationObserver quiet window for the committed edit. Collapse happens
 * ONLY on a real paste (`pending` is set exclusively by the paste
 * listener); any internal error runs fail-open (stock composer, inert).
 */
import { diffPaste, locateLeaves, meetsThreshold, sanitize } from "../../core.js";
import { QUIET_MS, ROOT_SELECTOR } from "../constants.js";
import { badgeLabel, readConfig } from "./config.js";
import { CHIP_TYPE, ensureChipClass, setChipToggle, type ChipClass, type ChipEditor, type ChipNode } from "./chip.js";
import {
    docLeaves,
    documentText,
    hideLineBreak,
    hideNode,
    hideRange,
    isAttached,
    isHidden,
    isTextNode,
    selectAfter,
    showNode,
    stateOf,
    textClass,
    type DocEditor,
    type DocNode,
    type StateLike
} from "./doc.js";

/** A paste caught between the paste listener and the committed edit. */
interface PendingPaste {
    /** The flat document text before the edit. */
    baseline: string;
    /** The sanitized clipboard text. */
    clean: string;
}

/** One collapsed (or expanded) run: a chip marker + its hidden leaf keys. */
interface Region {
    /** Chip node key → the hidden run it marks. */
    chipKey: string;
    hiddenKeys: string[];
    /** The pasted text at creation time; staleness = edited. */
    text: string;
    collapsed: boolean;
    disposed: boolean;
}

/** The live document: attached root, resolved editor, live regions. */
const state = {
    disposed: false,
    failed: false,
    root: null as HTMLElement | null,
    editor: null as (ChipEditor & object) | null,
    chipClass: null as ChipClass | null,
    /** chip node key → region */
    regions: new Map<string, Region>(),
    pending: null as PendingPaste | null,
    quietTimer: null as ReturnType<typeof setTimeout> | null
};

/** Resolve the live editor + register the chip class once per root. */
function bindEditor(root: HTMLElement): boolean {
    if (state.editor !== null) return true;
    const maybe = (root as unknown as { __lexicalEditor?: ChipEditor & object }).__lexicalEditor;
    if (maybe === undefined || maybe === null) return false;
    if (typeof maybe.update !== "function" || typeof maybe._nodes !== "object") return false;
    const chipClass = ensureChipClass(maybe);
    if (chipClass === null) return false;
    state.editor = maybe;
    state.chipClass = chipClass;
    return true;
}

/** Commit one state-level mutation (discrete, like the composer's own
 *  paste/typing commits). All node writes — hide/show styles, field writes,
 *  chip insertion/removal — must run inside one; the live Lexical validates
 *  node access and the DOM→state observers stay quiet for the commit. */
function commitUpdate(editor: ChipEditor & object, callback: () => void): void {
    const target = editor as unknown as DocEditor;
    if (typeof target.update !== "function") return;
    // MUST be a member call, not a reference in a local var: the live
    // Lexical `update` reads `this._updating`; called bare it throws
    // "Cannot read properties of undefined".
    target.update(callback, { discrete: true });
}

/** The draft copy to write through (Lexical's `getWritable`; the live node
 *  itself where that accessor is absent, e.g. the node tests' stub). */
function writable(node: DocNode): DocNode {
    const get = node.getWritable;
    if (typeof get === "function") return (get.call(node) as DocNode) ?? node;
    return node;
}

/** One settled DOM: consume any pending paste, then reconcile the chips. */
function quiet(): void {
    state.quietTimer = null;
    if (state.disposed || state.failed) return;
    try {
        const root = state.root;
        if (root === null || !root.isConnected) {
            detachRoot();
            return;
        }
        if (state.editor === null && !bindEditor(root)) return;
        const editor = state.editor;
        if (editor === null) return;
        const state2 = stateOf(editor as DocEditor);
        if (state2 === null) return;

        const pending = state.pending;
        if (pending !== null) {
            state.pending = null;
            const config = readConfig();
            if (config !== null && config.active) {
                const current = documentText(state2);
                const diff = diffPaste(pending.baseline, current);
                if (diff.inserted !== "" && meetsThreshold(pending.clean, config)) {
                    collapse(editor, diff.start, diff.inserted);
                }
            }
        }
        reconcile(editor);
    } catch (error) {
        failOpen(error);
    }
}

/**
 * Fold one insertion into a collapsed chip. The WHOLE fold runs inside one
 * discrete commit: locate the leaf span the insertion lands across, fold
 * every live region it intersects (or merely touches) into the span, retire
 * those regions' chips, hide every leaf of the span, insert the inline chip
 * after the last hidden leaf, and place the caret just after the pill (so
 * continued typing lands in the text AFTER the pill).
 */
function collapse(editor: ChipEditor & object, start: number, inserted: string): void {
    const chipClass = state.chipClass;
    if (chipClass === null) return;
    commitUpdate(editor, () => {
        const st = stateOf(editor as DocEditor);
        if (st === null) return;

        // The leaf texts this run lands across (chips contribute "").
        const leaves = docLeaves(st);
        const texts: string[] = [];
        for (const leaf of leaves) texts.push(leaf.text);
        const insertedSpan = locateLeaves(texts, start, inserted.length);
        if (insertedSpan === null) return;
        // Text-coordinate extent of the new insertion.
        let runStart = start;
        let runEnd = start + inserted.length;

        // Fold every live region intersecting (or touching) the insertion
        // into the new chip: retire its marker and widen the run to the
        // UNION, so one contiguous run is ONE pill.
        const firstKeyOf = (node: DocNode): string => {
            const get = node.getKey;
            return typeof get === "function" ? (get.call(node) as string) : "";
        };
        const victims: Region[] = [];
        for (const region of Array.from(state.regions.values())) {
            if (region.disposed) continue;
            const keysSet = new Set(region.hiddenKeys);
            let regionStart = -1;
            let regionEnd = -1;
            let pos = 0;
            for (const leaf of leaves) {
                const here = leaf.node !== null && keysSet.has(firstKeyOf(leaf.node));
                if (here) {
                    if (regionStart === -1) regionStart = pos;
                    regionEnd = pos + leaf.text.length;
                }
                pos += leaf.text.length;
            }
            if (regionStart === -1) {
                victims.push(region); // its hidden leaves are gone: retire it
                continue;
            }
            // Touching counts: a run continues typing/appending right at its
            // edges, so one contiguous fold becomes ONE merged pill.
            if (regionEnd >= runStart && regionStart <= runEnd) {
                if (regionStart < runStart) runStart = regionStart;
                if (regionEnd > runEnd) runEnd = regionEnd;
                victims.push(region);
            }
        }

        // The run, expressed as a leaf span over the live document.
        const span = locateLeaves(texts, runStart, runEnd - runStart);
        if (span === null) return;

        // Retire the victims: their hidden leaves stay hidden (they fall
        // inside the widened span and are re-hidden, keys folded in) but
        // their markers go — the merged chip replaces them.
        for (const victim of victims) {
            const victimChip = st._nodeMap.get(victim.chipKey);
            if (victimChip !== undefined && typeof victimChip.remove === "function") (victimChip.remove as () => void)();
            destroyRegion(victim);
        }

        const hiddenKeys: string[] = [];
        let lastHidden: DocNode | null = null;
        for (let i = span.first; i <= span.last; i++) {
            const leaf = leaves[i];
            const node = leaf.node;
            const isLast = i === span.last;
            const localStart = i === span.first ? span.startOffset : 0;
            const localEnd = isLast ? span.endOffset : leaf.text.length;
            if (node === null) {
                // A block gap ("\n" owned by no node): the surrounding text
                // is hidden, so this is handled implicitly.
                continue;
            }
            if (node.__type === "linebreak") {
                const pieces = hideLineBreak(node, st);
                for (const piece of pieces) hiddenKeys.push(firstKeyOf(piece));
                if (pieces.length > 0) lastHidden = pieces[pieces.length - 1];
                continue;
            }
            if (!isTextNode(node)) continue;
            const pieces = hideRange(node, localStart, localEnd);
            for (const piece of pieces) hiddenKeys.push(firstKeyOf(piece));
            if (pieces.length > 0) lastHidden = pieces[pieces.length - 1];
        }
        if (hiddenKeys.length === 0) return;

        // The label describes the whole collapsed run, not just the newest
        // slice (a merged fold spans everything it hides). The run's text is
        // the document text WITHIN [runStart, runEnd) — never the surrounding
        // leaves' full text: a leaf carrying text OUTSIDE the run (the anchor
        // text a paste lands after) must not widen the region, or `reconcile`
        // would read `joined !== hiddenKey texts` as an edit and retire the
        // chip while revealing it.
        let joined = "";
        {
            let pos = 0;
            for (const t of texts) {
                const here = pos;
                pos += t.length;
                if (pos <= runStart || here >= runEnd) continue;
                const from = Math.max(0, runStart - here);
                const to = Math.min(t.length, runEnd - here);
                if (to > from) joined += t.slice(from, to);
            }
        }
        const chip = new (chipClass as unknown as new () => ChipNode)();
        chip.__cmKeys = hiddenKeys;
        chip.__cmLabel = badgeLabel(joined.length, countLinesFrom(joined));
        if (lastHidden !== null && typeof lastHidden.insertAfter === "function") {
            (lastHidden.insertAfter as (other: DocNode) => void)(chip as unknown as DocNode);
        }
        const region: Region = {
            chipKey: (chip.getKey as () => string)(),
            hiddenKeys,
            text: joined,
            collapsed: true,
            disposed: false
        };
        state.regions.set(region.chipKey, region);
        selectAfter(chip as unknown as DocNode, st);
    });
}

/** Line count over inserted text ("" → 0, else the "\n"-split count). */
function countLinesFrom(text: string): number {
    if (text === "") return 0;
    return text.split("\n").length;
}

/** Adopt/retire/expand chips so every hidden run stays consistent. The
 *  whole pass runs inside ONE discrete commit: the style writes and chip
 *  removals it performs are node-writable only inside an update. */
function reconcile(editor: ChipEditor & object): void {
    commitUpdate(editor, () => {
        const st = stateOf(editor as DocEditor);
        if (st === null) return;
        const firstKeyOf = (node: DocNode): string => (typeof node.getKey === "function" ? (node.getKey.call(node) as string) : "");

        // Adopt chips the document holds but the map lost (undo/import).
        for (const node of st._nodeMap.values()) {
            if (node.__type !== CHIP_TYPE) continue;
            const key = firstKeyOf(node);
            if (key === "" || state.regions.has(key)) continue;
            if (!isAttached(node, st)) continue;
            const keys = Array.isArray((node as ChipNode).__cmKeys) ? ((node as ChipNode).__cmKeys as string[]) : [];
            if (keys.length === 0) {
                // Chip with no hidden run: drop it.
                if (typeof node.remove === "function") (node.remove as () => void)();
                continue;
            }
            let joined = "";
            const live: string[] = [];
            for (const k of keys) {
                const n = st._nodeMap.get(k);
                if (n !== undefined && typeof n.__text === "string") {
                    live.push(k);
                    joined += n.__text;
                }
            }
            if (live.length === 0) {
                if (typeof node.remove === "function") (node.remove as () => void)();
                continue;
            }
            state.regions.set(key, { chipKey: key, hiddenKeys: live, text: joined, collapsed: (node as ChipNode).__cmCollapsed !== false, disposed: false });
        }

        for (const [chipKey, region] of Array.from(state.regions.entries())) {
            if (region.disposed) {
                state.regions.delete(chipKey);
                continue;
            }
            const chip = st._nodeMap.get(chipKey);
            if (chip === undefined || !isAttached(chip, st)) {
                // Chip gone (undone/deleted): reveal the text it hid.
                for (const k of region.hiddenKeys) {
                    const n = st._nodeMap.get(k);
                    if (n !== undefined) showNode(n);
                }
                state.regions.delete(chipKey);
                continue;
            }
            const nodes: DocNode[] = [];
            let joined = "";
            const liveKeys: string[] = [];
            for (const k of region.hiddenKeys) {
                const n = st._nodeMap.get(k);
                if (n !== undefined && typeof n.__text === "string") {
                    nodes.push(n);
                    liveKeys.push(k);
                    joined += n.__text;
                }
            }
            if (liveKeys.length === 0) {
                // Hidden text all gone: retire the chip silently.
                if (typeof chip.remove === "function") (chip.remove as () => void)();
                state.regions.delete(chipKey);
                continue;
            }
            if (joined !== region.text) {
                // The hidden run was edited (or restored differently by undo):
                // reveal it and drop the stale chip.
                for (const n of nodes) showNode(n);
                if (typeof chip.remove === "function") (chip.remove as () => void)();
                state.regions.delete(chipKey);
                continue;
            }
            if (region.collapsed) {
                for (const n of nodes) if (!isHidden(n)) hideNode(n);
                // Only go writable when the bit is about to change:
                // `writable` clones + dirties the node, and a no-op clone on
                // every quiet pass would force a DOM commit of every chip.
                if ((chip as ChipNode).__cmCollapsed !== true) {
                    (writable(chip) as ChipNode).__cmCollapsed = true;
                }
            } else {
                for (const n of nodes) if (isHidden(n)) showNode(n);
                if ((chip as ChipNode).__cmCollapsed === true) {
                    (writable(chip) as ChipNode).__cmCollapsed = false;
                }
            }
        }
    });
}

/** Retire one region: reveal its hidden text, drop its chip + map entry. */
function destroyRegion(region: Region): void {
    if (region.disposed) return;
    region.disposed = true;
    if (region.chipKey !== "" && state.regions.get(region.chipKey) === region) {
        state.regions.delete(region.chipKey);
    }
}

/** Chip DOM click: flip the hidden run's visibility, keeping the chip. */
function toggleChip(chip: ChipNode): void {
    if (state.disposed || state.failed) return;
    const editor = state.editor;
    if (editor === null) return;
    try {
        commitUpdate(editor, () => {
            const st = stateOf(editor as DocEditor);
            if (st === null) return;
            const key = typeof chip.getKey === "function" ? (chip.getKey.call(chip) as string) : "";
            const live = key === "" ? chip : st._nodeMap.get(key);
            if (live === undefined) return;
            const region = state.regions.get(key);
            const collapsed = region !== undefined ? region.collapsed : (live as ChipNode).__cmCollapsed === true;
            const nextCollapsed = !collapsed;
            const keys = region !== undefined ? region.hiddenKeys : Array.isArray((live as ChipNode).__cmKeys) ? ((live as ChipNode).__cmKeys as string[]) : [];
            for (const k of keys) {
                const n = st._nodeMap.get(k);
                if (n === undefined) continue;
                if (nextCollapsed) hideNode(n);
                else showNode(n);
            }
            // The chip carries its collapsed bit as a state field so undo
            // and re-hydration round-trip it; the DOM face is re-synced from
            // this field by `updateDOM`.
            const face = writable(live) as ChipNode;
            face.__cmCollapsed = nextCollapsed;
            if (region !== undefined) region.collapsed = nextCollapsed;
        });
    } catch (error) {
        failOpen(error);
    }
}

/**
 * Backspace/Delete with the caret adjacent to a chip removes the whole chip
 * — the `@` reference-chip deletion semantics: one keystroke, the whole
 * inline atom goes. Hidden text is never stranded: the run it hid is
 * revealed in the same commit.
 */
function onKeyDown(event: KeyboardEvent): void {
    if (state.disposed || state.failed || state.regions.size === 0) return;
    if (event.key !== "Backspace" && event.key !== "Delete") return;
    const editor = state.editor;
    if (editor === null) return;
    const st = stateOf(editor as DocEditor);
    if (st === null) return;
    const selection = typeof (editor as unknown as { getSelection?: () => unknown }).getSelection === "function" ? ((editor as unknown as { getSelection: () => unknown }).getSelection)() : null;
    const anchor = (selection as { anchor?: { key?: string; offset?: number } } | null)?.anchor;
    if (anchor === undefined) return;
    const focus = (selection as { focus?: { key?: string; offset?: number } } | null)?.focus;
    if (focus === undefined) return;
    if (anchor.key !== focus.key || anchor.offset !== focus.offset) return;
    const anchorKey = String(anchor.key);
    const anchorOffset = Number(anchor.offset) || 0;
    let adjacentChip: string | null = null;

    if (state.regions.has(anchorKey)) {
        adjacentChip = anchorKey;
    } else {
        const anchorNode = st._nodeMap.get(anchorKey);
        if (anchorNode === undefined || typeof anchorNode.__text !== "string") return;
        const prevKey = typeof anchorNode.__prev === "string" ? anchorNode.__prev : null;
        const nextKey = typeof anchorNode.__next === "string" ? anchorNode.__next : null;
        const textLen = anchorNode.__text.length;
        if (event.key === "Backspace" && anchorOffset === 0 && prevKey !== null && state.regions.has(prevKey)) adjacentChip = prevKey;
        else if (event.key === "Delete" && anchorOffset === textLen && nextKey !== null && state.regions.has(nextKey)) adjacentChip = nextKey;
    }
    if (adjacentChip === null) return;
    const region = state.regions.get(adjacentChip);
    if (region === undefined) return;
    event.preventDefault();
    commitUpdate(editor, () => {
        const st2 = stateOf(editor as DocEditor);
        if (st2 === null) return;
        // Whole-chip removal, atomic in one keystroke: reveal the hidden
        // run it marked, then remove the chip node.
        for (const k of region.hiddenKeys) {
            const n = st2._nodeMap.get(k);
            if (n !== undefined) showNode(n);
        }
        const chip = st2._nodeMap.get(region.chipKey);
        if (chip !== undefined && typeof chip.remove === "function") (chip.remove as () => void)();
    });
    destroyRegion(region);
}

/** Document capture paste: record the pending paste, never consume it. */
function onPasteCapture(event: ClipboardEvent): void {
    if (state.disposed || state.failed || state.root === null) return;
    const target = event.target as Node | null;
    if (target === null || typeof (target as HTMLElement).contains !== "function") return;
    if (!state.root.contains(target)) return;
    const data = event.clipboardData;
    if (data === null || data === undefined) return;
    const raw = data.getData("text/plain");
    if (raw === "") return;
    const clean = sanitize(raw);
    if (clean === "") return;
    const config = readConfig();
    if (config === null || !config.active || !meetsThreshold(clean, config)) return;
    const st = stateOf((state.root as unknown as { __lexicalEditor?: DocEditor }).__lexicalEditor as DocEditor);
    const baseline = st === null ? "" : documentText(st);
    // The ONLY gate for folding is "this was a real paste that met the
    // threshold" (already decided above) — never "the composer already has
    // text": pasting multiline into a fresh/empty composer is the primary
    // case and must fold. An extra DOM-empty bail wrongly suppressed it.
    state.pending = { baseline, clean };
}

/** Track composer mounts/unmounts (the GUI recreates the root freely). */
function onComposerMountChanges(mutations: MutationRecord[]): void {
    if (state.disposed || state.failed) return;
    for (const m of mutations) {
        for (let a = 0; a < m.addedNodes.length; a++) {
            const n = m.addedNodes[a];
            if (n.nodeType !== 1) continue;
            const el = n as Element;
            let root = el.matches !== undefined && el.matches(ROOT_SELECTOR) ? (el as HTMLElement) : null;
            if (root === null && el.querySelector !== undefined) root = el.querySelector(ROOT_SELECTOR) as HTMLElement | null;
            if (root !== null && root !== state.root) {
                attachRoot(root);
                return;
            }
        }
        for (let r = 0; r < m.removedNodes.length; r++) {
            if (m.removedNodes[r] === (state.root as Node)) {
                detachRoot();
                return;
            }
        }
    }
}

const rootObserver = new MutationObserver(onMutations);
const bodyObserver = new MutationObserver((mutations) => onComposerMountChanges(mutations));

/** Watch one root's edits (replacing any previous root). */
function attachRoot(root: HTMLElement): void {
    if (state.disposed || state.failed) return;
    detachRoot();
    state.root = root;
    // Reset any editor the previous root held; rebind lazily in quiet().
    state.editor = null;
    state.chipClass = null;
    rootObserver.observe(root, { childList: true, characterData: true, subtree: true, attributes: true });
}

/** Stop watching the root and tear every region down. */
function detachRoot(): void {
    for (const region of Array.from(state.regions.values())) {
        region.disposed = true;
    }
    state.regions.clear();
    state.pending = null;
    if (state.quietTimer !== null) {
        clearTimeout(state.quietTimer);
        state.quietTimer = null;
    }
    rootObserver.disconnect();
    state.root = null;
    state.editor = null;
    state.chipClass = null;
}

function onMutations(): void {
    if (state.disposed || state.quietTimer !== null) return;
    state.quietTimer = setTimeout(quiet, QUIET_MS);
}

/** Fail-open: one error and the plugin is inert; stock composer intact. */
function failOpen(error: unknown): void {
    if (state.failed) return;
    state.failed = true;
    try {
        console.warn("[dsh-collapse-multiline-paste] going inert:", error);
    } catch (ignored) {
        // console unavailable; stay silent
    }
    dispose();
}

/** Tear down every listener and region. */
export function dispose(): void {
    if (state.disposed) return;
    state.disposed = true;
    detachRoot();
    bodyObserver.disconnect();
    document.removeEventListener("paste", onPasteCapture as EventListener, true);
    document.removeEventListener("keydown", onKeyDown, true);
}

/** Arm the watcher: paste capture, observers, keydown guard, chip toggle. */
export function arm(): void {
    if (state.disposed || state.failed) return;
    setChipToggle(toggleChip);
    document.addEventListener("paste", onPasteCapture as EventListener, true);
    document.addEventListener("keydown", onKeyDown, true);
    bodyObserver.observe(document.body, { childList: true, subtree: true });
    const existing = document.querySelector(ROOT_SELECTOR);
    if (existing !== null) attachRoot(existing as HTMLElement);
}
