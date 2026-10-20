/**
 * Engine half — the Lexical document view.
 *
 * Structural typing over the live composer surfaces (the shell's bundled
 * Lexical is not a dependency; every member is read defensively). The
 * document text is the "flat draft": every text leaf's text, line breaks
 * as "\n", and a "\n" joining root-level blocks — byte-identical to DSH's
 * own projection for the text the user can type.
 *
 * Everything here runs inside `editor.update` callbacks (except the pure
 * readers, which also work on a committed state).
 */
import { CHIP_TYPE } from "./chip.js";

/** One contributed leaf: a text node, a line break, or a block boundary. */
export interface DocLeaf {
    /** The Lexical node contributing the text, or null for a block
     *  boundary (the "\n" between root-level paragraphs owns no node). */
    node: DocNode | null;
    /** What this leaf contributes to the flat document text. */
    text: string;
}

/** Structural view of one Lexical node instance. */
export interface DocNode {
    __type: string;
    __text?: unknown;
    __style?: unknown;
    __parent?: string | null;
    __first?: string | null;
    __next?: string | null;
    [key: string]: unknown;
}

/** Structural view of an editor state. */
export interface StateLike {
    _nodeMap: Map<string, DocNode>;
    [key: string]: unknown;
}

/** Structural view of the live composer editor. */
export interface DocEditor {
    _editorState?: StateLike;
    getEditorState?(): StateLike;
    update?(callback: () => void, options?: { discrete?: boolean }): void;
    [key: string]: unknown;
}

/** The state to read/write through (the update-draft when inside one). */
export function stateOf(editor: DocEditor): StateLike | null {
    const draft = editor._editorState;
    const state = draft !== undefined ? draft : typeof editor.getEditorState === "function" ? editor.getEditorState() : undefined;
    if (state === undefined || state === null || typeof (state as StateLike)._nodeMap === "undefined") return null;
    return state as StateLike;
}

/** The state's root node. */
export function rootNode(state: StateLike): DocNode | null {
    const nodes = state._nodeMap.values();
    for (const node of nodes) if (node.__type === "root") return node;
    return null;
}

/** A node's children (the live accessor when available, else the keys). */
export function childrenOf(node: DocNode, state: StateLike): DocNode[] {
    if (typeof node.getChildren === "function") {
        try {
            const kids = (node.getChildren as () => DocNode[])();
            if (Array.isArray(kids)) return kids;
        } catch {
            // fall back to the key walk
        }
    }
    const kids: DocNode[] = [];
    let key = typeof node.__first === "string" ? node.__first : null;
    let guard = 0;
    while (key !== null && guard < 10000) {
        const kid = state._nodeMap.get(key);
        if (kid === undefined) break;
        kids.push(kid);
        key = typeof kid.__next === "string" ? kid.__next : null;
        guard += 1;
    }
    return kids;
}

/** The ordered document leaves: every text node, line break and block gap. */
export function docLeaves(state: StateLike): DocLeaf[] {
    const out: DocLeaf[] = [];
    const walk = (node: DocNode): void => {
        if (node.__type === CHIP_TYPE) return; // inline marker: contributes ""
        if (typeof node.__text === "string") {
            out.push({ node, text: node.__text });
            return;
        }
        if (node.__type === "linebreak") {
            out.push({ node, text: "\n" });
            return;
        }
        const kids = childrenOf(node, state);
        if (node.__type === "root") {
            for (let i = 0; i < kids.length; i++) {
                if (i > 0) out.push({ node: null, text: "\n" });
                walk(kids[i]);
            }
            return;
        }
        for (const kid of kids) walk(kid);
    };
    const root = rootNode(state);
    if (root !== null) walk(root);
    return out;
}

/** The flat document text (what DSH's own projection reads for text). */
export function documentText(state: StateLike): string {
    let text = "";
    for (const leaf of docLeaves(state)) text += leaf.text;
    return text;
}

/** Whether one text leaf is currently hidden (its style collapses layout). */
export function isHidden(node: DocNode): boolean {
    if (typeof node.getStyle === "function") {
        try {
            const style = (node.getStyle as () => string)();
            if (typeof style === "string") return style.indexOf("display:none") !== -1 || style.indexOf("display: none") !== -1;
        } catch {
            // fall back to the raw field below
        }
    }
    const style = node.__style;
    if (typeof style === "string") return style.indexOf("display:none") !== -1 || style.indexOf("display: none") !== -1;
    return false;
}

/** Hide a text leaf in the DOM via its state-level style. */
export function hideNode(node: DocNode): void {
    if (isHidden(node)) return;
    if (typeof node.setStyle === "function") {
        (node.setStyle as (style: string) => void)("display:none");
        return;
    }
    node.__style = "display:none";
}

/** Reveal one hidden text leaf (clears its style). */
export function showNode(node: DocNode): void {
    if (!isHidden(node)) return;
    if (typeof node.setStyle === "function") {
        (node.setStyle as (style: string) => void)("");
        return;
    }
    node.__style = "";
}

