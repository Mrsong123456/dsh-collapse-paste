/**
 * @comecaramelos/dsh-collapse-multiline-paste — inline-chip engine tests.
 *
 * Drives the emitted browser bundle over a Lexical-shaped document stub
 * (the live composer surface the engine reads defensively: `__lexicalEditor`,
 * `_nodes`, `_editorState._nodeMap`, `update`, `getSelection`) through the
 * full collapse cycle:
 *
 *  1. a paste commit folds the pasted run into ONE inline chip between the
 *     surrounding text — the hidden run sits in `display:none` leaves, the
 *     chip rides the document right after the last hidden leaf, and the
 *     surrounding text stays plain;
 *  2. the chip's DOM face mirrors the composer's `@` reference-chip face
 *     (host + pill face + 14px icon slot + ellipsized label + `title`),
 *     and the stylesheet carries that face's properties verbatim;
 *  3. click folds/reveals; Backspace/Delete adjacent to a pill removes the
 *     whole chip (the `@` deletion semantics) without stranding hidden text;
 *  4. a second touching paste merges the live fold into a single chip;
 *  5. a hidden run that is edited, or a chip removed externally (undo),
 *     always resolves to plain visible text with no marker.
 *
 * Lives in its own process: the engine's module state is a process-wide
 * singleton (armed once through bundle `apply`).
 *
 * @module test/chip-engine
 */
import { test } from "node:test";
import assert from "node:assert/strict";

// ── DOM stubs ────────────────────────────────────────────────────────────────

class StubDomElement {
    constructor(tagName) {
        this.tagName = String(tagName).toUpperCase();
        this.children = [];
        this.parent = null;
        this.__classes = new Set();
        this.__text = "";
        this.attributes = {};
        this.listeners = new Map();
        this.isConnected = true;
        this.dataset = {};
        const style = {};
        style.setProperty = (name, value) => {
            style[name] = value;
        };
        style.removeProperty = (name) => {
            delete style[name];
        };
        this.style = style;
        this.classList = {
            add: (c) => this.__classes.add(c),
            remove: (c) => this.__classes.delete(c),
            contains: (c) => this.__classes.has(c),
            toggle: (c, force) => {
                if (force === void 0) force = !this.__classes.has(c);
                if (force) this.__classes.add(c);
                else this.__classes.delete(c);
            }
        };
    }
    get textContent() {
        if (this.children.length === 0) return this.__text;
        return this.__text + this.children.map((kid) => kid.textContent).join("");
    }
    set textContent(value) {
        this.children = [];
        this.__text = String(value);
    }
    get className() {
        return [...this.__classes].join(" ");
    }
    set className(value) {
        this.__classes = new Set(String(value).split(/\s+/).filter(Boolean));
    }
    appendChild(child) {
        child.parent = this;
        this.children.push(child);
        if (this.tagName === "HEAD" && child.tagName === "STYLE") doc.styleTags.push(child);
        return child;
    }
    matches(selector) {
        return selector === "[data-composer-input]" && this.attributes["data-composer-input"] === "";
    }
    querySelectorAll(selector) {
        if (selector === "[data-collapse-chip]") {
            const out = [];
            const walk = (node) => {
                for (const kid of node.children) {
                    if (kid.attributes["data-collapse-chip"] !== void 0) out.push(kid);
                    walk(kid);
                }
            };
            walk(this);
            return out;
        }
        return [];
    }
    querySelector(selector) {
        const hits = this.querySelectorAll(selector);
        return hits.length > 0 ? hits[0] : null;
    }
    contains(node) {
        if (node === this) return true;
        for (const c of this.children) if (c.contains !== void 0 && c.contains(node)) return true;
        return false;
    }
    setAttribute(name, value) {
        this.attributes[name] = String(value);
        if (name === "class") this.className = String(value);
    }
    getAttribute(name) {
        return this.attributes[name] ?? null;
    }
    addEventListener(type, fn) {
        if (!this.listeners.has(type)) this.listeners.set(type, []);
        this.listeners.get(type).push(fn);
    }
    /** Fire one listener set with a minimal event. */
    fire(type, event) {
        for (const fn of [...(this.listeners.get(type) ?? [])]) fn({ target: this, preventDefault() {}, stopPropagation() {}, ...event });
    }
}

