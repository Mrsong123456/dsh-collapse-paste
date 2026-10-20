/**
 * Browser half — shared structural views.
 *
 * Only the faces this half actually calls are described; the rest of the
 * shell services (upstream packages) never appear here.
 */

/** A cleanup-returning effect, exactly the `ctx.effect` shape. */
export interface PluginEffect {
    (effect: () => void | (() => void), name?: string): void;
}

/** The `locale` service face this half consumes (register + bind). */
export interface LocaleService {
    register(namespace: string, dictionaries: Record<string, Record<string, string>>): void;
    bind(namespace: string): (key: string, params?: Record<string, string | number>) => string;
}

/** The `slots` service face this half consumes (Settings page registration). */
export interface SlotsService {
    inject(name: string, callback: () => void): void;
    register(registration: Record<string, unknown>, component: unknown): unknown;
}

/** The browser plugin context, as narrow as this half reads it. */
export interface PluginContext {
    effect: PluginEffect;
    locale: LocaleService;
    slots: SlotsService;
}
