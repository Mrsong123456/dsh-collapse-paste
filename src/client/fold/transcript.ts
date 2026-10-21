/**
 * Sent-message folding — display-only transcript decoration.
 *
 * A long user message (or steering row) is rendered as one summary pill;
 * clicking the pill reveals the original message, and a second pill at the
 * END of the expanded message collapses it again without scrolling back to
 * the top. The stored message, the serialized prompt and the model input are
 * never touched, and assistant messages are left alone.
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

/**
 * Where a hidden body keeps the `display` value it had before we hid it.
 * The attribute outlives this module's bookkeeping, which is exactly what
 * makes a leftover recoverable after a crash or a torn-down instance.
 */
const DISPLAY_ATTR = "data-cp-display";

/** Which fold instance owns a card or a hidden body. */
const OWNER_ATTR = "data-cp-owner";

/**
 * Fold instances currently installed in this page. A delayed teardown must
 * only touch nodes it owns; anything owned by an id still in this set belongs
 * to a live sibling and is off limits.
 */
const liveFolds = new Set<string>();
/** Each live instance's one-shot cleanup, so a new install can retire it. */
const activeCleanups = new Map<string, () => void>();
let foldSeq = 0;

/** Put one body back exactly as it was, idempotently. */
function restoreElement(el: HTMLElement): void {
    const previous = el.getAttribute(DISPLAY_ATTR);
    if (previous === null) return;
    el.style.display = previous;
    el.removeAttribute(DISPLAY_ATTR);
    el.removeAttribute(OWNER_ATTR);
}

/** One folded row's DOM handles and last measured content. */
interface FoldState {
    card: HTMLElement;
    pill: HTMLButtonElement;
    label: HTMLElement;
    hint: HTMLElement;
    endCard: HTMLElement;
    endPill: HTMLButtonElement;
    expanded: boolean;
    stamp: string;
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
 * pollute the char/line count. Walking text nodes and rejecting controls
 * keeps only the message prose.
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
    const id = "cp" + (++foldSeq);
    liveFolds.add(id);
    // A new mount supersedes any instance still decorating the transcript
    // (a re-applied plugin whose old cleanup was missed): retire it first so
    // two folds never stack a second card pair on the same row.
    for (const [otherId, otherCleanup] of Array.from(activeCleanups)) {
        if (otherId === id) continue;
        try {
            otherCleanup();
        } catch {
            /* a stuck sibling must not block the new install */
        }
    }
    const expandedByKey = new Map<string, boolean>();
    const states = new WeakMap<HTMLElement, FoldState>();
    /**
     * Every body this instance has hidden. Deliberately independent of
     * `states`: a row can lose its state (React drops our card and reuses the
     * row) while its body is still `display:none`, and a teardown must be able
     * to put that body back without consulting the row bookkeeping.
     */
    const hiddenAll = new Set<HTMLElement>();
    /** Rows a mutation touched; a non-full pass reconsiders only these. */
    const dirty = new Set<HTMLElement>();
    let timer: ReturnType<typeof setTimeout> | null = null;
    let pendingFull = true;
    let disposed = false;
    /** Live observer/subscription; null until the setup at the end succeeded. */
    let observer: MutationObserver | null = null;
    let unsubscribeConfig: (() => void) | null = null;
    let cleaned = false;

    // Reclaim decoration left by instances that are no longer installed (a
    // crashed install, a torn-down sibling whose cleanup ran late). Without
    // this, a half-dead instance keeps a duplicated card pair and bodies it
    // hid stay hidden under an owner nobody tracks.
    healOrphans();
    removeDeadCards();

