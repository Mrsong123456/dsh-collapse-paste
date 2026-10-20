/**
 * Sent-message folding — display-only transcript decoration.
 *
 * A long user message (or steering row) is rendered as one pill plus a copy
 * button; clicking the pill reveals the original message, and a second pill
 * at the END of the expanded message collapses it again without scrolling
 * back to the top. The stored message, the serialized prompt and the model
 * input are never touched, and assistant messages are left alone.
 *
 * The transcript is React-owned DOM, so this module only decorates existing
 * rows: it tags the row's direct children as hidden, inserts its own cards,
 * and removes every change on dispose. A MutationObserver re-applies the
 * decoration after virtualized re-renders (scroll, session switch, new turn).
 *
 * Thresholds and the on/off switch come from the browser settings store, so a
 * saved Settings change applies on the next scan without a reload.
 */
import { getConfig, subscribeConfig } from "../settings.js";

/** Rows this module folds: the user's own text and steering rows. */
const ROW_SELECTOR = '[data-chat-flow-kind="user"], [data-chat-flow-kind="steering"]';

/** Mark our own cards so row measurement and hiding never touch them. */
const CARD_ATTR = "data-cp-fold-card";

/** One folded row's DOM handles and last measured content. */
interface FoldState {
    card: HTMLElement;
    pill: HTMLButtonElement;
    label: HTMLElement;
    hint: HTMLElement;
    copy: HTMLButtonElement;
    endCard: HTMLElement;
    endPill: HTMLButtonElement;
    expanded: boolean;
    stamp: string;
    text: string;
    chars: number;
    lines: number;
    /** Nodes this row currently hides (content only, never the actions row). */
    hidden: HTMLElement[];
}

/** The direct children of a row except our own cards. */
function runsOf(row: HTMLElement): HTMLElement[] {
    const out: HTMLElement[] = [];
    for (const child of Array.from(row.children)) {
        if (child instanceof HTMLElement && !child.hasAttribute(CARD_ATTR)) out.push(child);
    }
    return out;
}

/**
 * The bubble body inside one user row, excluding the actions row (time and
 * copy/edit/delete buttons) that sits beside it in DSH's `userRow` stack.
 * The class prefix is hash-generated but the `userStack` suffix is stable in
 * the shipped CSS module; a miss falls back to measured direct children.
 */
function contentOf(row: HTMLElement): HTMLElement | null {
    const stack = row.querySelector<HTMLElement>('[class*="userStack"]');
    return stack instanceof HTMLElement ? stack : null;
}

/**
 * Text nodes of one subtree, skipping interactive/chrome elements.
 *
 * `textContent` would also collect the label of any button inside the
 * rendered body (a code block's copy control, for example), which would
 * pollute the folded copy and the char/line count. Walking text nodes and
 * rejecting controls keeps only the message prose.
 */
function textOf(root: HTMLElement): string {
    let out = "";
    try {
        const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT);
        let node = walker.nextNode();
        while (node !== null) {
            const parent = node.parentElement;
            if (parent !== null && parent.closest("button, [role='button'], svg, script, style, noscript") === null) {
                out += node.nodeValue || "";
            }
            node = walker.nextNode();
        }
    } catch {
        return root.textContent || "";
    }
    return out;
}

/** Plain text of the message body only (never the action labels/time). */
function measure(row: HTMLElement): { text: string; chars: number; lines: number } {
    const content = contentOf(row);
    let text = "";
    if (content !== null) {
        text = textOf(content);
    } else {
        for (const run of runsOf(row)) {
            if (run.matches("button, time, [role='button']")) continue;
            const part = textOf(run);
            text += (text === "" ? "" : "\n") + part;
        }
    }
    return {
        text,
        chars: text.length,
        lines: text === "" ? 0 : text.split("\n").length
    };
}

/** Whether the UI is Chinese, decided per call so a language switch is seen. */
function isZh(): boolean {
    try {
        return String(document.documentElement.lang || navigator.language || "")
            .toLowerCase()
            .startsWith("zh");
    } catch {
        return false;
    }
}

/** Group-separated count for the pill label. */
function fmt(n: number): string {
    try {
        return n.toLocaleString(isZh() ? "zh-CN" : "en-US");
    } catch {
        return String(n);
    }
}

/** "N chars / M lines" in the active UI language. */
function labelOf(chars: number, lines: number): string {
    return isZh()
        ? fmt(chars) + " 字符 / " + fmt(lines) + " 行"
        : fmt(chars) + " chars / " + fmt(lines) + " lines";
}

