window.__ModuleLoader__.load({
	id: "dsh-collapse-paste",
	factory: (require) => {
		var module = { exports: {} };
		var exports = module.exports;
		Object.defineProperty(exports, Symbol.toStringTag, { value: "Module" });
"use strict";
var __create = Object.create;
var __defProp = Object.defineProperty;
var __getOwnPropDesc = Object.getOwnPropertyDescriptor;
var __getOwnPropNames = Object.getOwnPropertyNames;
var __getProtoOf = Object.getPrototypeOf;
var __hasOwnProp = Object.prototype.hasOwnProperty;
var __export = (target, all) => {
  for (var name in all)
    __defProp(target, name, { get: all[name], enumerable: true });
};
var __copyProps = (to, from, except, desc) => {
  if (from && typeof from === "object" || typeof from === "function") {
    for (let key of __getOwnPropNames(from))
      if (!__hasOwnProp.call(to, key) && key !== except)
        __defProp(to, key, { get: () => from[key], enumerable: !(desc = __getOwnPropDesc(from, key)) || desc.enumerable });
  }
  return to;
};
var __toESM = (mod, isNodeMode, target) => (target = mod != null ? __create(__getProtoOf(mod)) : {}, __copyProps(
  // If the importer is in node compatibility mode or this is not an ESM
  // file that has been converted to a CommonJS file using a Babel-
  // compatible transform (i.e. "__esModule" has not been set), then set
  // "default" to the CommonJS "module.exports" for node compatibility.
  isNodeMode || !mod || !mod.__esModule ? __defProp(target, "default", { value: mod, enumerable: true }) : target,
  mod
));
var __toCommonJS = (mod) => __copyProps(__defProp({}, "__esModule", { value: true }), mod);

// src/client/index.ts
var index_exports = {};
__export(index_exports, {
  apply: () => apply,
  inject: () => inject
});
module.exports = __toCommonJS(index_exports);

// src/client/plugin-meta.ts
var LOCALE_NAMESPACE = "collapseMultiline";
var PLUGIN_ID = "dsh-collapse-paste";
var inject = ["locale", "slots"];

// src/client/locales/en-US.ts
var en = {
  title: "Collapse multiline paste",
  description: "Compress pasted multiline text in the composer into an expandable 'X chars / Y lines' badge.",
  active: "Active",
  activeHint: "Collapse multiline pastes in the composer. Off keeps stock behaviour.",
  minLines: "Minimum lines",
  minLinesHint: "Pasted text with at least this many lines collapses.",
  minChars: "Minimum chars",
  minCharsHint: "Also require this many characters. 0 means lines only.",
  invalid: "Enter a whole number in range.",
  label: "{chars} chars / {lines} lines",
  expand: "Expand",
  collapse: "Collapse",
  overridden: "Overridden",
  reset: "Reset to default",
  readOnly: "Settings are read-only in this deployment.",
  save: "Save",
  saving: "Saving\u2026",
  discard: "Discard",
  unsaved: "Unsaved",
  statusError: "Error",
  saveFailed: "The deployment did not accept these values; they were left for you to correct."
};

// src/client/locales/zh-CN.ts
var zh = {
  title: "\u6298\u53E0\u591A\u884C\u7C98\u8D34",
  description: "\u5C06\u7C98\u8D34\u7684\u591A\u884C\u6587\u672C\u538B\u7F29\u4E3A\u53EF\u5C55\u5F00\u7684\u300CX \u5B57\u7B26 / Y \u884C\u300D\u5FBD\u7AE0\u3002",
  active: "\u542F\u7528",
  activeHint: "\u6298\u53E0\u7F16\u8F91\u5668\u4E2D\u7C98\u8D34\u7684\u591A\u884C\u6587\u672C\u3002\u5173\u95ED\u5219\u4FDD\u6301\u9ED8\u8BA4\u884C\u4E3A\u3002",
  minLines: "\u6700\u5C11\u884C\u6570",
  minLinesHint: "\u7C98\u8D34\u6587\u672C\u81F3\u5C11\u8FBE\u5230\u6B64\u884C\u6570\u65F6\u6298\u53E0\u3002",
  minChars: "\u6700\u5C11\u5B57\u7B26\u6570",
  minCharsHint: "\u5728\u6B64\u57FA\u7840\u4E0A\u8FD8\u8981\u6C42\u6B64\u5B57\u7B26\u6570\u30020 \u8868\u793A\u53EA\u770B\u884C\u6570\u3002",
  invalid: "\u8BF7\u8F93\u5165\u8303\u56F4\u5185\u7684\u6574\u6570\u3002",
  label: "{chars} \u5B57\u7B26 / {lines} \u884C",
  expand: "\u5C55\u5F00",
  collapse: "\u6298\u53E0",
  overridden: "\u5DF2\u8986\u76D6",
  reset: "\u91CD\u7F6E\u4E3A\u9ED8\u8BA4",
  readOnly: "\u6B64\u90E8\u7F72\u7684\u8BBE\u7F6E\u53EA\u8BFB\u3002",
  save: "\u4FDD\u5B58",
  saving: "\u4FDD\u5B58\u4E2D\u2026",
  discard: "\u653E\u5F03",
  unsaved: "\u672A\u4FDD\u5B58",
  statusError: "\u5F02\u5E38",
  saveFailed: "\u90E8\u7F72\u672A\u63A5\u53D7\u8FD9\u4E9B\u503C\uFF0C\u5DF2\u4FDD\u7559\u4F9B\u4F60\u4FEE\u6B63\u3002"
};

// src/client/locales/index.ts
var DICTIONARIES = { en, zh };

// src/core.ts
var PUA_RE = /[\uE100-\uE11D\uFFFC]/gu;
function sanitize(text) {
  return text.replace(PUA_RE, "");
}
function countLines(text) {
  if (text === "") return 0;
  return text.split("\n").length;
}
function meetsThreshold(text, config) {
  return countLines(text) >= config.minLines && text.length >= config.minChars;
}
function diffPaste(prev, next) {
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
function locateLeaves(texts, start, length) {
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

// src/client/constants.ts
var ROOT_SELECTOR = "[data-composer-input]";
var QUIET_MS = 80;

// src/client/engine/config.ts
var scope = null;
var localeT = null;
function bindScope(next) {
  scope = next;
}
function bindLocale(next) {
  localeT = next;
}
function readConfig() {
  if (scope === null) return null;
  const snapshot = scope.getSnapshot();
  if (snapshot.status !== "ready" || snapshot.value === void 0) return null;
  const v = snapshot.value;
  return {
    active: v.active !== false,
    minLines: typeof v.minLines === "number" && v.minLines >= 1 ? Math.floor(v.minLines) : 3,
    minChars: typeof v.minChars === "number" && v.minChars >= 0 ? Math.floor(v.minChars) : 0
  };
}
function badgeLabel(chars, lines) {
  return localeT === null ? chars + " chars / " + lines + " lines" : localeT("label", { chars, lines });
}

// src/client/engine/chip.ts
var CHIP_TYPE = "cm-collapse";
var CHIP_DOM_ATTR = "data-collapse-chip";
var CHIP_CLASS = "cm-chip";
var CHIP_ICON_CLASS = "cm-chip-icon";
var CHIP_LABEL_CLASS = "cm-chip-label";
var CHIP_EXPANDED_CLASS = "cm-expanded";
var SVG_NS = "http://www.w3.org/2000/svg";
function chipConfig(klass) {
  return {
    klass,
    exportDOM: null,
    replace: null,
    replaceWithKlass: null,
    sharedNodeState: { flatKeys: {}, sharedConfigMap: {} },
    transforms: []
  };
}
var toggle = null;
function setChipToggle(fn) {
  toggle = fn;
}
var registered = /* @__PURE__ */ new WeakMap();
function nodeEntries(map) {
  const out = [];
  const anyMap = map;
  try {
    if (typeof anyMap.entries === "function") {
      for (const entry of anyMap.entries()) out.push([String(entry[0]), entry[1]]);
      return out;
    }
    if (typeof anyMap[Symbol.iterator] === "function") {
      for (const item of anyMap[Symbol.iterator]()) {
        const pair = item;
        if (Array.isArray(pair)) out.push([String(pair[0]), pair[1]]);
      }
      if (out.length > 0) return out;
    }
    if (typeof anyMap.forEach === "function") {
      anyMap.forEach((value, key) => out.push([key, value]));
      return out;
    }
  } catch {
  }
  return out;
}
function ensureChipClass(editor) {
  const seen = registered.get(editor);
  if (seen !== void 0) return seen;
  let Chip = null;
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
function decoratorBase(editor) {
  const entry = editor._nodes.get ? editor._nodes.get("reference-chip") : void 0;
  let klass = entry !== void 0 && entry !== null && typeof entry.klass === "function" ? entry.klass : void 0;
  if (klass === void 0) {
    for (const [type, config] of nodeEntries(editor._nodes)) {
      if (type === "reference-chip" && config !== null && typeof config === "object") {
        const candidate = config.klass;
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
function buildChipClass(base) {
  const Chip = class ChipNodeClass extends base {
    /** Hidden run: the document text-node keys this chip marks. */
    __cmKeys = [];
    /** The pill's label, "N chars / M lines". */
    __cmLabel = "";
    /** True while the run is collapsed. */
    __cmCollapsed = true;
    static getType() {
      return CHIP_TYPE;
    }
    static clone(node) {
      const copy = new ChipNodeClass();
      copy.__key = node.__key;
      copy.__cmKeys = Array.isArray(node.__cmKeys) ? node.__cmKeys.slice() : [];
      copy.__cmLabel = typeof node.__cmLabel === "string" ? node.__cmLabel : "";
      copy.__cmCollapsed = node.__cmCollapsed !== false;
      return copy;
    }
    static importJSON(data) {
      const chip = new ChipNodeClass();
      if (data !== null && data !== void 0) {
        chip.__cmKeys = Array.isArray(data.cmKeys) ? data.cmKeys.filter((key) => typeof key === "string") : [];
        chip.__cmLabel = typeof data.cmLabel === "string" ? data.cmLabel : "";
        chip.__cmCollapsed = data.cmCollapsed !== false;
      }
      return chip;
    }
    exportJSON() {
      return {
        type: CHIP_TYPE,
        version: 1,
        cmKeys: this.__cmKeys.slice(),
        cmLabel: this.__cmLabel,
        cmCollapsed: this.__cmCollapsed
      };
    }
    isInline() {
      return true;
    }
    isKeyboardSelectable() {
      return false;
    }
    getTextContent() {
      return "";
    }
    decorate() {
      return null;
    }
    createDOM() {
      const host = document.createElement("span");
      host.setAttribute(CHIP_DOM_ATTR, "1");
      host.setAttribute("contenteditable", "false");
      const chip = this;
      syncChipDom(host, chip);
      host.addEventListener("click", (event) => {
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
    updateDOM(first, second) {
      const element = domArgument(first, second);
      if (element === null) return true;
      syncChipDom(element, this);
      return false;
    }
  };
  return Chip;
}
function domArgument(a, b) {
  for (const value of b === void 0 ? [a] : [b, a]) {
    if (value !== null && value !== void 0 && typeof value === "object") {
      const candidate = value;
      if (Array.isArray(candidate.children) || typeof candidate.children === "object" && typeof candidate.setAttribute === "function") {
        return value;
      }
    }
  }
  return null;
}
function createGlyph() {
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
function createFace() {
  const face = document.createElement("span");
  face.className = CHIP_CLASS;
  face.appendChild(createGlyph());
  const label = document.createElement("span");
  label.setAttribute("class", CHIP_LABEL_CLASS);
  face.appendChild(label);
  return face;
}
function classNameOf(element) {
  const klass = element.className;
  return typeof klass === "string" ? klass : "";
}
function hasClass(element, cls) {
  const list = element.classList;
  if (list !== void 0 && typeof list.contains === "function") return list.contains(cls) === true;
  return ` ${classNameOf(element)} `.split(" ").includes(cls);
}
function syncChipDom(host, chip) {
  const text = chip.__cmLabel === "" ? "\u25B8" : chip.__cmLabel;
  let face = null;
  for (let i = 0; i < host.children.length; i++) {
    if (hasClass(host.children[i], CHIP_CLASS)) {
      face = host.children[i];
      break;
    }
  }
  if (face === null) {
    face = createFace();
    host.appendChild(face);
  }
  face.setAttribute("title", text);
  let label = null;
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

// src/client/engine/doc.ts
function stateOf(editor) {
  const draft = editor._editorState;
  const state2 = draft !== void 0 ? draft : typeof editor.getEditorState === "function" ? editor.getEditorState() : void 0;
  if (state2 === void 0 || state2 === null || typeof state2._nodeMap === "undefined") return null;
  return state2;
}
function rootNode(state2) {
  const nodes = state2._nodeMap.values();
  for (const node of nodes) if (node.__type === "root") return node;
  return null;
}
function childrenOf(node, state2) {
  if (typeof node.getChildren === "function") {
    try {
      const kids2 = node.getChildren();
      if (Array.isArray(kids2)) return kids2;
    } catch {
    }
  }
  const kids = [];
  let key = typeof node.__first === "string" ? node.__first : null;
  let guard = 0;
  while (key !== null && guard < 1e4) {
    const kid = state2._nodeMap.get(key);
    if (kid === void 0) break;
    kids.push(kid);
    key = typeof kid.__next === "string" ? kid.__next : null;
    guard += 1;
  }
  return kids;
}
function docLeaves(state2) {
  const out = [];
  const walk = (node) => {
    if (node.__type === CHIP_TYPE) return;
    if (typeof node.__text === "string") {
      out.push({ node, text: node.__text });
      return;
    }
    if (node.__type === "linebreak") {
      out.push({ node, text: "\n" });
      return;
    }
    const kids = childrenOf(node, state2);
    if (node.__type === "root") {
      for (let i = 0; i < kids.length; i++) {
        if (i > 0) out.push({ node: null, text: "\n" });
        walk(kids[i]);
      }
      return;
    }
    for (const kid of kids) walk(kid);
  };
  const root = rootNode(state2);
  if (root !== null) walk(root);
  return out;
}
function documentText(state2) {
  let text = "";
  for (const leaf of docLeaves(state2)) text += leaf.text;
  return text;
}
function isHidden(node) {
  if (typeof node.getStyle === "function") {
    try {
      const style2 = node.getStyle();
      if (typeof style2 === "string") return style2.indexOf("display:none") !== -1 || style2.indexOf("display: none") !== -1;
    } catch {
    }
  }
  const style = node.__style;
  if (typeof style === "string") return style.indexOf("display:none") !== -1 || style.indexOf("display: none") !== -1;
  return false;
}
function hideNode(node) {
  if (isHidden(node)) return;
  if (typeof node.setStyle === "function") {
    node.setStyle("display:none");
    return;
  }
  node.__style = "display:none";
}
function showNode(node) {
  if (!isHidden(node)) return;
  if (typeof node.setStyle === "function") {
    node.setStyle("");
    return;
  }
  node.__style = "";
}
function isTextNode(node) {
  return node !== null && typeof node.__text === "string" && typeof node.setTextContent === "function";
}
function hideRange(node, startOffset, endOffset) {
  const full = typeof node.__text === "string" ? node.__text : "";
  const start = startOffset < 0 ? 0 : startOffset > full.length ? full.length : startOffset;
  const end = endOffset < 0 ? 0 : endOffset > full.length ? full.length : endOffset;
  if (end <= start) return [];
  if (start === 0 && end === full.length) {
    hideNode(node);
    return [node];
  }
  const Ctor = node.constructor;
  if (typeof Ctor !== "function") return [];
  if (start > 0 && end < full.length) {
    const mid = new Ctor(full.slice(start, end));
    const tail = new Ctor(full.slice(end));
    node.setTextContent(full.slice(0, start));
    node.insertAfter(mid);
    mid.insertAfter(tail);
    hideNode(mid);
    return [mid];
  }
  if (start > 0) {
    const mid = new Ctor(full.slice(start));
    node.setTextContent(full.slice(0, start));
    node.insertAfter(mid);
    hideNode(mid);
    return [mid];
  }
  const head = new Ctor(full.slice(0, end));
  node.setTextContent(full.slice(end));
  node.insertBefore(head);
  hideNode(head);
  return [head];
}
function hideLineBreak(node, state2) {
  const replacement = textClass(state2);
  if (replacement === null) return [];
  const piece = new replacement("\n");
  hideNode(piece);
  node.insertAfter(piece);
  node.remove();
  return [piece];
}
function textClass(state2) {
  for (const node of state2._nodeMap.values()) {
    if (node.__type === "text") {
      const Ctor = node.constructor;
      if (typeof Ctor === "function") return Ctor;
    }
  }
  return null;
}
function selectAfter(node, state2) {
  const nextKey = typeof node.__next === "string" ? node.__next : null;
  const next = nextKey === null ? void 0 : state2._nodeMap.get(nextKey);
  if (next !== void 0 && typeof next.selectStart === "function") {
    try {
      next.selectStart();
      return;
    } catch {
    }
  }
  const parentKey = typeof node.__parent === "string" ? node.__parent : null;
  const parent = parentKey === null ? void 0 : state2._nodeMap.get(parentKey);
  if (parent !== void 0 && typeof parent.selectEnd === "function") {
    try {
      parent.selectEnd();
    } catch {
    }
  }
}
function isAttached(node, state2) {
  if (typeof node.isAttached === "function") {
    try {
      return node.isAttached() === true;
    } catch {
    }
  }
  const parentKey = typeof node.__parent === "string" ? node.__parent : null;
  if (parentKey === null) return false;
  if (parentKey === "root") return true;
  const parent = state2._nodeMap.get(parentKey);
  if (parent === void 0) return false;
  for (const kid of childrenOf(parent, state2)) if (kid === node) return true;
  return false;
}

// src/client/engine/engine.ts
var state = {
  disposed: false,
  failed: false,
  root: null,
  editor: null,
  chipClass: null,
  /** chip node key → region */
  regions: /* @__PURE__ */ new Map(),
  pending: null,
  quietTimer: null
};
function bindEditor(root) {
  if (state.editor !== null) return true;
  const maybe = root.__lexicalEditor;
  if (maybe === void 0 || maybe === null) return false;
  if (typeof maybe.update !== "function" || typeof maybe._nodes !== "object") return false;
  const chipClass = ensureChipClass(maybe);
  if (chipClass === null) return false;
  state.editor = maybe;
  state.chipClass = chipClass;
  return true;
}
function commitUpdate(editor, callback) {
  const target = editor;
  if (typeof target.update !== "function") return;
  target.update(callback, { discrete: true });
}
function writable(node) {
  const get = node.getWritable;
  if (typeof get === "function") return get.call(node) ?? node;
  return node;
}
function quiet() {
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
    const state2 = stateOf(editor);
    if (state2 === null) return;
    const pending = state.pending;
    if (pending !== null) {
      state.pending = null;
      const config = readConfig();
      if (config !== null && config.active) {
        const current2 = documentText(state2);
        const diff = diffPaste(pending.baseline, current2);
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
function collapse(editor, start, inserted) {
  const chipClass = state.chipClass;
  if (chipClass === null) return;
  commitUpdate(editor, () => {
    const st = stateOf(editor);
    if (st === null) return;
    const leaves = docLeaves(st);
    const texts = [];
    for (const leaf of leaves) texts.push(leaf.text);
    const insertedSpan = locateLeaves(texts, start, inserted.length);
    if (insertedSpan === null) return;
    let runStart = start;
    let runEnd = start + inserted.length;
    const firstKeyOf = (node) => {
      const get = node.getKey;
      return typeof get === "function" ? get.call(node) : "";
    };
    const victims = [];
    for (const region2 of Array.from(state.regions.values())) {
      if (region2.disposed) continue;
      const keysSet = new Set(region2.hiddenKeys);
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
        victims.push(region2);
        continue;
      }
      if (regionEnd >= runStart && regionStart <= runEnd) {
        if (regionStart < runStart) runStart = regionStart;
        if (regionEnd > runEnd) runEnd = regionEnd;
        victims.push(region2);
      }
    }
    const span = locateLeaves(texts, runStart, runEnd - runStart);
    if (span === null) return;
    for (const victim of victims) {
      const victimChip = st._nodeMap.get(victim.chipKey);
      if (victimChip !== void 0 && typeof victimChip.remove === "function") victimChip.remove();
      destroyRegion(victim);
    }
    const hiddenKeys = [];
    let lastHidden = null;
    for (let i = span.first; i <= span.last; i++) {
      const leaf = leaves[i];
      const node = leaf.node;
      const isLast = i === span.last;
      const localStart = i === span.first ? span.startOffset : 0;
      const localEnd = isLast ? span.endOffset : leaf.text.length;
      if (node === null) {
        continue;
      }
      if (node.__type === "linebreak") {
        const pieces2 = hideLineBreak(node, st);
        for (const piece of pieces2) hiddenKeys.push(firstKeyOf(piece));
        if (pieces2.length > 0) lastHidden = pieces2[pieces2.length - 1];
        continue;
      }
      if (!isTextNode(node)) continue;
      const pieces = hideRange(node, localStart, localEnd);
      for (const piece of pieces) hiddenKeys.push(firstKeyOf(piece));
      if (pieces.length > 0) lastHidden = pieces[pieces.length - 1];
    }
    if (hiddenKeys.length === 0) return;
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
    const chip = new chipClass();
    chip.__cmKeys = hiddenKeys;
    chip.__cmLabel = badgeLabel(joined.length, countLinesFrom(joined));
    if (lastHidden !== null && typeof lastHidden.insertAfter === "function") {
      lastHidden.insertAfter(chip);
    }
    const region = {
      chipKey: chip.getKey(),
      hiddenKeys,
      text: joined,
      collapsed: true,
      disposed: false
    };
    state.regions.set(region.chipKey, region);
    selectAfter(chip, st);
  });
}
function countLinesFrom(text) {
  if (text === "") return 0;
  return text.split("\n").length;
}
function reconcile(editor) {
  commitUpdate(editor, () => {
    const st = stateOf(editor);
    if (st === null) return;
    const firstKeyOf = (node) => typeof node.getKey === "function" ? node.getKey.call(node) : "";
    for (const node of st._nodeMap.values()) {
      if (node.__type !== CHIP_TYPE) continue;
      const key = firstKeyOf(node);
      if (key === "" || state.regions.has(key)) continue;
      if (!isAttached(node, st)) continue;
      const keys = Array.isArray(node.__cmKeys) ? node.__cmKeys : [];
      if (keys.length === 0) {
        if (typeof node.remove === "function") node.remove();
        continue;
      }
      let joined = "";
      const live = [];
      for (const k of keys) {
        const n = st._nodeMap.get(k);
        if (n !== void 0 && typeof n.__text === "string") {
          live.push(k);
          joined += n.__text;
        }
      }
      if (live.length === 0) {
        if (typeof node.remove === "function") node.remove();
        continue;
      }
      state.regions.set(key, { chipKey: key, hiddenKeys: live, text: joined, collapsed: node.__cmCollapsed !== false, disposed: false });
    }
    for (const [chipKey, region] of Array.from(state.regions.entries())) {
      if (region.disposed) {
        state.regions.delete(chipKey);
        continue;
      }
      const chip = st._nodeMap.get(chipKey);
      if (chip === void 0 || !isAttached(chip, st)) {
        for (const k of region.hiddenKeys) {
          const n = st._nodeMap.get(k);
          if (n !== void 0) showNode(n);
        }
        state.regions.delete(chipKey);
        continue;
      }
      const nodes = [];
      let joined = "";
      const liveKeys = [];
      for (const k of region.hiddenKeys) {
        const n = st._nodeMap.get(k);
        if (n !== void 0 && typeof n.__text === "string") {
          nodes.push(n);
          liveKeys.push(k);
          joined += n.__text;
        }
      }
      if (liveKeys.length === 0) {
        if (typeof chip.remove === "function") chip.remove();
        state.regions.delete(chipKey);
        continue;
      }
      if (joined !== region.text) {
        for (const n of nodes) showNode(n);
        if (typeof chip.remove === "function") chip.remove();
        state.regions.delete(chipKey);
        continue;
      }
      if (region.collapsed) {
        for (const n of nodes) if (!isHidden(n)) hideNode(n);
        if (chip.__cmCollapsed !== true) {
          writable(chip).__cmCollapsed = true;
        }
      } else {
        for (const n of nodes) if (isHidden(n)) showNode(n);
        if (chip.__cmCollapsed === true) {
          writable(chip).__cmCollapsed = false;
        }
      }
    }
  });
}
function destroyRegion(region) {
  if (region.disposed) return;
  region.disposed = true;
  if (region.chipKey !== "" && state.regions.get(region.chipKey) === region) {
    state.regions.delete(region.chipKey);
  }
}
function toggleChip(chip) {
  if (state.disposed || state.failed) return;
  const editor = state.editor;
  if (editor === null) return;
  try {
    commitUpdate(editor, () => {
      const st = stateOf(editor);
      if (st === null) return;
      const key = typeof chip.getKey === "function" ? chip.getKey.call(chip) : "";
      const live = key === "" ? chip : st._nodeMap.get(key);
      if (live === void 0) return;
      const region = state.regions.get(key);
      const collapsed = region !== void 0 ? region.collapsed : live.__cmCollapsed === true;
      const nextCollapsed = !collapsed;
      const keys = region !== void 0 ? region.hiddenKeys : Array.isArray(live.__cmKeys) ? live.__cmKeys : [];
      for (const k of keys) {
        const n = st._nodeMap.get(k);
        if (n === void 0) continue;
        if (nextCollapsed) hideNode(n);
        else showNode(n);
      }
      const face = writable(live);
      face.__cmCollapsed = nextCollapsed;
      if (region !== void 0) region.collapsed = nextCollapsed;
    });
  } catch (error) {
    failOpen(error);
  }
}
function onKeyDown(event) {
  if (state.disposed || state.failed || state.regions.size === 0) return;
  if (event.key !== "Backspace" && event.key !== "Delete") return;
  const editor = state.editor;
  if (editor === null) return;
  const st = stateOf(editor);
  if (st === null) return;
  const selection = typeof editor.getSelection === "function" ? editor.getSelection() : null;
  const anchor = selection?.anchor;
  if (anchor === void 0) return;
  const focus = selection?.focus;
  if (focus === void 0) return;
  if (anchor.key !== focus.key || anchor.offset !== focus.offset) return;
  const anchorKey = String(anchor.key);
  const anchorOffset = Number(anchor.offset) || 0;
  let adjacentChip = null;
  if (state.regions.has(anchorKey)) {
    adjacentChip = anchorKey;
  } else {
    const anchorNode = st._nodeMap.get(anchorKey);
    if (anchorNode === void 0 || typeof anchorNode.__text !== "string") return;
    const prevKey = typeof anchorNode.__prev === "string" ? anchorNode.__prev : null;
    const nextKey = typeof anchorNode.__next === "string" ? anchorNode.__next : null;
    const textLen = anchorNode.__text.length;
    if (event.key === "Backspace" && anchorOffset === 0 && prevKey !== null && state.regions.has(prevKey)) adjacentChip = prevKey;
    else if (event.key === "Delete" && anchorOffset === textLen && nextKey !== null && state.regions.has(nextKey)) adjacentChip = nextKey;
  }
  if (adjacentChip === null) return;
  const region = state.regions.get(adjacentChip);
  if (region === void 0) return;
  event.preventDefault();
  commitUpdate(editor, () => {
    const st2 = stateOf(editor);
    if (st2 === null) return;
    for (const k of region.hiddenKeys) {
      const n = st2._nodeMap.get(k);
      if (n !== void 0) showNode(n);
    }
    const chip = st2._nodeMap.get(region.chipKey);
    if (chip !== void 0 && typeof chip.remove === "function") chip.remove();
  });
  destroyRegion(region);
}
function onPasteCapture(event) {
  if (state.disposed || state.failed || state.root === null) return;
  const target = event.target;
  if (target === null || typeof target.contains !== "function") return;
  if (!state.root.contains(target)) return;
  const data = event.clipboardData;
  if (data === null || data === void 0) return;
  const raw = data.getData("text/plain");
  if (raw === "") return;
  const clean = sanitize(raw);
  if (clean === "") return;
  const config = readConfig();
  if (config === null || !config.active || !meetsThreshold(clean, config)) return;
  const st = stateOf(state.root.__lexicalEditor);
  const baseline = st === null ? "" : documentText(st);
  state.pending = { baseline, clean };
}
function onComposerMountChanges(mutations) {
  if (state.disposed || state.failed) return;
  for (const m of mutations) {
    for (let a = 0; a < m.addedNodes.length; a++) {
      const n = m.addedNodes[a];
      if (n.nodeType !== 1) continue;
      const el = n;
      let root = el.matches !== void 0 && el.matches(ROOT_SELECTOR) ? el : null;
      if (root === null && el.querySelector !== void 0) root = el.querySelector(ROOT_SELECTOR);
      if (root !== null && root !== state.root) {
        attachRoot(root);
        return;
      }
    }
    for (let r = 0; r < m.removedNodes.length; r++) {
      if (m.removedNodes[r] === state.root) {
        detachRoot();
        return;
      }
    }
  }
}
var rootObserver = new MutationObserver(onMutations);
var bodyObserver = new MutationObserver((mutations) => onComposerMountChanges(mutations));
function attachRoot(root) {
  if (state.disposed || state.failed) return;
  detachRoot();
  state.root = root;
  state.editor = null;
  state.chipClass = null;
  rootObserver.observe(root, { childList: true, characterData: true, subtree: true, attributes: true });
}
function detachRoot() {
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
function onMutations() {
  if (state.disposed || state.quietTimer !== null) return;
  state.quietTimer = setTimeout(quiet, QUIET_MS);
}
function failOpen(error) {
  if (state.failed) return;
  state.failed = true;
  try {
    console.warn("[dsh-collapse-multiline-paste] going inert:", error);
  } catch (ignored) {
  }
  dispose();
}
function dispose() {
  if (state.disposed) return;
  state.disposed = true;
  detachRoot();
  bodyObserver.disconnect();
  document.removeEventListener("paste", onPasteCapture, true);
  document.removeEventListener("keydown", onKeyDown, true);
}
function arm() {
  if (state.disposed || state.failed) return;
  setChipToggle(toggleChip);
  document.addEventListener("paste", onPasteCapture, true);
  document.addEventListener("keydown", onKeyDown, true);
  bodyObserver.observe(document.body, { childList: true, subtree: true });
  const existing = document.querySelector(ROOT_SELECTOR);
  if (existing !== null) attachRoot(existing);
}

// src/client/settings.ts
var CONFIG_DEFAULTS = {
  active: true,
  minLines: 3,
  minChars: 0,
  foldSent: true,
  sentMinChars: 600,
  sentMinLines: 12
};
var STORAGE_KEY = "dsh-collapse-paste.config.v1";
var listeners = /* @__PURE__ */ new Set();
function intOf(value, fallback, min, max) {
  const n = typeof value === "number" ? value : Number(value);
  if (!Number.isFinite(n)) return fallback;
  return Math.min(max, Math.max(min, Math.floor(n)));
}
function normalize(value) {
  const v = value || {};
  return {
    active: v.active !== false,
    minLines: intOf(v.minLines, CONFIG_DEFAULTS.minLines, 1, 100),
    minChars: intOf(v.minChars, CONFIG_DEFAULTS.minChars, 0, 1e5),
    foldSent: v.foldSent !== false,
    sentMinChars: intOf(v.sentMinChars, CONFIG_DEFAULTS.sentMinChars, 0, 1e6),
    sentMinLines: intOf(v.sentMinLines, CONFIG_DEFAULTS.sentMinLines, 1, 1e5)
  };
}
function load() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw === null) return { ...CONFIG_DEFAULTS };
    return normalize(JSON.parse(raw));
  } catch {
    return { ...CONFIG_DEFAULTS };
  }
}
var current = load();
function getConfig() {
  return current;
}
function setConfig(patch) {
  current = normalize({ ...current, ...patch });
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(current));
  } catch {
  }
  for (const listener of listeners) {
    try {
      listener();
    } catch {
    }
  }
  return current;
}
function resetConfig() {
  return setConfig(CONFIG_DEFAULTS);
}
function subscribeConfig(listener) {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

// src/client/settings-page.ts
var React = __toESM(require("react"), 1);
var h = React.createElement;
function isZh() {
  try {
    return String(document.documentElement.lang || navigator.language || "").toLowerCase().startsWith("zh");
  } catch {
    return false;
  }
}
function field(label, hint, control) {
  return h(
    "label",
    {
      style: {
        display: "flex",
        alignItems: "center",
        justifyContent: "space-between",
        gap: "16px",
        padding: "10px 12px",
        border: "1px solid var(--dsw-alias-border-l1)",
        borderRadius: "10px",
        background: "var(--dsw-alias-bg-layer-1)"
      }
    },
    h(
      "span",
      { style: { display: "flex", flexDirection: "column", gap: "2px" } },
      h("span", { style: { fontSize: "14px" } }, label),
      hint ? h("span", { style: { fontSize: "12px", color: "var(--dsw-alias-label-secondary)" } }, hint) : null
    ),
    control
  );
}
function numberInput(value, min, max, onChange) {
  return h("input", {
    type: "number",
    min,
    max,
    value: String(value),
    onChange: (event) => {
      const next = Number(event.target.value);
      if (Number.isFinite(next)) onChange(next);
    },
    style: {
      width: "88px",
      padding: "5px 8px",
      border: "1px solid var(--dsw-alias-border-l1)",
      borderRadius: "8px",
      background: "var(--dsw-alias-bg-layer-2)",
      color: "var(--dsw-alias-label-primary)",
      fontSize: "13px"
    }
  });
}
function checkbox(value, onChange) {
  return h("input", {
    type: "checkbox",
    checked: value,
    onChange: (event) => onChange(event.target.checked),
    style: { width: "18px", height: "18px", accentColor: "var(--dsw-alias-brand-primary)" }
  });
}
function SettingsPage() {
  const z = isZh();
  const [draft, setDraft] = React.useState(() => ({ ...getConfig() }));
  const [saved, setSaved] = React.useState(false);
  const set = (key, value) => {
    setDraft((prev) => ({ ...prev, [key]: value }));
    setSaved(false);
  };
  const save = () => {
    setConfig(draft);
    setSaved(true);
    setTimeout(() => setSaved(false), 1500);
  };
  const reset = () => {
    const next = resetConfig();
    setDraft({ ...next });
    setSaved(true);
    setTimeout(() => setSaved(false), 1500);
  };
  return h(
    "div",
    { style: { display: "flex", flexDirection: "column", gap: "12px", maxWidth: "560px", padding: "4px 0" } },
    h(
      "p",
      { style: { margin: 0, fontSize: "13px", color: "var(--dsw-alias-label-secondary)" } },
      z ? "\u8F93\u5165\u6846\u7C98\u8D34\u6298\u53E0\u4E0E\u53D1\u9001\u540E\u6D88\u606F\u6298\u53E0\u7684\u9608\u503C\u3002\u8BBE\u7F6E\u4FDD\u5B58\u5728\u5F53\u524D\u6D4F\u89C8\u5668\uFF08localStorage\uFF09\uFF0C\u4FDD\u5B58\u540E\u7ACB\u5373\u751F\u6548\u3002" : "Thresholds for composer paste folding and sent-message folding. Settings live in this browser (localStorage) and apply immediately."
    ),
    field(z ? "\u542F\u7528\u8F93\u5165\u6846\u6298\u53E0" : "Enable composer folding", "", checkbox(draft.active, (v) => set("active", v))),
    field(
      z ? "\u8F93\u5165\u6846\uFF1A\u6700\u5C0F\u884C\u6570" : "Composer: minimum lines",
      z ? "\u7C98\u8D34\u81F3\u5C11\u8FD9\u4E48\u591A\u884C\u624D\u6298\u53E0" : "A paste needs at least this many lines to fold",
      numberInput(draft.minLines, 1, 100, (v) => set("minLines", v))
    ),
    field(
      z ? "\u8F93\u5165\u6846\uFF1A\u6700\u5C0F\u5B57\u7B26\u6570" : "Composer: minimum characters",
      z ? "0 \u8868\u793A\u53EA\u770B\u884C\u6570" : "0 means lines only",
      numberInput(draft.minChars, 0, 1e5, (v) => set("minChars", v))
    ),
    field(
      z ? "\u53D1\u9001\u540E\u6298\u53E0\u957F\u6D88\u606F" : "Fold long sent messages",
      "",
      checkbox(draft.foldSent, (v) => set("foldSent", v))
    ),
    field(
      z ? "\u6D88\u606F\u6298\u53E0\uFF1A\u6700\u5C0F\u5B57\u7B26\u6570" : "Message fold: minimum characters",
      "",
      numberInput(draft.sentMinChars, 0, 1e6, (v) => set("sentMinChars", v))
    ),
    field(
      z ? "\u6D88\u606F\u6298\u53E0\uFF1A\u6700\u5C0F\u884C\u6570" : "Message fold: minimum lines",
      "",
      numberInput(draft.sentMinLines, 1, 1e5, (v) => set("sentMinLines", v))
    ),
    h(
      "div",
      { style: { display: "flex", alignItems: "center", gap: "10px", paddingTop: "2px" } },
      h(
        "button",
        {
          type: "button",
          onClick: save,
          style: {
            height: "32px",
            padding: "0 16px",
            border: "1px solid var(--dsw-alias-brand-primary)",
            borderRadius: "8px",
            background: "var(--dsw-alias-brand-primary)",
            color: "#fff",
            fontSize: "13px",
            cursor: "pointer"
          }
        },
        z ? "\u4FDD\u5B58" : "Save"
      ),
      h(
        "button",
        {
          type: "button",
          onClick: reset,
          style: {
            height: "32px",
            padding: "0 14px",
            border: "1px solid var(--dsw-alias-border-l1)",
            borderRadius: "8px",
            background: "transparent",
            color: "var(--dsw-alias-label-secondary)",
            fontSize: "13px",
            cursor: "pointer"
          }
        },
        z ? "\u6062\u590D\u9ED8\u8BA4" : "Reset to defaults"
      ),
      saved ? h("span", { style: { fontSize: "12px", color: "var(--dsw-alias-state-success-primary)" } }, z ? "\u5DF2\u4FDD\u5B58" : "Saved") : null
    )
  );
}

// src/client/styles/composer.ts
var COMPOSER_CSS = ".cm-chip{vertical-align:bottom;background:var(--dsw-alias-interactive-bg-hover);max-width:240px;height:22px;color:var(--dsw-alias-state-business-primary);user-select:none;cursor:default;border-radius:6px;align-items:center;gap:3px;padding:0 6px;line-height:22px;display:inline-flex}.cm-chip-icon{flex:none;display:inline-flex;align-items:center;transition:transform .12s ease}.cm-chip-label{text-overflow:ellipsis;white-space:nowrap;overflow:hidden}.cm-chip.cm-expanded .cm-chip-icon{transform:rotate(90deg)}";
var TAG_ID = `${PLUGIN_ID}/composer.css`;
function ensureComposerStyles() {
  if (typeof document === "undefined") return;
  if (document.querySelector(`style[data-plugin-css="${TAG_ID}"]`) !== null) return;
  const tag = document.createElement("style");
  tag.dataset.plugin = PLUGIN_ID;
  tag.dataset.pluginCss = TAG_ID;
  tag.textContent = COMPOSER_CSS;
  document.head.appendChild(tag);
}

// src/client/fold/transcript.ts
var ROW_SELECTOR = '[data-chat-flow-kind="user"], [data-chat-flow-kind="steering"]';
var CARD_ATTR = "data-cp-fold-card";
function runsOf(row) {
  const out = [];
  for (const child of Array.from(row.children)) {
    if (child instanceof HTMLElement && !child.hasAttribute(CARD_ATTR)) out.push(child);
  }
  return out;
}
function measure(row) {
  const runs = runsOf(row);
  let text = "";
  for (const run of runs) {
    const part = run.textContent || "";
    text += (text === "" ? "" : "\n") + part;
  }
  return {
    runs,
    text,
    chars: text.length,
    lines: text === "" ? 0 : text.split("\n").length
  };
}
function isZh2() {
  try {
    return String(document.documentElement.lang || navigator.language || "").toLowerCase().startsWith("zh");
  } catch {
    return false;
  }
}
function fmt(n) {
  try {
    return n.toLocaleString(isZh2() ? "zh-CN" : "en-US");
  } catch {
    return String(n);
  }
}
function labelOf(chars, lines) {
  return isZh2() ? fmt(chars) + " \u5B57\u7B26 / " + fmt(lines) + " \u884C" : fmt(chars) + " chars / " + fmt(lines) + " lines";
}
function setText(el, value) {
  if (el.textContent !== value) el.textContent = value;
}
function installTranscriptFold() {
  const expandedByKey = /* @__PURE__ */ new Map();
  const states = /* @__PURE__ */ new WeakMap();
  let timer = null;
  let disposed = false;
  const style = document.createElement("style");
  style.dataset.plugin = "dsh-collapse-paste";
  style.textContent = [
    ".cp-fold{display:flex;align-items:center;justify-content:flex-end;gap:8px;width:100%;margin:6px 0 10px;max-width:100%;}",
    ".cp-fold-pill{display:inline-flex;align-items:center;gap:8px;height:38px;max-width:100%;padding:0 16px;border:1px solid var(--dsw-alias-brand-primary);border-radius:999px;background:var(--dsw-alias-brand-primary);color:#fff;font-size:inherit;line-height:1;cursor:pointer;}",
    ".cp-fold-pill:hover{border-color:var(--dsw-alias-brand-primary);color:#fff;filter:brightness(.94);}",
    ".cp-fold-chev{display:inline-block;flex:none;font-size:1.15em;transition:transform .15s ease;}",
    '.cp-fold[data-expanded="1"] .cp-fold-chev{transform:rotate(90deg);}',
    ".cp-fold-end{margin-top:8px;}",
    ".cp-fold-end .cp-fold-chev{transform:rotate(-90deg);}",
    ".cp-fold-label{white-space:nowrap;overflow:hidden;text-overflow:ellipsis;}",
    ".cp-fold-hint{flex:none;opacity:.82;white-space:nowrap;}",
    ".cp-fold-copy{flex:none;height:38px;padding:0 14px;border:1px solid var(--dsw-alias-brand-primary);border-radius:999px;background:transparent;color:var(--dsw-alias-brand-primary);font-size:inherit;line-height:1;cursor:pointer;}",
    ".cp-fold-copy:hover{background:var(--dsw-alias-brand-primary);color:#fff;}"
  ].join("");
  document.head.appendChild(style);
  function hideRuns(row) {
    for (const run of runsOf(row)) {
      if (run.style.display !== "none") {
        run.setAttribute("data-cp-display", run.style.display || "");
        run.style.display = "none";
      }
    }
  }
  function showRuns(row) {
    for (const run of runsOf(row)) {
      const previous = run.getAttribute("data-cp-display");
      if (previous !== null) {
        run.style.display = previous;
        run.removeAttribute("data-cp-display");
      }
    }
  }
  function setExpanded(row, st, expanded) {
    if (expanded) showRuns(row);
    else hideRuns(row);
    st.expanded = expanded;
    if (expanded) {
      if (st.endCard.parentNode !== row) row.appendChild(st.endCard);
    } else if (st.endCard.parentNode === row) {
      row.removeChild(st.endCard);
    }
    st.card.setAttribute("data-expanded", expanded ? "1" : "0");
    st.pill.setAttribute("aria-expanded", expanded ? "true" : "false");
    setText(st.label, labelOf(st.chars, st.lines));
    setText(st.hint, expanded ? isZh2() ? "\u70B9\u51FB\u6536\u8D77" : "Click to collapse" : isZh2() ? "\u70B9\u51FB\u5C55\u5F00" : "Click to expand");
  }
  function buildCards(row) {
    const card = document.createElement("div");
    card.className = "cp-fold";
    card.setAttribute(CARD_ATTR, "1");
    card.setAttribute("data-expanded", "0");
    const pill = document.createElement("button");
    pill.type = "button";
    pill.className = "cp-fold-pill";
    const chev = document.createElement("span");
    chev.className = "cp-fold-chev";
    chev.textContent = "\u203A";
    const label = document.createElement("span");
    label.className = "cp-fold-label";
    const hint = document.createElement("span");
    hint.className = "cp-fold-hint";
    pill.appendChild(chev);
    pill.appendChild(label);
    pill.appendChild(hint);
    const copy = document.createElement("button");
    copy.type = "button";
    copy.className = "cp-fold-copy";
    copy.textContent = isZh2() ? "\u590D\u5236" : "Copy";
    card.appendChild(pill);
    card.appendChild(copy);
    const endCard = document.createElement("div");
    endCard.className = "cp-fold cp-fold-end";
    endCard.setAttribute(CARD_ATTR, "1");
    const endPill = document.createElement("button");
    endPill.type = "button";
    endPill.className = "cp-fold-pill";
    const endChev = document.createElement("span");
    endChev.className = "cp-fold-chev";
    endChev.textContent = "\u203A";
    const endLabel = document.createElement("span");
    endLabel.className = "cp-fold-label";
    endLabel.textContent = isZh2() ? "\u70B9\u51FB\u6536\u8D77" : "Click to collapse";
    endPill.appendChild(endChev);
    endPill.appendChild(endLabel);
    endCard.appendChild(endPill);
    const st = {
      card,
      pill,
      label,
      hint,
      copy,
      endCard,
      endPill,
      expanded: false,
      stamp: "",
      text: "",
      chars: 0,
      lines: 0
    };
    states.set(row, st);
    pill.addEventListener("click", (event) => {
      event.preventDefault();
      event.stopPropagation();
      const key = row.getAttribute("data-chat-flow-key") || "";
      setExpanded(row, st, !st.expanded);
      if (key !== "") expandedByKey.set(key, st.expanded);
    });
    endPill.addEventListener("click", (event) => {
      event.preventDefault();
      event.stopPropagation();
      const key = row.getAttribute("data-chat-flow-key") || "";
      setExpanded(row, st, false);
      if (key !== "") expandedByKey.set(key, false);
      try {
        st.card.scrollIntoView({ block: "nearest", inline: "nearest" });
      } catch {
      }
    });
    copy.addEventListener("click", (event) => {
      event.preventDefault();
      event.stopPropagation();
      try {
        void navigator.clipboard.writeText(st.text).then(() => {
          setText(copy, isZh2() ? "\u5DF2\u590D\u5236" : "Copied");
          setTimeout(() => setText(copy, isZh2() ? "\u590D\u5236" : "Copy"), 1200);
        }, () => {
        });
      } catch {
      }
    });
    row.insertBefore(card, row.firstChild);
    return st;
  }
  function removeCards(row, st) {
    showRuns(row);
    if (st.card.parentNode === row) row.removeChild(st.card);
    if (st.endCard.parentNode === row) row.removeChild(st.endCard);
    states.delete(row);
  }
  function scan() {
    timer = null;
    if (disposed) return;
    let rows;
    try {
      rows = document.querySelectorAll(ROW_SELECTOR);
    } catch {
      return;
    }
    for (const row of Array.from(rows)) {
      if (!(row instanceof HTMLElement)) continue;
      if (row.closest("[hidden]") !== null) continue;
      const config = getConfig();
      let st = states.get(row);
      if (st && st.card.parentNode !== row) {
        states.delete(row);
        st = void 0;
      }
      const m = measure(row);
      if (st && st.stamp !== m.text) {
        removeCards(row, st);
        st = void 0;
      }
      if (!config.foldSent) {
        if (st) removeCards(row, st);
        continue;
      }
      if (m.chars < config.sentMinChars && m.lines < config.sentMinLines) {
        if (st) removeCards(row, st);
        continue;
      }
      const state2 = st || buildCards(row);
      state2.stamp = m.text;
      state2.text = m.text;
      state2.chars = m.chars;
      state2.lines = m.lines;
      const key = row.getAttribute("data-chat-flow-key") || "";
      const expanded = key !== "" && expandedByKey.get(key) === true;
      setExpanded(row, state2, expanded);
      if (key !== "") expandedByKey.set(key, state2.expanded);
    }
  }
  function schedule() {
    if (disposed) return;
    if (timer !== null) clearTimeout(timer);
    timer = setTimeout(scan, 180);
  }
  const observer = new MutationObserver(() => schedule());
  try {
    observer.observe(document.body, { childList: true, subtree: true, characterData: true });
  } catch {
  }
  const unsubscribeConfig = subscribeConfig(() => schedule());
  schedule();
  return () => {
    disposed = true;
    if (timer !== null) clearTimeout(timer);
    timer = null;
    try {
      observer.disconnect();
    } catch {
    }
    try {
      unsubscribeConfig();
    } catch {
    }
    try {
      style.remove();
    } catch {
    }
    for (const card of Array.from(document.querySelectorAll("[" + CARD_ATTR + "]"))) {
      const row = card.parentElement;
      if (!row) continue;
      const st = states.get(row);
      if (st) removeCards(row, st);
    }
  };
}

// src/client/apply.ts
var LOCAL_SCOPE = {
  getSnapshot: () => ({
    status: "ready",
    value: getConfig(),
    writable: false
  }),
  subscribe: () => () => {
  },
  set: async () => {
  },
  unset: async () => {
  }
};
function isZh3() {
  try {
    return String(document.documentElement.lang || navigator.language || "").toLowerCase().startsWith("zh");
  } catch {
    return false;
  }
}
function apply(ctx) {
  try {
    ensureComposerStyles();
    ctx.effect(() => ctx.locale.register(LOCALE_NAMESPACE, DICTIONARIES), "collapse-multiline: dictionaries");
    bindLocale(ctx.locale.bind(LOCALE_NAMESPACE));
    bindScope(LOCAL_SCOPE);
    ctx.effect(() => {
      arm();
      return () => dispose();
    }, "collapse-multiline: DOM engine");
    ctx.effect(() => installTranscriptFold(), "collapse-paste: transcript fold");
    ctx.slots.inject(
      "settings.section",
      () => ctx.slots.register(
        {
          name: "settings.section",
          id: "collapse-paste",
          order: 35,
          label: () => isZh3() ? "\u6298\u53E0\u591A\u884C\u7C98\u8D34" : "Collapse paste"
        },
        SettingsPage
      )
    );
    window.__DSH_COLLAPSE_PASTE__ = {
      version: "0.2.0",
      armed: true
    };
    console.info("[collapse-paste] armed");
  } catch (error) {
    window.__DSH_COLLAPSE_PASTE__ = {
      version: "0.2.0",
      armed: false,
      error: String(error)
    };
    console.error("[collapse-paste] disabled:", error);
  }
}
	return module.exports;
	}
});
//# sourceMappingURL=client.js.map
