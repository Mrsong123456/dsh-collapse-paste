/**
 * Browser-side settings store.
 *
 * The released 0.2.1 client has no settings service (`settingsScope` never
 * shipped), and the Host's Config form cannot hand values to a browser half
 * without an RPC route. The plugin therefore keeps its own small settings
 * store in `localStorage`, edited from a native Settings page registered in
 * `settings.section`. Values apply to the next paste / transcript scan.
 *
 * Everything is clamped on read and write, so a hand-edited or partially
 * written payload can never produce a zero/negative threshold.
 */

/** The complete settings shape, every field defaulting. */
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
export const CONFIG_DEFAULTS: CollapseConfig = {
    active: true,
    minLines: 3,
    minChars: 0,
    foldSent: true,
    sentMinChars: 600,
    sentMinLines: 12
};

const STORAGE_KEY = "dsh-collapse-paste.config.v1";

const listeners = new Set<() => void>();

/** Clamp one integer field into [min, max], falling back to a default. */
function intOf(value: unknown, fallback: number, min: number, max: number): number {
    const n = typeof value === "number" ? value : Number(value);
    if (!Number.isFinite(n)) return fallback;
    return Math.min(max, Math.max(min, Math.floor(n)));
}

/** Clamp booleans and numbers into the complete shape. */
function normalize(value: Partial<CollapseConfig> | null | undefined): CollapseConfig {
    const v = value || {};
    return {
        active: v.active !== false,
        minLines: intOf(v.minLines, CONFIG_DEFAULTS.minLines, 1, 100),
        minChars: intOf(v.minChars, CONFIG_DEFAULTS.minChars, 0, 100_000),
        foldSent: v.foldSent !== false,
        sentMinChars: intOf(v.sentMinChars, CONFIG_DEFAULTS.sentMinChars, 0, 1_000_000),
        sentMinLines: intOf(v.sentMinLines, CONFIG_DEFAULTS.sentMinLines, 1, 100_000)
    };
}

/** Read the persisted payload, falling back to defaults. */
function load(): CollapseConfig {
    try {
        const raw = localStorage.getItem(STORAGE_KEY);
        if (raw === null) return { ...CONFIG_DEFAULTS };
        return normalize(JSON.parse(raw) as Partial<CollapseConfig>);
    } catch {
        return { ...CONFIG_DEFAULTS };
    }
}

let current: CollapseConfig = load();

/** The live settings snapshot (stable object identity per change). */
export function getConfig(): CollapseConfig {
    return current;
}

/** Merge a patch, persist it, and notify subscribers. Returns the new value. */
export function setConfig(patch: Partial<CollapseConfig>): CollapseConfig {
    current = normalize({ ...current, ...patch });
    try {
        localStorage.setItem(STORAGE_KEY, JSON.stringify(current));
    } catch {
        /* private mode / storage denied: keep the in-memory value */
    }
    for (const listener of listeners) {
        try {
            listener();
        } catch {
            /* a subscriber must not break the others */
        }
    }
    return current;
}

/** Restore every field to its default. */
export function resetConfig(): CollapseConfig {
    return setConfig(CONFIG_DEFAULTS);
}

/** Subscribe to settings changes; returns the unsubscribe function. */
export function subscribeConfig(listener: () => void): () => void {
    listeners.add(listener);
    return () => {
        listeners.delete(listener);
    };
}
