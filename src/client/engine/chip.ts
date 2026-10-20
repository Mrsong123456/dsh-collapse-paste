/**
 * Engine half — the collapse chip: one registered inline marker node.
 *
 * The chip rides the composer's own `@` reference-chip mechanism: a
 * `DecoratorNode` subclass registered at editor runtime under the type
 * `"cm-collapse"`. It carries NO text of its own (`getTextContent()` is
 * `""`; DSH's composer layout walker silently skips unknown inline
 * decorator nodes) so the hidden pasted run — kept in plain `TextNode`
 * leaves (see `doc.ts`) — stays byte-identical in the submitted draft.
 *
 * Its DOM face mirrors the reference chip's face one-for-one: an inline
 * non-editable host span carrying the chip marker attribute, a 22px
 * inline-flex face pill (`cm-chip`) with a 14px marker glyph in an icon
 * slot, an ellipsized label span and a `title` tooltip — the same
 * anatomy, computed style and interaction the `@file` selection produces
 * (see `../styles/composer.ts`). The only extra affordance is one the
 * feature needs: a click folds/reveals the marked run.
 *
 * Registration notes (live-verified against the bundled Lexical):
 * - the registry config MUST carry `transforms: []` (the commit-time
 *   normalizer runs `Array.from(config.transforms)` on every dirty node);
 * - the base class is reached by walking up from the shell's own
 *   reference chip class (`_nodes.get("reference-chip").klass`'s prototype
 *   — the bundled `DecoratorNode`);
 * - `clone`/`exportJSON`/`importJSON` carry the fields so undo and parse
 *   round-trips keep a rehydrated region consistent.
 */

/** The registered node type tag. */
export const CHIP_TYPE = "cm-collapse";

/** The chip host's tag attribute (mirrors the reference chip's host
 *  attribute `data-composer-chip`). */
export const CHIP_DOM_ATTR = "data-collapse-chip";
/** The face class — the same computed ruleset as the reference chip face. */
export const CHIP_CLASS = "cm-chip";
/** The face's icon slot (14px chevron marker), the reference chip's
 *  `ReferenceIcon`/marker slot equivalent. */
export const CHIP_ICON_CLASS = "cm-chip-icon";
/** The face's ellipsized label span, the reference chip's label equivalent. */
export const CHIP_LABEL_CLASS = "cm-chip-label";
/** Class on the face while the run is expanded (chevron rotation only). */
export const CHIP_EXPANDED_CLASS = "cm-expanded";

/** Namespace for the marker glyph. */
const SVG_NS = "http://www.w3.org/2000/svg";

/** Structural view of one chip instance (its fields ARE its state). */
export interface ChipNode {
    __type: string;
    __cmKeys: string[];
    __cmLabel: string;
    __cmCollapsed: boolean;
    getKey(): string;
    [key: string]: unknown;
}

/** Constructible chip-class shape (the subclass `ensureChipClass` builds). */
export interface ChipClass {
    new (): ChipNode;
    [key: string]: unknown;
}

/** Minimal registry-map view of the editor's `_nodes`. */
interface RegistryMap {
    get?(type: string): { klass?: unknown } | undefined;
    set(type: string, config: unknown): unknown;
    [key: string]: unknown;
}

/** What registration needs from the live editor. */
export interface ChipEditor {
    _nodes: RegistryMap;
    [key: string]: unknown;
}

/** The registry entry shape the composer's normalizer reads. */
function chipConfig(klass: unknown): Record<string, unknown> {
    return {
        klass,
        exportDOM: null,
        replace: null,
        replaceWithKlass: null,
        sharedNodeState: { flatKeys: {}, sharedConfigMap: {} },
        transforms: []
    };
}

/** The engine-provided toggle invoked by every chip DOM click. */
let toggle: ((chip: ChipNode) => void) | null = null;

/** Wire the chip face click handler (the engine calls this once at arm). */
export function setChipToggle(fn: (chip: ChipNode) => void): void {
    toggle = fn;
}

/** Editors this document already has a chip class registered on. */
const registered = new WeakMap<object, ChipClass | null>();

/** One `_nodes` entry as a [type, config] pair, whatever the storage is. */
function nodeEntries(map: RegistryMap): Array<[string, unknown]> {
    const out: Array<[string, unknown]> = [];
    const anyMap = map as unknown as {
        entries?(): Iterable<[string, unknown]>;
        forEach?(cb: (value: unknown, key: string) => void): void;
        [Symbol.iterator]?(): Iterable<unknown>;
    };
    try {
        if (typeof anyMap.entries === "function") {
            for (const entry of anyMap.entries()) out.push([String(entry[0]), entry[1]]);
            return out;
        }
        if (typeof anyMap[Symbol.iterator] === "function") {
            for (const item of anyMap[Symbol.iterator]()) {
                const pair = item as [string, unknown];
                if (Array.isArray(pair)) out.push([String(pair[0]), pair[1]]);
            }
            if (out.length > 0) return out;
        }
        if (typeof anyMap.forEach === "function") {
            anyMap.forEach((value, key) => out.push([key, value]));
            return out;
        }
    } catch {
        // fall through: no usable iteration
    }
    return out;
}

