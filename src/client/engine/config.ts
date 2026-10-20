/**
 * Engine half — the live configuration face.
 *
 * Binds the settings scope the card's controller drives through, and the
 * bound locale the badge labels are resolved with. Both bindings happen in
 * `../apply.ts` before the engine is armed; reading before the scope
 * resolves returns null, which keeps the watcher inert until the settings
 * service is ready (never a crash, never a wrong threshold).
 */

/** The resolved live thresholds this half reads. */
export interface EngineConfig {
    active: boolean;
    minLines: number;
    minChars: number;
}

/** The live snapshot face the scope hands down. */
export interface SettingsSnapshot {
    status: string;
    value?: any;
    base?: any;
    user?: any;
    writable?: boolean;
}

/** The `settingsScope` face this half reads (the card owns the writes). */
export interface SettingsScope {
    getSnapshot(): SettingsSnapshot;
    subscribe(listener: () => void): () => void;
    set(path: string, value: unknown): Promise<void>;
    unset(path: string): Promise<void>;
}

/** The bound locale face: `t(key)` resolves one string in the namespace. */
export type LocaleT = (key: string, params?: Record<string, string | number>) => string;

/** The bound settings scope; null until `apply` binds it. */
let scope: SettingsScope | null = null;

/** The bound locale face; null until `apply` binds it. */
let localeT: LocaleT | null = null;

/** Bind the settings scope (called from apply, once). */
export function bindScope(next: SettingsScope): void {
    scope = next;
}

/** Bind the locale face (called from apply, once). */
export function bindLocale(next: LocaleT): void {
    localeT = next;
}

/** Read the live thresholds; null until the settings scope is ready. */
export function readConfig(): EngineConfig | null {
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

/** Resolve the badge's "X chars / Y lines" label for one region. */
export function badgeLabel(chars: number, lines: number): string {
    return localeT === null ? chars + " chars / " + lines + " lines" : localeT("label", { chars, lines });
}