function createDocument() {
    const doc = {
        head: new StubDomElement("head"),
        body: new StubDomElement("body"),
        styleTags: [],
        createElement(tagName) {
            return new StubDomElement(tagName);
        },
        createElementNS(_ns, tagName) {
            return new StubDomElement(tagName);
        },
        querySelector(selector) {
            if (selector.startsWith("style[data-plugin-css=")) {
                const id = selector.slice(selector.indexOf('"') + 1, selector.lastIndexOf('"'));
                return doc.styleTags.find((tag) => tag.dataset.pluginCss === id) ?? null;
            }
            if (selector === "[data-composer-input]") return doc.root ?? null;
            return null;
        },
        listeners: new Map(),
        addEventListener(type, fn) {
            if (!doc.listeners.has(type)) doc.listeners.set(type, []);
            doc.listeners.get(type).push(fn);
        },
        removeEventListener(type, fn) {
            const arr = doc.listeners.get(type);
            if (arr === undefined) return;
            const i = arr.indexOf(fn);
            if (i !== -1) arr.splice(i, 1);
        },
        fire(type, event) {
            for (const fn of [...(doc.listeners.get(type) ?? [])]) fn({ preventDefault() {}, ...event });
        }
    };
    return doc;
}

const doc = createDocument();
globalThis.document = doc;

const observers = [];
class StubMutationObserver {
    constructor(callback) {
        this.callback = callback;
        observers.push(this);
    }
    observe() {
        this.active = true;
    }
    disconnect() {
        this.active = false;
    }
}
globalThis.MutationObserver = StubMutationObserver;

// Timers under control (the quiet window is a setTimeout).
let timers = [];
globalThis.setTimeout = (fn) => {
    const id = String(timers.push({ fn }));
    return id;
};
globalThis.clearTimeout = (id) => {
    timers = timers.filter((t) => String(t.id) !== String(id));
};
function flush() {
    const pending = [...timers];
    timers = [];
    for (const t of pending) t.fn();
}

/** One DOM mutation pass + the settled quiet window. */
function mutate() {
    for (const observer of observers) if (observer.active) observer.callback([]);
    flush();
}

// ── bundle load ──────────────────────────────────────────────────────────────

let loaded = null;
globalThis.window = {
    getComputedStyle: () => ({ lineHeight: "21px" }),
    __ModuleLoader__: {
        load(spec) {
            loaded = spec;
        }
    }
};
await import("../lib/client.js");

const bundle = loaded.factory((id) => {
    if (id === "react" || id === "react/jsx-runtime") return { createElement: () => ({}), Fragment: Symbol("f") };
    if (id === "@deepseek-ai/dsh-client-store") return { createSnapshotStore: () => ({ get: () => void 0, subscribe: () => () => {} }) };
    if (id === "@deepseek-ai/dsh-client-ui-primitives") return { Switch: () => null };
    throw new Error(`unexpected require: ${id}`);
});
assert.equal(typeof bundle.apply, "function");

// ── the Lexical-shaped document stub ────────────────────────────────────────

let keyCounter = 1;
const nodeMap = new Map();