/**
 * Register the chip class on one live editor (idempotent per editor).
 * Returns the class; `null` when the editor's own registry lacks a
 * reference chip to derive the decorator base from (never collapse on
 * such an editor — fail-open, stock composer).
 */
export function ensureChipClass(editor: ChipEditor & object): ChipClass | null {
    const seen = registered.get(editor);
    if (seen !== undefined) return seen;
    let Chip: ChipClass | null = null;
    try {
        const base = decoratorBase(editor);
        if (base !== null) {
            Chip = buildChipClass(base);
            editor._nodes.set(CHIP_TYPE, chipConfig(Chip));
        }
    } catch {
        Chip = null;
    }
    registered.set(editor, Chip);
    return Chip;
}

/** The bundled `DecoratorNode` class: the reference chip class's proto. */
function decoratorBase(editor: ChipEditor): unknown {
    const entry = editor._nodes.get ? editor._nodes.get("reference-chip") : undefined;
    let klass: unknown = entry !== void 0 && entry !== null && typeof entry.klass === "function" ? entry.klass : undefined;
    if (klass === undefined) {
        for (const [type, config] of nodeEntries(editor._nodes)) {
            if (type === "reference-chip" && config !== null && typeof config === "object") {
                const candidate = (config as { klass?: unknown }).klass;
                if (typeof candidate === "function") {
                    klass = candidate;
                    break;
                }
            }
        }
    }
    if (typeof klass !== "function") return null;
    const chain = Object.getPrototypeOf(klass);
    return typeof chain === "function" ? chain : null;
}

/** Build the chip node subclass over the live decorator base class. */
function buildChipClass(base: unknown): ChipClass {
    const Chip = class ChipNodeClass extends (base as new (...args: never[]) => ChipNode) {
        /** Hidden run: the document text-node keys this chip marks. */
        __cmKeys: string[] = [];
        /** The pill's label, "N chars / M lines". */
        __cmLabel = "";
        /** True while the run is collapsed. */
        __cmCollapsed = true;
        static getType(): string {
            return CHIP_TYPE;
        }

        static clone(node: ChipNode): ChipNode {
            // Lexical 0.49 clones via `$cloneWithProperties` → `clone()` then
            // `afterCloneFrom(node)`, which only copies `__parent/__next/
            // __prev` when the clone carries the SAME key. A fresh key drops
            // those pointers: the chip stays in the parent's child chain with
            // null links, and the DOM reconciler's child walk desyncs from the
            // element's `__size` → "Minified Lexical error #227/#228" during a
            // later DOM commit. So the clone must carry the node's key (the
            // composer's own reference chip clone passes it to its
            // constructor; this class takes no ctor args, so assign it right
            // away — before `afterCloneFrom` runs).
            const copy = new ChipNodeClass();
            copy.__key = node.__key as string;
            copy.__cmKeys = Array.isArray(node.__cmKeys) ? node.__cmKeys.slice() : [];
            copy.__cmLabel = typeof node.__cmLabel === "string" ? node.__cmLabel : "";
            copy.__cmCollapsed = node.__cmCollapsed !== false;
            return copy;
        }

        static importJSON(data: Record<string, unknown>): ChipNode {
            const chip = new ChipNodeClass();
            if (data !== null && data !== undefined) {
                chip.__cmKeys = Array.isArray(data.cmKeys) ? (data.cmKeys as unknown[]).filter((key) => typeof key === "string") as string[] : [];
                chip.__cmLabel = typeof data.cmLabel === "string" ? data.cmLabel : "";
                chip.__cmCollapsed = data.cmCollapsed !== false;
            }
            return chip;
        }

        exportJSON(): Record<string, unknown> {
            // Deliberately not delegating to the base's exportJSON: the face
            // must round-trip through importJSON/parse (and undo clone/parse)
            // with only these fields plus type/version.
            return {
                type: CHIP_TYPE,
                version: 1,
                cmKeys: this.__cmKeys.slice(),
                cmLabel: this.__cmLabel,
                cmCollapsed: this.__cmCollapsed
            };
        }

        isInline(): boolean {
            return true;
        }

        isKeyboardSelectable(): boolean {
            return false;
        }

        getTextContent(): string {
            return "";
        }

        decorate(): unknown {
            return null;
        }

        createDOM(): HTMLElement {
            // Host + face, mirroring the reference chip's DOM: the host is
            // the non-editable inline marker, the face carries the whole
            // visible pill (`title` tooltip included).
            const host = document.createElement("span");
            host.setAttribute(CHIP_DOM_ATTR, "1");
            host.setAttribute("contenteditable", "false");
            const chip = this as ChipNode;
            syncChipDom(host, chip);
            host.addEventListener("click", (event: MouseEvent) => {
                // The same inline atomic behaviour as an `@` reference
                // (no text select, no caret inside); the one functional
                // extra is the fold/reveal toggle the feature needs.
                event.preventDefault();
                event.stopPropagation();
                if (toggle !== null) toggle(chip);
            });
            return host;
        }

        /**
         * Lexical hands us our DOM element to update in place.
         *
         * Current bundled-Lexical contract (live-verified against DSH's
         * composer bundle): the reconciler invokes `updateDOM(prevNode,
         * dom, editor/config)` ON THE NEW NODE — arg 1 is the previous
         * node instance, NOT a DOM element (treating it as one reads
         * `prevNode.children.length` = undefined.length → TypeError).
         * Accept both contracts: pick the element out of whichever
         * argument is one (a Lexical node has no `children`/
         * `setAttribute`, a DOM element has both).
         */
        updateDOM(first: unknown, second?: unknown): boolean {
            const element = domArgument(first, second);
            if (element === null) return true;
            syncChipDom(element, this as ChipNode);
            return false;
        }
    };
    return Chip as unknown as ChipClass;
}

