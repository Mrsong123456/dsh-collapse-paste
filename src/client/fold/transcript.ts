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
}

/** The direct children of a row except our own cards. */
function runsOf(row: HTMLElement): HTMLElement[] {
    const out: HTMLElement[] = [];
    for (const child of Array.from(row.children)) {
        if (child instanceof HTMLElement && !child.hasAttribute(CARD_ATTR)) out.push(child);
    }
    return out;
}

/** Plain text of one row, with a line break between child runs. */
function measure(row: HTMLElement): { runs: HTMLElement[]; text: string; chars: number; lines: number } {
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
    let timer: ReturnType<typeof setTimeout> | null = null;
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

    /** Hide every run, remembering the previous inline display. */
    function hideRuns(row: HTMLElement): void {
        for (const run of runsOf(row)) {
            if (run.style.display !== "none") {
                run.setAttribute("data-cp-display", run.style.display || "");
                run.style.display = "none";
            }
        }
    }

    /** Restore every run hidden by this module. */
    function showRuns(row: HTMLElement): void {
        for (const run of runsOf(row)) {
            const previous = run.getAttribute("data-cp-display");
            if (previous !== null) {
                run.style.display = previous;
                run.removeAttribute("data-cp-display");
            }
        }
    }

    /** Apply the requested state to the row and both cards. */
    function setExpanded(row: HTMLElement, st: FoldState, expanded: boolean): void {
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

    /** Fully undo one row (restore runs, remove both cards). */
    function removeCards(row: HTMLElement, st: FoldState): void {
        showRuns(row);
        if (st.card.parentNode === row) row.removeChild(st.card);
        if (st.endCard.parentNode === row) row.removeChild(st.endCard);
        states.delete(row);
    }

    /** One debounced pass over the mounted transcript. */
    function scan(): void {
        timer = null;
        if (disposed) return;
        let rows: NodeListOf<HTMLElement>;
        try {
            rows = document.querySelectorAll<HTMLElement>(ROW_SELECTOR);
        } catch {
            return;
        }
        for (const row of Array.from(rows)) {
            if (!(row instanceof HTMLElement)) continue;
            if (row.closest("[hidden]") !== null) continue;

            const config = getConfig();
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
                continue;
            }
            if (m.chars < config.sentMinChars && m.lines < config.sentMinLines) {
                if (st) removeCards(row, st);
                continue;
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
    }

    /** Coalesce the mutation storm of streaming and virtualized scrolling. */
    function schedule(): void {
        if (disposed) return;
        if (timer !== null) clearTimeout(timer);
        timer = setTimeout(scan, 180);
    }

    const observer = new MutationObserver(() => schedule());
    try {
        observer.observe(document.body, { childList: true, subtree: true, characterData: true });
    } catch {
        /* body unavailable */
    }
    const unsubscribeConfig = subscribeConfig(() => schedule());
    schedule();

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
