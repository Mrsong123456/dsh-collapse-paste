/**
 * Browser half — the wiring.
 *
 * Mounts the pieces that exist in the released 0.2.1 client:
 *
 * 1. The locale dictionaries (`src/client/locales/`), registered under the
 *    `collapseMultiline` namespace and bound for the badge label.
 * 2. The composer DOM engine, mounted as a cleanup effect (`arm`/`dispose`).
 * 3. The transcript fold, display-only decoration of long sent messages.
 * 4. A native Settings page (`settings.section`) backed by the browser-side
 *    store in `./settings.ts`.
 *
 * The original `settingsScope` service and `settings.plugin.item` slot do not
 * exist in 0.2.1; depending on them made the whole Web boot fail. The
 * settings store replaces that data source with defaults plus a localStorage
 * payload edited from the page.
 *
 * The feature remains fail-open: any error inside the engine tears it down
 * to the stock composer, and a throw here disables the plugin instead of the
 * page.
 */
import { LOCALE_NAMESPACE } from "./plugin-meta.js";
import { DICTIONARIES } from "./locales/index.js";
import { arm, currentEpoch } from "./engine/engine.js";
import { bindLocale, bindScope, type SettingsScope } from "./engine/config.js";
import { getConfig, subscribeConfig } from "./settings.js";
import { SettingsPage } from "./settings-page.js";
import { ensureComposerStyles } from "./styles/index.js";
import { installTranscriptFold } from "./fold/transcript.js";
import { VERSION } from "./version.js";
import type { PluginContext } from "./types.js";

/** How many times the host has applied this plugin in this page. */
let applySeq = 0;

/** The engine reads this scope on every paste, so saved changes apply live. */
const LOCAL_SCOPE: SettingsScope = {
    getSnapshot: () => ({
        status: "ready",
        value: getConfig(),
        writable: false
    }),
    // Real subscription: the engine uses it to unfold the draft as soon as
    // "Enable composer folding" is switched off.
    subscribe: (listener) => subscribeConfig(listener),
    set: async () => {},
    unset: async () => {}
};

/** Whether the UI is Chinese (the Settings page label mirrors the locale). */
function isZh(): boolean {
    try {
        return String(document.documentElement.lang || navigator.language || "")
            .toLowerCase()
            .startsWith("zh");
    } catch {
        return false;
    }
}

/**
 * Arm the composer engine, the transcript fold and the Settings page.
 *
 * @param ctx - the browser plugin context.
 */
export function apply(ctx: PluginContext): void {
    /**
     * Mounts that succeeded, in mount order. A throw below must undo them:
     * the host may keep a half-applied fiber's effects alive, and a fold left
     * behind would keep hiding transcript bodies with no owner to restore
     * them.
     */
    const teardown: Array<() => void> = [];
    /** This apply() call; late cleanups from an earlier call stay ignored. */
    const instance = ++applySeq;
    /**
     * Register one mount as an effect and remember its cleanup, so the catch
     * below can run the same cleanups when the host will not (or not yet).
     *
     * The recorded cleanup is one-shot: the catch calls it, and a later
     * effect disposal from the same (half-failed) fiber becomes a no-op
     * instead of tearing down whatever a newer apply() mounted.
     */
    const mount = (exec: () => (() => void) | void, label: string): void => {
        ctx.effect(() => {
            const off = exec();
            if (typeof off !== "function") return undefined;
            let settled = false;
            const cleanup = (): void => {
                if (settled) return;
                settled = true;
                const index = teardown.indexOf(cleanup);
                if (index >= 0) teardown.splice(index, 1);
                off();
            };
            teardown.push(cleanup);
            return cleanup;
        }, label);
    };
    try {
        ensureComposerStyles();
        // Locale is optional: without it the copy falls back to English, but
        // the feature itself must still mount. (Same rule for the Settings
        // page below; only the engine and the fold are hard requirements.)
        mount(() => {
            const locale = ctx.locale;
            if (locale === undefined || locale === null || typeof locale.register !== "function") return undefined;
            try {
                locale.register(LOCALE_NAMESPACE, DICTIONARIES);
            } catch (error) {
                console.warn("[collapse-paste] locale unavailable:", error);
                return undefined;
            }
            bindLocale(locale.bind(LOCALE_NAMESPACE));
            return undefined;
        }, "collapse-multiline: dictionaries");
        bindScope(LOCAL_SCOPE);
        mount(() => arm(), "collapse-multiline: DOM engine");
        mount(() => installTranscriptFold(), "collapse-paste: transcript fold");
        const slots = ctx.slots;
        if (slots !== undefined && slots !== null && typeof slots.inject === "function") {
            try {
                slots.inject("settings.section", () =>
                    slots.register(
                        {
                            name: "settings.section",
                            id: "collapse-paste",
                            order: 35,
                            label: () => (isZh() ? "折叠多行粘贴" : "Collapse paste")
                        },
                        SettingsPage
                    )
                );
            } catch (error) {
                console.warn("[collapse-paste] settings page unavailable:", error);
            }
        }
        (window as unknown as Record<string, unknown>).__DSH_COLLAPSE_PASTE__ = {
            version: VERSION,
            instance,
            engineEpoch: currentEpoch(),
            armed: true
        };
        console.info("[collapse-paste] armed", { instance, version: VERSION });
    } catch (error) {
        // Fail-open: the composer and transcript keep their stock behaviour.
        // Unwind in reverse mount order so hidden transcript bodies come back
        // before the error is reported.
        while (teardown.length > 0) {
            const off = teardown.pop();
            try {
                off?.();
            } catch {
                /* keep unwinding: one stuck mount must not strand the rest */
            }
        }
        (window as unknown as Record<string, unknown>).__DSH_COLLAPSE_PASTE__ = {
            version: VERSION,
            instance,
            engineEpoch: currentEpoch(),
            armed: false,
            error: String(error)
        };
        console.error("[collapse-paste] disabled:", error);
    }
}