/** Is a node a plain text leaf (the only kind this engine hides)? */
export function isTextNode(node: DocNode | null): node is DocNode {
    return node !== null && typeof node.__text === "string" && typeof node.setTextContent === "function";
}

/**
 * Hide the characters [startOffset, endOffset) of one text node: split the
 * node around the span and hide the inside piece(s) via state-level style.
 * Fully-covered nodes are hidden in place.
 *
 * @returns the nodes now carrying (and hiding) the span.
 */
export function hideRange(node: DocNode, startOffset: number, endOffset: number): DocNode[] {
    const full = typeof node.__text === "string" ? (node.__text as string) : "";
    const start = startOffset < 0 ? 0 : startOffset > full.length ? full.length : startOffset;
    const end = endOffset < 0 ? 0 : endOffset > full.length ? full.length : endOffset;
    if (end <= start) return [];
    if (start === 0 && end === full.length) {
        hideNode(node);
        return [node];
    }
    const Ctor = node.constructor as unknown;
    if (typeof Ctor !== "function") return [];
    if (start > 0 && end < full.length) {
        const mid = new (Ctor as new (text: string) => DocNode)(full.slice(start, end));
        const tail = new (Ctor as new (text: string) => DocNode)(full.slice(end));
        (node.setTextContent as (text: string) => void)(full.slice(0, start));
        (node.insertAfter as (other: DocNode) => void)(mid);
        (mid.insertAfter as (other: DocNode) => void)(tail);
        hideNode(mid);
        return [mid];
    }
    if (start > 0) {
        const mid = new (Ctor as new (text: string) => DocNode)(full.slice(start));
        (node.setTextContent as (text: string) => void)(full.slice(0, start));
        (node.insertAfter as (other: DocNode) => void)(mid);
        hideNode(mid);
        return [mid];
    }
    // end < full.length: the range starts at the node's start.
    const head = new (Ctor as new (text: string) => DocNode)(full.slice(0, end));
    (node.setTextContent as (text: string) => void)(full.slice(end));
    (node.insertBefore as (other: DocNode) => void)(head);
    hideNode(head);
    return [head];
}

/**
 * Replace one line break in place with a hidden text node carrying "\n"
 * (a line break has no style face to collapse; an invisible text leaf
 * projects the same "\n").
 */
export function hideLineBreak(node: DocNode, state: StateLike): DocNode[] {
    const replacement = textClass(state);
    if (replacement === null) return [];
    const piece = new (replacement as new (text: string) => DocNode)("\n");
    hideNode(piece);
    (node.insertAfter as (other: DocNode) => void)(piece);
    (node.remove as () => void)();
    return [piece];
}

/** The text-node class of one live text leaf (null when the document has none). */
export function textClass(state: StateLike): (new (text: string) => DocNode) | null {
    for (const node of state._nodeMap.values()) {
        if (node.__type === "text") {
            const Ctor = node.constructor;
            if (typeof Ctor === "function") return Ctor as new (text: string) => DocNode;
        }
    }
    return null;
}

/**
 * The document-order text leaves' keys — for reverse lookups (which leaf
 * holds a given flat offset).
 */
export function leafKeys(state: StateLike): string[] {
    const keys: string[] = [];
    for (const leaf of docLeaves(state)) {
        if (leaf.node !== null && typeof leaf.node.getKey === "function") {
            try {
                keys.push((leaf.node.getKey as () => string)());
            } catch {
                // skip a detached leaf
            }
        }
    }
    return keys;
}

/**
 * Move the caret just after `node`: into the following text leaf when
 * there is one, else at the end of the node's parent (the chip's DOM is
 * `contenteditable=false`, so typing at the parent's end lands after it).
 */
export function selectAfter(node: DocNode, state: StateLike): void {
    const nextKey = typeof node.__next === "string" ? node.__next : null;
    const next = nextKey === null ? undefined : state._nodeMap.get(nextKey);
    if (next !== undefined && typeof next.selectStart === "function") {
        try {
            (next.selectStart as () => unknown)();
            return;
        } catch {
            // fall through to the parent selection
        }
    }
    const parentKey = typeof node.__parent === "string" ? node.__parent : null;
    const parent = parentKey === null ? undefined : state._nodeMap.get(parentKey);
    if (parent !== undefined && typeof parent.selectEnd === "function") {
        try {
            (parent.selectEnd as () => unknown)();
        } catch {
            // no selectable place; the editor's normalization places it
        }
    }
}

/** Is the node attached to the document (the live accessor, else keys)? */
export function isAttached(node: DocNode, state: StateLike): boolean {
    if (typeof node.isAttached === "function") {
        try {
            return (node.isAttached as () => boolean)() === true;
        } catch {
            // fall through to the key walk
        }
    }
    const parentKey = typeof node.__parent === "string" ? node.__parent : null;
    if (parentKey === null) return false;
    if (parentKey === "root") return true;
    const parent = state._nodeMap.get(parentKey);
    if (parent === undefined) return false;
    for (const kid of childrenOf(parent, state)) if (kid === node) return true;
    return false;
}