/** One document node in the shape the engine reads defensively. */
class StubNode {
    constructor(type) {
        this.__type = typeof this.constructor.getType === "function" ? this.constructor.getType() : type;
        this.__key = String(keyCounter++);
        this.__parent = null;
        this.__first = null;
        this.__last = null;
        this.__prev = null;
        this.__next = null;
        nodeMap.set(this.__key, this);
    }
    getKey() {
        return this.__key;
    }
    getWritable() {
        return this;
    }
    getChildren() {
        const kids = [];
        let key = this.__first;
        while (key !== null && key !== undefined) {
            const kid = nodeMap.get(key);
            if (kid === undefined) break;
            kids.push(kid);
            key = kid.__next;
        }
        return kids;
    }
    append(child) {
        child.__parent = this.__key;
        const lastKey = this.__last;
        if (lastKey !== null && lastKey !== undefined) {
            const last = nodeMap.get(lastKey);
            if (last !== undefined) last.__next = child.__key;
            child.__prev = lastKey;
        }
        this.__last = child.__key;
        if (this.__first === null || this.__first === undefined) this.__first = child.__key;
        return child;
    }
    insertBefore(node) {
        node.__parent = this.__parent;
        node.__next = this.__key;
        node.__prev = this.__prev;
        if (this.__prev !== null && this.__prev !== undefined) {
            const prev = nodeMap.get(this.__prev);
            if (prev !== undefined) prev.__next = node.__key;
        }
        const parent = this.__parent === null || this.__parent === undefined ? null : nodeMap.get(this.__parent);
        if (parent !== null && parent !== undefined && parent.__first === this.__key) parent.__first = node.__key;
        this.__prev = node.__key;
        return node;
    }
    insertAfter(node) {
        node.__parent = this.__parent;
        node.__prev = this.__key;
        node.__next = this.__next;
        if (this.__next !== null && this.__next !== undefined) {
            const next = nodeMap.get(this.__next);
            if (next !== undefined) next.__prev = node.__key;
        }
        const parent = this.__parent === null || this.__parent === undefined ? null : nodeMap.get(this.__parent);
        if (parent !== null && parent !== undefined && parent.__last === this.__key) parent.__last = node.__key;
        this.__next = node.__key;
        return node;
    }
    remove() {
        const prev = this.__prev === null || this.__prev === undefined ? null : nodeMap.get(this.__prev);
        if (prev !== null && prev !== undefined) prev.__next = this.__next;
        const next = this.__next === null || this.__next === undefined ? null : nodeMap.get(this.__next);
        if (next !== null && next !== undefined) next.__prev = this.__prev;
        const parent = this.__parent === null || this.__parent === undefined ? null : nodeMap.get(this.__parent);
        if (parent !== null && parent !== undefined) {
            if (parent.__first === this.__key) parent.__first = this.__next;
            if (parent.__last === this.__key) parent.__last = this.__prev;
        }
        this.__parent = null;
        this.__prev = null;
        this.__next = null;
        nodeMap.delete(this.__key);
        return this;
    }
    isAttached() {
        if (this.__parent === null || this.__parent === undefined) return false;
        const parent = nodeMap.get(this.__parent);
        if (parent === undefined) return false;
        if (parent.__type === "root") return true;
        return parent.isAttached();
    }
    // Caret placement is not modelled; the engine treats these as no-ops.
    selectStart() {}
    selectEnd() {}
}

class StubTextNode extends StubNode {
    constructor(text = "") {
        super("text");
        this.__text = text;
        this.__style = "";
    }
    static getType() {
        return "text";
    }
    setTextContent(text) {
        this.__text = text;
        return this;
    }
    getTextContent() {
        return this.__text;
    }
    getStyle() {
        return this.__style;
    }
    setStyle(style) {
        this.__style = style;
        return this;
    }
}

class StubLineBreak extends StubNode {
    static getType() {
        return "linebreak";
    }
}

class StubElementNode extends StubNode {}

class StubParagraph extends StubElementNode {
    static getType() {
        return "paragraph";
    }
}

class StubRootNode extends StubElementNode {
    static getType() {
        return "root";
    }
}

/** Bundled Lexical's decorator base: every inline decorator (the shell's
 *  reference chip AND our fold chip) is registered over it. */
class StubDecoratorNode extends StubNode {
    static getType() {
        return "decorator";
    }
    decorate() {
        return null;
    }
}

/** The composer's own `@file` reference chip class (the chip our DOM face
 *  mirrors) — the engine walks its prototype for the decorator base. */
class StubReferenceChip extends StubDecoratorNode {
    static getType() {
        return "reference-chip";
    }
    isInline() {
        return true;
    }
    isKeyboardSelectable() {
        return false;
    }
    getTextContent() {
        return "@src/a.ts";
    }
    createDOM() {
        const host = doc.createElement("span");
        host.setAttribute("data-composer-chip", "file");
        host.setAttribute("contenteditable", "false");
        return host;
    }
}

const editor = {
    _nodes: new Map([["reference-chip", { klass: StubReferenceChip, exportDOM: null, replace: null, replaceWithKlass: null, transforms: [] }]]),
    _editorState: { _nodeMap: nodeMap },
    _selection: null,
    update(callback) {
        // The live Lexical `update` reads `this._updating` — the engine MUST
        // call it as a method on the editor, never as a bare reference.
        if (this !== editor) throw new TypeError("update called detached (loses `this`)");
        callback();
    },
    getEditorState() {
        return this._editorState;
    },
    getSelection() {
        return this._selection;
    }
};

// The live DOM composer root.
const rootDom = doc.createElement("div");
rootDom.setAttribute("data-composer-input", "");
rootDom.__lexicalEditor = editor;
doc.root = rootDom;
doc.body.appendChild(rootDom);