/** Avoid rewriting unchanged text (a write would re-trigger the observer). */
function setText(el: HTMLElement, value: string): void {
    if (el.textContent !== value) el.textContent = value;
}

/** Install the transcript fold; returns the disposer. */
export function installTranscriptFold(): () => void {
    const expandedByKey = new Map<string, boolean>();
    const states = new WeakMap<HTMLElement, FoldState>();
    /** Rows a mutation touched; a non-full pass reconsiders only these. */
    const dirty = new Set<HTMLElement>();
    let timer: ReturnType<typeof setTimeout> | null = null;
    let pendingFull = true;
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

    /** Content nodes this row must hide (body only; actions stay usable). */
    function hideTargets(row: HTMLElement): HTMLElement[] {
        const content = contentOf(row);
        return content !== null ? [content] : runsOf(row);
    }

    /** Hide the body, leaving the actions row visible. Idempotent. */
    function hideContent(row: HTMLElement, st: FoldState): void {
        const targets = hideTargets(row);
        const live = st.hidden.filter((el) => el.isConnected);
        const settled = live.length === targets.length
            && targets.every((el, index) => live[index] === el && el.style.display === "none");
        if (settled) return;
        showContent(st);
        for (const el of targets) {
            st.hidden.push(el);
            el.setAttribute("data-cp-display", el.style.display || "");
            el.style.display = "none";
        }
    }

    /** Restore everything this module hid on one row. */
    function showContent(st: FoldState): void {
        for (const el of st.hidden) {
            if (!el.isConnected) continue;
            const previous = el.getAttribute("data-cp-display");
            if (previous !== null) {
                el.style.display = previous;
                el.removeAttribute("data-cp-display");
            }
        }
        st.hidden = [];
    }

    /** Apply the requested state to the row and both cards. */
    function setExpanded(row: HTMLElement, st: FoldState, expanded: boolean): void {
        if (expanded) showContent(st);
        else hideContent(row, st);
        st.expanded = expanded;
        if (expanded) {
            if (st.endCard.parentNode !== row) row.appendChild(st.endCard);
        } else if (st.endCard.parentNode === row) {
            row.removeChild(st.endCard);
        }
        st.card.setAttribute("data-expanded", expanded ? "1" : "0");
        st.pill.setAttribute("aria-expanded", expanded ? "true" : "false");
        setText(st.label, labelOf(st.chars, st.lines));
        setText(st.hint, expanded
            ? (isZh() ? "点击收起" : "Click to collapse")
            : (isZh() ? "点击展开" : "Click to expand"));
    }

    /** Build the top pill/copy row and the bottom collapse pill for one row. */
    function buildCards(row: HTMLElement): FoldState {
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
        copy.textContent = isZh() ? "复制" : "Copy";

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
        endLabel.textContent = isZh() ? "点击收起" : "Click to collapse";
        endPill.appendChild(endChev);
        endPill.appendChild(endLabel);
        endCard.appendChild(endPill);

        const st: FoldState = {
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
            lines: 0,
            hidden: []
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
            // Collapsing shrinks the message by thousands of pixels; bring the
            // collapsed pill back into view instead of leaving the viewport in
            // blank space.
            try {
                st.card.scrollIntoView({ block: "nearest", inline: "nearest" });
            } catch {
                /* older runtimes: leave scrolling to the browser */
            }
        });
        copy.addEventListener("click", (event) => {
            event.preventDefault();
            event.stopPropagation();
            try {
                void navigator.clipboard.writeText(st.text).then(() => {
                    setText(copy, isZh() ? "已复制" : "Copied");
                    setTimeout(() => setText(copy, isZh() ? "复制" : "Copy"), 1200);
                }, () => {});
            } catch {
                /* clipboard unavailable */
            }
        });

        row.insertBefore(card, row.firstChild);
        return st;
    }

    /** Fully undo one row (restore body, remove both cards). */
    function removeCards(row: HTMLElement, st: FoldState): void {
        showContent(st);
        if (st.card.parentNode === row) row.removeChild(st.card);
        if (st.endCard.parentNode === row) row.removeChild(st.endCard);
        states.delete(row);
    }

    /** Record one DOM node whose row must be reconsidered. */
    function markDirty(node: Node): void {
        const el = node instanceof Element ? node : node.parentElement;
        if (el === null) return;
        // Our own cards publish text changes; never treat them as row changes.
        if (el.closest(`[${CARD_ATTR}]`) !== null) return;
        const row = el.closest(ROW_SELECTOR);
        if (row instanceof HTMLElement) dirty.add(row);
        if (el instanceof HTMLElement && el.matches(ROW_SELECTOR)) dirty.add(el);
        for (const nested of el.querySelectorAll<HTMLElement>(ROW_SELECTOR)) dirty.add(nested);
    }

    /** Whether a mutation can affect a foldable row (assistant tokens are ignored). */
    function relevant(record: MutationRecord): boolean {
        const target = record.target;
        const el = target instanceof Element ? target : target.parentElement;
        if (el !== null && el.closest(`[${CARD_ATTR}]`) !== null) return false;
        if (el !== null && el.closest(ROW_SELECTOR) !== null) return true;
        if (record.type !== "childList") return false;
        for (const node of Array.from(record.addedNodes)) {
            if (node instanceof Element && (node.matches(ROW_SELECTOR) || node.querySelector(ROW_SELECTOR) !== null)) {
                return true;
            }
        }
        return false;
    }

    /** Reconsider one row against the current settings. */
    function processRow(row: HTMLElement, config: ReturnType<typeof getConfig>): void {
        let st = states.get(row);
        // React may have removed our card while reusing the row element.
        if (st && st.card.parentNode !== row) {
            states.delete(row);
            st = undefined;
        }
        const m = measure(row);
        if (st && st.stamp !== m.text) {
            removeCards(row, st);
            st = undefined;
        }
        if (!config.foldSent) {
            if (st) removeCards(row, st);
            return;
        }
        if (m.chars < config.sentMinChars && m.lines < config.sentMinLines) {
            if (st) removeCards(row, st);
            return;
        }
        const state = st || buildCards(row);
        state.stamp = m.text;
        state.text = m.text;
        state.chars = m.chars;
        state.lines = m.lines;
        const key = row.getAttribute("data-chat-flow-key") || "";
        const expanded = key !== "" && expandedByKey.get(key) === true;
        setExpanded(row, state, expanded);
        if (key !== "") expandedByKey.set(key, state.expanded);
    }

    /** Cap the per-message expand/collapse memo so long sessions stay bounded. */
    function pruneExpanded(): void {
        const MAX = 400;
        if (expandedByKey.size <= MAX) return;
        let excess = expandedByKey.size - MAX;
        for (const key of expandedByKey.keys()) {
            if (excess <= 0) break;
            expandedByKey.delete(key);
            excess -= 1;
        }
    }

    /** Debounced pass: all rows on a full pass, otherwise only dirty rows. */
    function scan(full: boolean): void {
        timer = null;
        if (disposed) return;
        const config = getConfig();
        let rows: HTMLElement[];
        try {
            rows = full
                ? Array.from(document.querySelectorAll<HTMLElement>(ROW_SELECTOR))
                : Array.from(dirty).filter((row) => row.isConnected);
        } catch {
            return;
        }
        dirty.clear();
        for (const row of rows) {
            if (!(row instanceof HTMLElement)) continue;
            if (row.closest("[hidden]") !== null) continue;
            processRow(row, config);
        }
        if (full) pruneExpanded();
    }

    /** Coalesce the mutation storm; a full pass supersedes dirty-row passes. */
    function schedule(full: boolean): void {
        if (disposed) return;
        if (full) pendingFull = true;
        if (timer !== null) clearTimeout(timer);
        timer = setTimeout(() => {
            const runFull = pendingFull;
            pendingFull = false;
            scan(runFull);
        }, 220);
    }

    const observer = new MutationObserver((records) => {
        let any = false;
        for (const record of records) {
            if (!relevant(record)) continue;
            any = true;
            const target = record.target;
            const el = target instanceof Element ? target : target.parentElement;
            // A change inside an existing row: reconsider that row only.
            if (el !== null && el.closest(ROW_SELECTOR) !== null) markDirty(target);
            // Newly inserted rows (or wrappers containing them): just those.
            if (record.type === "childList") {
                for (const node of Array.from(record.addedNodes)) markDirty(node);
            }
        }
        if (any) schedule(false);
    });
    try {
        observer.observe(document.body, { childList: true, subtree: true, characterData: true });
    } catch {
        /* body unavailable */
    }
    const unsubscribeConfig = subscribeConfig(() => schedule(true));
    schedule(true);

    return () => {
        disposed = true;
        if (timer !== null) clearTimeout(timer);
        timer = null;
        try { observer.disconnect(); } catch { /* already gone */ }
        try { unsubscribeConfig(); } catch { /* already gone */ }
        try { style.remove(); } catch { /* already gone */ }
        for (const card of Array.from(document.querySelectorAll<HTMLElement>("[" + CARD_ATTR + "]"))) {
            const row = card.parentElement;
            if (!row) continue;
            const st = states.get(row);
            if (st) removeCards(row, st);
        }
    };
}