    const style = document.createElement("style");
    style.dataset.plugin = "dsh-collapse-paste";
    style.textContent = [
        ".cp-fold{display:flex;align-items:center;justify-content:flex-end;gap:8px;width:100%;margin:6px 0 10px;max-width:100%;}",
        // `--dsw-alias-brand-primary` is an ink token (near-black in light, near-white
        // in dark), so using it as a surface made the pill black. Keep an explicit
        // accent pair instead: same blue in both themes, white label on top.
        ".cp-fold-pill{--cp-fold-accent:#4d6bfe;--cp-fold-accent-hot:#3f5cf0;display:inline-flex;align-items:center;gap:8px;height:38px;max-width:100%;padding:0 16px;border:1px solid var(--cp-fold-accent);border-radius:999px;background:var(--cp-fold-accent);color:#fff;font-size:inherit;line-height:1;cursor:pointer;}",
        ".cp-fold-pill:hover{background:var(--cp-fold-accent-hot);border-color:var(--cp-fold-accent-hot);color:#fff;}",
        ".cp-fold-pill:focus-visible{outline:2px solid color-mix(in srgb,var(--cp-fold-accent) 55%,transparent);outline-offset:2px;}",
        ".cp-fold-chev{display:inline-block;flex:none;font-size:1.15em;transition:transform .15s ease;}",
        '.cp-fold[data-expanded="1"] .cp-fold-chev{transform:rotate(90deg);}',
        ".cp-fold-end{margin-top:8px;}",
        ".cp-fold-end .cp-fold-chev{transform:rotate(-90deg);}",
        ".cp-fold-label{white-space:nowrap;overflow:hidden;text-overflow:ellipsis;}",
        ".cp-fold-hint{flex:none;opacity:.82;white-space:nowrap;}"
    ].join("");
    try {
        document.head.appendChild(style);
    } catch (error) {
        // Nothing else was created yet; drop the registration and let apply()
        // report a failed mount instead of leaking a half-installed fold.
        liveFolds.delete(id);
        throw error;
    }

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
            hiddenAll.add(el);
            el.setAttribute(DISPLAY_ATTR, el.style.display || "");
            el.setAttribute(OWNER_ATTR, id);
            el.style.display = "none";
        }
    }

    /** Restore everything this module hid on one row. */
    function showContent(st: FoldState): void {
        for (const el of st.hidden) {
            hiddenAll.delete(el);
            // A detached body keeps its marker; if React reattaches that node
            // later, the orphan sweep in `scan()` restores it.
            if (!el.isConnected) continue;
            restoreElement(el);
        }
        st.hidden = [];
    }

    /** Put back every body this instance hid, whatever its row state is now. */
    function restoreAllHidden(): void {
        for (const el of Array.from(hiddenAll)) restoreElement(el);
        hiddenAll.clear();
    }

    /**
     * Restore bodies marked as hidden whose owner is gone: leftovers from an
     * instance that crashed, was torn down without being able to restore
     * them, or belongs to an older version of this plugin. Bodies owned by a
     * live sibling are never touched — that was how a late teardown used to
     * un-hide the freshly installed fold.
     */
    function healOrphans(): void {
        let marked: HTMLElement[];
        try {
            marked = Array.from(document.querySelectorAll<HTMLElement>("[" + DISPLAY_ATTR + "]"));
        } catch {
            return;
        }
        for (const el of marked) {
            if (hiddenAll.has(el)) continue;
            const owner = el.getAttribute(OWNER_ATTR) || "";
            if (owner !== "" && liveFolds.has(owner)) continue;
            restoreElement(el);
        }
    }

    /** Remove cards whose owning instance is no longer installed. */
    function removeDeadCards(): void {
        let cards: HTMLElement[];
        try {
            cards = Array.from(document.querySelectorAll<HTMLElement>("[" + CARD_ATTR + "]"));
        } catch {
            return;
        }
        for (const card of cards) {
            const owner = card.getAttribute(CARD_ATTR) || "";
            if (owner !== "" && liveFolds.has(owner)) continue;
            card.remove();
        }
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

    /** Build the top summary pill and the bottom collapse pill for one row. */
    function buildCards(row: HTMLElement): FoldState {
        const card = document.createElement("div");
        card.className = "cp-fold";
        card.setAttribute(CARD_ATTR, id);
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

        card.appendChild(pill);

        const endCard = document.createElement("div");
        endCard.className = "cp-fold cp-fold-end";
        endCard.setAttribute(CARD_ATTR, id);
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
            endCard,
            endPill,
            expanded: false,
            stamp: "",
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
        // React may have removed our card while reusing the row element; the
        // body can still be hidden at that moment, so restore before dropping
        // the only pointer to what we hid.
        if (st && st.card.parentNode !== row) {
            showContent(st);
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
        try {
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
        } catch (error) {
            // Fail-open: a fold that keeps throwing would leave a half-hidden
            // transcript and an observer retrying forever. Undo this instance.
            console.warn("[collapse-paste] transcript fold disabled:", error);
            cleanup();
        }
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

    /**
     * Undo exactly this instance: its style, its observers and its own cards
     * and bodies. One-shot, and never touches a sibling that is still live.
     */
    function cleanup(): void {
        if (cleaned) return;
        cleaned = true;
        disposed = true;
        if (timer !== null) clearTimeout(timer);
        timer = null;
        try { observer?.disconnect(); } catch { /* already gone */ }
        try { unsubscribeConfig?.(); } catch { /* already gone */ }
        try { style.remove(); } catch { /* already gone */ }
        // Restore by what we hid, not by what the row bookkeeping still
        // knows: a row whose state was dropped still has a hidden body.
        restoreAllHidden();
        // Remove only our own cards; a sibling's stay untouched.
        try {
            const mine = "[" + CARD_ATTR + '="' + id + '"]';
            for (const card of Array.from(document.querySelectorAll<HTMLElement>(mine))) card.remove();
        } catch { /* document unavailable */ }
        liveFolds.delete(id);
        activeCleanups.delete(id);
        // Reclaim anything whose owner is now gone (legacy or crashed folds).
        healOrphans();
    }

    try {
        observer = new MutationObserver((records) => {
            if (disposed) return;
            try {
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
            } catch (error) {
                console.warn("[collapse-paste] transcript fold disabled:", error);
                cleanup();
            }
        });
    } catch (error) {
        // No observer means no fold; undo the style instead of leaking it.
        cleanup();
        throw error;
    }
    try {
        observer.observe(document.body, { childList: true, subtree: true, characterData: true });
    } catch {
        /* body unavailable: the fold stays registered but sees no mutations */
    }
    try {
        unsubscribeConfig = subscribeConfig(() => schedule(true));
    } catch (error) {
        cleanup();
        throw error;
    }
    activeCleanups.set(id, cleanup);
    schedule(true);

    return cleanup;
}