// ── the settings + locale faces ──────────────────────────────────────────────

const settings = { active: true, minLines: 3, minChars: 0 };
const ctx = {
    effect(fn) {
        fn();
    },
    locale: {
        register: () => () => {},
        bind: () => (key, params) => (params === undefined ? key : `${params.chars} chars / ${params.lines} lines`)
    },
    settingsScope: {
        bind: () => ({
            getSnapshot: () => ({ status: "ready", value: { ...settings } }),
            subscribe: () => () => {},
            set: async () => {},
            unset: async () => {}
        })
    },
    slots: {
        inject: () => {},
        register: () => null
    }
};
bundle.apply(ctx);

// ── document helpers ────────────────────────────────────────────────────────

/** Rebuild a fresh single-paragraph document (engine state survives). */
function resetDocument() {
    nodeMap.clear();
    const root = new StubRootNode();
    const para = new StubParagraph();
    root.append(para);
    editor._selection = null;
    return para;
}

/** The paragraph of the live document. */
function currentPara() {
    return [...nodeMap.values()].find((n) => n.__type === "paragraph");
}

/** Append one pasted block as leaves (text per line, linebreaks between). */
function appendPastedBlock(para, text) {
    const lines = text.split("\n");
    for (let i = 0; i < lines.length; i += 1) {
        if (lines[i] !== "") para.append(new StubTextNode(lines[i]));
        if (i < lines.length - 1) para.append(new StubLineBreak());
    }
}

function firePaste(clipboard) {
    doc.fire("paste", { target: rootDom, clipboardData: { getData: () => clipboard } });
}

function findChips() {
    return [...nodeMap.values()].filter((node) => node.__type === "cm-collapse");
}

function isHidden(node) {
    return node.__type === "text" && typeof node.__style === "string" && node.__style.indexOf("display:none") !== -1;
}

function hiddenNodes() {
    return [...nodeMap.values()].filter(isHidden);
}

/** One real paste: capture + commit + settle. */
function pasteAndCollapse(para, text) {
    firePaste(text);
    appendPastedBlock(para, text);
    mutate();
}

/** The chip instance plus its DOM face (host + face children). */
function liveChipDom(chip) {
    let dom = liveDoms.get(chip.__key);
    if (dom === undefined) {
        dom = chip.createDOM();
        liveDoms.set(chip.__key, dom);
    }
    return dom;
}
const liveDoms = new Map();

function chipFace(dom) {
    const face = dom.children.find((kid) => String(kid.className).indexOf("cm-chip") !== -1 && String(kid.className).split(" ").includes("cm-chip"));
    return face === undefined ? dom.children[0] : face;
}

// ── 1. fold ─────────────────────────────────────────────────────────────────

test("a paste folds the run into ONE inline chip between the text", () => {
    liveDoms.clear();
    const para = resetDocument();
    para.append(new StubTextNode("hi "));
    pasteAndCollapse(para, "L1\nL2\nL3\nL4");
    para.append(new StubTextNode(" tail"));

    const chips = findChips();
    assert.equal(chips.length, 1, "exactly one chip per pasted block");
    const chip = chips[0];

    // The fold hides exactly the pasted run: 4 text leaves + 3 linebreak
    // replacements; "hi " and " tail" stay plain.
    assert.equal(hiddenNodes().length, 7, "four leaves + three break pieces hidden");
    assert.equal(hiddenNodes().some((n) => n.__text === "hi "), false, "the preceding text stays visible");
    assert.equal(hiddenNodes().some((n) => n.__text === " tail"), false, "the following text stays visible");
    const allText = [...nodeMap.values()].filter((n) => n.__type === "text");
    assert.equal(allText.length, 9, "hi + 4 pasted + 3 break pieces + tail");

    // The chip sits in document order AFTER the last hidden leaf and
    // BEFORE the trailing text: textBefore | hidden | chip | textAfter.
    assert.ok(chip.isAttached(), "the chip lives in the document");
    assert.equal(chip.__prev !== chip.__next && chip.__prev !== null, true);
    const prev = nodeMap.get(chip.__prev);
    assert.ok(isHidden(prev), "the node before the chip is a hidden leaf");

    // State fields: the fold marker carries its hidden keys, the label and
    // the collapsed bit.
    assert.equal(chip.__cmCollapsed, true, "folded by default");
    assert.equal(chip.__cmLabel, "11 chars / 4 lines");
    assert.equal(chip.__cmKeys.length, 7, "every hidden leaf key is recorded");
    assert.equal(chip.__cmKeys.every((key) => nodeMap.has(key)), true, "keys resolve to live leaves");

    // The marker contributes NOTHING to the draft text (its text stays in
    // the hidden leaves): the projection stays byte-identical to stock.
    assert.equal(chip.getTextContent(), "");

    const dom = liveChipDom(chip);
    assert.equal(dom.getAttribute("data-collapse-chip"), "1");
    assert.equal(dom.getAttribute("contenteditable"), "false");
});

