/**
 * Browser-side settings store.
 *
 * The released 0.2.1 client has no settings service (`settingsScope` never
 * shipped), and the Host's Config form cannot hand values to a browser half
 * without an RPC route. The plugin therefore keeps its own small settings
 * store in `localStorage`, edited from a native Settings page registered in
 * `settings.section`. Values apply to the next paste / transcript scan.
 *
 * The shape and clamping live in `src/core.ts` as pure functions, so they
 * are unit-tested and shared with the browser bundle.
 */
import {
    DEFAULT_COLLAPSE_CONFIG,
    normalizeCollapseConfig,
    type CollapseConfig
} from "../core.js";

export type { CollapseConfig } from "../core.js";

/** Defaults, also used by "Reset to defaults". */
export const CONFIG_DEFAULTS: CollapseConfig = DEFAULT_COLLAPSE_CONFIG;

const STORAGE_KEY = "dsh-collapse-paste.config.v1";

const listeners = new Set<() => void>();

/** Read the persisted payload, falling back to defaults. */
function load(): CollapseConfig {
    try {
        const raw = localStorage.getItem(STORAGE_KEY);
        if (raw === null) return { ...CONFIG_DEFAULTS };
        return normalizeCollapseConfig(JSON.parse(raw) as Partial<CollapseConfig>);
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
    current = normalizeCollapseConfig({ ...current, ...patch });
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