/** The first argument that is a live DOM element (either contract shape). */
function domArgument(a: unknown, b?: unknown): HTMLElement | null {
    for (const value of b === undefined ? [a] : [b, a]) {
        if (value !== null && value !== undefined && typeof value === "object") {
            const candidate = value as { children?: unknown; setAttribute?: unknown };
            if (Array.isArray(candidate.children) || (typeof candidate.children === "object" && typeof candidate.setAttribute === "function")) {
                return value as HTMLElement;
            }
        }
    }
    return null;
}

/** The marker glyph: a 14px chevron in the face's icon slot — the exact
 *  slot anatomy (`flex:none`, 14px) that the reference chip face uses for
 *  its `ReferenceIcon`; rotation per expanded state lives in the CSS. */
function createGlyph(): SVGElement {
    const svg = document.createElementNS(SVG_NS, "svg");
    svg.setAttribute("class", CHIP_ICON_CLASS);
    svg.setAttribute("width", "14");
    svg.setAttribute("height", "14");
    svg.setAttribute("viewBox", "0 0 16 16");
    svg.setAttribute("fill", "none");
    svg.setAttribute("aria-hidden", "true");
    const path = document.createElementNS(SVG_NS, "path");
    path.setAttribute("d", "M6.5 4L10.5 8L6.5 12");
    path.setAttribute("stroke", "currentColor");
    path.setAttribute("stroke-width", "1.5");
    path.setAttribute("stroke-linecap", "round");
    path.setAttribute("stroke-linejoin", "round");
    svg.appendChild(path);
    return svg;
}

/** One face element: pill span + icon slot + ellipsized label span. */
function createFace(): HTMLElement {
    const face = document.createElement("span");
    face.className = CHIP_CLASS;
    face.appendChild(createGlyph());
    const label = document.createElement("span");
    label.setAttribute("class", CHIP_LABEL_CLASS);
    face.appendChild(label);
    return face;
}

/** The class of one DOM element as a plain string (SVG classes are
 *  animated objects; only string class names can be ours). */
function classNameOf(element: Element): string {
    const klass = (element as unknown as { className?: unknown }).className;
    return typeof klass === "string" ? klass : "";
}

/** Whether one element carries one class (classList when present, else the
 *  class string) — robust across the expanded-state class toggles. */
function hasClass(element: Element, cls: string): boolean {
    const list = (element as unknown as { classList?: { contains?(c: string): boolean } }).classList;
    if (list !== undefined && typeof list.contains === "function") return list.contains(cls) === true;
    return ` ${classNameOf(element)} `.split(" ").includes(cls);
}

/** Keep one chip's DOM in step with the node's fields: label text, the
 *  `title` tooltip (the reference chip puts its label there too) and the
 *  expanded class that turns the chevron. */
function syncChipDom(host: HTMLElement, chip: ChipNode): void {
    const text = chip.__cmLabel === "" ? "\u25B8" : chip.__cmLabel;
    let face: HTMLElement | null = null;
    for (let i = 0; i < host.children.length; i++) {
        if (hasClass(host.children[i], CHIP_CLASS)) {
            face = host.children[i] as HTMLElement;
            break;
        }
    }
    if (face === null) {
        face = createFace();
        host.appendChild(face);
    }
    face.setAttribute("title", text);
    let label: Element | null = null;
    for (let i = 0; i < face.children.length; i++) {
        if (classNameOf(face.children[i]) === CHIP_LABEL_CLASS) {
            label = face.children[i];
            break;
        }
    }
    if (label === null) {
        label = document.createElement("span");
        label.setAttribute("class", CHIP_LABEL_CLASS);
        face.appendChild(label);
    }
    if (label.textContent !== text) label.textContent = text;
    face.classList.toggle(CHIP_EXPANDED_CLASS, chip.__cmCollapsed !== true);
}