// ── 2. face anatomy + style (the `@` equality) ───────────────────────────────

test("the pill's DOM face mirrors the composer's `@file` reference-chip face", () => {
    const chip = findChips()[0];
    const dom = liveChipDom(chip);
    const face = chipFace(dom);

    // Reference-chip face anatomy (see ReferenceChip.js in the conversation
    // package): a face pill carrying `title`, an icon slot (`ReferenceIcon`,
    // 14px) and an ellipsized label span, in this order.
    assert.ok(face !== dom, "the host wraps a separate face element (as the @ chip host wraps its face)");
    assert.equal(face.className, "cm-chip");
    assert.equal(face.getAttribute("title"), "11 chars / 4 lines", "full-text tooltip, like the @ chip's title");

    const [icon, label] = face.children;
    assert.equal(icon.getAttribute("class"), "cm-chip-icon", "icon slot");
    assert.equal(icon.attributes["width"], "14", "14px — the ReferenceIcon size");
    assert.equal(icon.attributes["height"], "14");
    assert.equal(icon.attributes["aria-hidden"], "true", "the glyph is decorative");
    assert.equal(label.getAttribute("class"), "cm-chip-label", "label slot");
    assert.equal(label.textContent, "11 chars / 4 lines", "the label is DOM text like the @ chip's filename");

    // The host stays inert: the reference chip keeps its pill visuals on
    // the face, not on the (non-editable) host marker.
    assert.equal(dom.getAttribute("class"), null, "no pill class on the host itself");
});

test("the emitted sheet carries the reference chip's face properties", () => {
    const tag = doc.querySelector('style[data-plugin-css="dsh-collapse-paste/composer.css"]');
    assert.ok(tag !== null, "the composer sheet is injected once");
    const css = tag.textContent;
    // Property-for-property with `ReferenceChip.module.css`'s `.yAWgPa_chip`:
    assert.ok(css.includes("display:inline-flex"), "inline-flex pill");
    assert.ok(css.includes("align-items:center"));
    assert.ok(css.includes("height:22px"), "22px tall");
    assert.ok(css.includes("line-height:22px"));
    assert.ok(css.includes("padding:0 6px"), "6px side padding");
    assert.ok(css.includes("border-radius:6px"), "6px radius");
    assert.ok(css.includes("gap:3px"));
    assert.ok(css.includes("max-width:240px"), "240px cap");
    assert.ok(css.includes("vertical-align:bottom"));
    assert.ok(css.includes("background:var(--dsw-alias-interactive-bg-hover)"), "same fill token as the reference chip");
    assert.ok(css.includes("color:var(--dsw-alias-state-business-primary)"), "same text token as the reference chip");
    assert.ok(css.includes("user-select:none"), "text is not selectable (as the reference chip)");
    assert.ok(css.includes("cursor:default"), "the default caret (as the reference chip)");
    // Roles, also verbatim: icon `flex:none`; ellipsized label.
    assert.ok(css.includes("flex:none"));
    assert.ok(css.includes("text-overflow:ellipsis") && css.includes("white-space:nowrap") && css.includes("overflow:hidden"));
    // No hover background change (the reference chip has none), and the old
    // body-portal badge rules are gone.
    assert.equal(/\.cm-chip:hover/.test(css), false, "no hover affordance beyond the reference chip's");
    assert.equal(css.includes("cm-badge"), false, "the floating-badge rules are gone with the DOM design");
    assert.equal(css.includes("position:fixed"), false, "no fixed placement");
});

// ── 3. interactions ──────────────────────────────────────────────────────────

test("clicking the pill folds and reveals the run (and the face turns per state)", () => {
    const chip = findChips()[0];
    const dom = liveChipDom(chip);
    const face = chipFace(dom);

    // Expand (the run is currently folded).
    dom.fire("click", {});
    chip.updateDOM(dom);
    assert.equal(hiddenNodes().length, 0, "the whole hidden run became visible");
    assert.equal(chip.__cmCollapsed, false);
    assert.equal(face.classList.contains("cm-expanded"), true, "face marks expanded");

    // Collapse again.
    dom.fire("click", {});
    chip.updateDOM(dom);
    assert.equal(hiddenNodes().length, 7, "folded again");
    assert.equal(chip.__cmCollapsed, true);
    assert.equal(face.classList.contains("cm-expanded"), false);
});

test("Backspace/Delete by the pill removes it whole and returns the fold to plain text", () => {
    // Caret immediately AFTER the pill (anchor on the pill's node): the
    // `@` chip behaviour is a whole-chip delete in one keystroke.
    const chip = findChips()[0];
    editor._selection = { anchor: { key: chip.__key, offset: 0 }, focus: { key: chip.__key, offset: 0 } };
    doc.fire("keydown", { key: "Backspace" });

    assert.equal(findChips().length, 0, "the chip is gone as a whole");
    assert.equal(hiddenNodes().length, 0, "no hidden text is left behind");
    const textNodes = [...nodeMap.values()].filter((n) => n.__type === "text");
    assert.equal(textNodes.length, 9, "all nine visible leaves are plain text again");
});

// ── 4. merge ─────────────────────────────────────────────────────────────────

test("a second paste touching the fold keeps ONE merged pill (never orphans the old one)", () => {
    liveDoms.clear();
    const para = resetDocument();
    para.append(new StubTextNode("A"));
    pasteAndCollapse(para, "P1\nP2\nP3\nP4");
    assert.equal(findChips().length, 1);

    // A second block pasted right after the fold touches its end and folds
    // INTO it: one merged marker replaces the old one.
    firePaste("\nQ1\nQ2\nQ3");
    appendPastedBlock(para, "\nQ1\nQ2\nQ3");
    mutate();

    const chips = findChips();
    assert.equal(chips.length, 1, "exactly one chip for the merged run");
    // Merged run text: "P1\nP2\nP3\nP4\nQ1\nQ2\nQ3" = 20 chars across 7 lines.
    assert.equal(findChips()[0].__cmLabel, "20 chars / 7 lines", "the merged label covers both runs");
    assert.equal(hiddenNodes().length, 13, "seven words + six break pieces all hidden");

    // Editing anywhere inside the merged run must expand the WHOLE thing.
    const hidden = hiddenNodes()[0];
    hidden.setTextContent("edited");
    mutate();
    assert.equal(findChips().length, 0, "the merged marker retired");
    assert.equal(hiddenNodes().length, 0, "the whole merged run is plain again");
});

// ── 5. no orphaned hidden text ───────────────────────────────────────────────

test("an externally removed chip (undo) never strands hidden text", () => {
    liveDoms.clear();
    const para = resetDocument();
    para.append(new StubTextNode("B"));
    pasteAndCollapse(para, "U1\nU2\nU3");
    const chip = findChips()[0];
    // Undo removes the chip node but leaves the hidden leaves (what the
    // real undo pass does): the engine must reveal them, never keep a run
    // invisible behind a gone marker.
    chip.remove();
    mutate();

    assert.equal(findChips().length, 0);
    assert.equal(hiddenNodes().length, 0, "no run is left invisible behind a gone chip");

    // And re-collapsing still works after the recovery.
    pasteAndCollapse(para, "R1\nR2\nR3\nR4");
    assert.equal(findChips().length, 1, "the engine is still live");
});

test("the chip DOM face keeps its fields in step after state changes", () => {
    const chip = findChips()[0];
    const dom = liveChipDom(chip);
    const face = chipFace(dom);
    assert.equal(face.getAttribute("title"), "11 chars / 4 lines");
    // Simulate the DOM drifting (the composer's own render pass wiping the
    // face class): the next updateDOM resyncs from the node's own fields.
    face.classList.clear !== undefined ? face.classList.remove("cm-expanded") : void 0;
    chip.__cmCollapsed = false;
    chip.updateDOM(dom);
    assert.equal(face.classList.contains("cm-expanded"), true, "resynced to the node's expanded bit");
    const label = face.children.find((kid) => String(kid.className).indexOf("cm-chip-label") !== -1);
    assert.equal(label !== undefined ? label.textContent : null, "11 chars / 4 lines", "the label stays in step");
});

test("the chip clone keeps the source key (Lexical 0.49 writable-clone contract)", () => {
    liveDoms.clear();
    const para = resetDocument();
    para.append(new StubTextNode("hi "));
    pasteAndCollapse(para, "L1\nL2\nL3\nL4");
    const chip = findChips()[0];
    chip.__cmCollapsed = false;
    // Lexical's `getWritable` clone path calls `clone(node)` then
    // `afterCloneFrom(node)`, which only carries `__parent/__next/__prev` over
    // when the clone has the SAME key. A clone that re-keys the node leaves the
    // chip in the parent's child chain with null links — the live crash:
    // "Minified Lexical error #227/#228" during a later DOM commit.
    const clone = chip.constructor.clone(chip);
    assert.equal(clone.__key, chip.__key, "the clone carries the source key");
    assert.equal(clone.__cmCollapsed, false, "collapsed bit copied");
    assert.deepEqual(clone.__cmKeys, chip.__cmKeys, "hidden-key list copied");
    assert.equal(clone.__cmLabel, chip.__cmLabel, "label copied");
});

test("pasting a multiline block into a FRESH (empty) composer folds", () => {
    liveDoms.clear();
    const para = resetDocument();
    // The primary case: an empty composer, no anchor text before the paste.
    pasteAndCollapse(para, "A1\nA2\nA3\nA4\nA5");
    const chips = findChips();
    assert.equal(chips.length, 1, "exactly one chip for the pasted block");
    assert.equal(chips[0].__cmLabel, "14 chars / 5 lines", "the whole pasted run is the fold");
    assert.equal(hiddenNodes().length, 9, "five lines + four break pieces all hidden");
    assert.equal(chips[0].getTextContent(), "", "the pill contributes nothing to the draft");
});

test("DOM commit updates a chip through the live contract updateDOM(prevNode, dom)", () => {
    liveDoms.clear();
    const para = resetDocument();
    pasteAndCollapse(para, "C1\nC2\nC3\nC4");
    const chip = findChips()[0];
    const dom = liveChipDom(chip);
    chip.__cmCollapsed = false;
    // What the composer's own reconciler actually does (verified against the
    // shipped bundle: `$reconcileNode` → `$updateDOM(next, prev, dom, editor)`
    // → `nextNode.updateDOM(prevNode, dom, config)`) — the FIRST argument is
    // the previous node instance, NOT the DOM element. Treating arg1 as the
    // face crashed every live commit (`host.children.length` over a node =
    // "Cannot read properties of undefined (reading 'length')", the empty-
    // box paste report).
    const prev = chip.constructor.clone(chip);
    assert.equal(chip.updateDOM(prev, dom), false, "the DOM was updated in place");
    const face = chipFace(dom);
    assert.equal(face.classList.contains("cm-expanded"), true, "the face tracks the new node's bit");
    assert.equal(face.getAttribute("title"), "11 chars / 4 lines", "the label stays in step");
    // A node-only sight with no DOM element must report "recreate" (the
    // reconciler will re-create the face via createDOM) instead of throwing.
    assert.equal(chip.updateDOM(prev), true);
});

test("pasting after typed text in the SAME leaf folds just the pasted slice", () => {
    liveDoms.clear();
    const para = resetDocument();
    const anchor = new StubTextNode("hola ");
    para.append(anchor);
    // Live Lexical merges the pasted text into the caret's own leaf; the fold
    // run is then PART of a leaf that also carries non-fold text. The region
    // text/label must cover ONLY the run — a whole-leaf `joined` wrongly
    // widened it, so the next reconcile read the fold as "edited" and quietly
    // retired the chip (the live "no funciona si escribes antes" report).
    firePaste("alpha\nbravo\ncharlie\ndelta");
    anchor.setTextContent("hola alpha\nbravo\ncharlie\ndelta");
    mutate();

    const chips = findChips();
    assert.equal(chips.length, 1, "one chip for the pasted run");
    assert.equal(chips[0].__cmLabel, "25 chars / 4 lines", "the label covers only the folded run, not the anchor");
    assert.equal(hiddenNodes().length, 1, "exactly one hidden piece (the run, split out of the anchor leaf)");

    // The fold must survive the following reconciles (no silent retirement).
    mutate();
    mutate();
    assert.equal(findChips().length, 1, "the fold stays after reconciles");
    assert.equal(hiddenNodes().length, 1);
});
