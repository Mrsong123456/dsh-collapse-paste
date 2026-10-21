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
import { getConfig } from "./settings.js";
import { SettingsPage } from "./settings-page.js";
import { ensureComposerStyles } from "./styles/index.js";
import { installTranscriptFold } from "./fold/transcript.js";
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
    subscribe: () => () => {},
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
        mount(() => ctx.locale.register(LOCALE_NAMESPACE, DICTIONARIES), "collapse-multiline: dictionaries");
        bindLocale(ctx.locale.bind(LOCALE_NAMESPACE));
        bindScope(LOCAL_SCOPE);
        mount(() => arm(), "collapse-multiline: DOM engine");
        mount(() => installTranscriptFold(), "collapse-paste: transcript fold");
        ctx.slots.inject("settings.section", () =>
            ctx.slots.register(
                {
                    name: "settings.section",
                    id: "collapse-paste",
                    order: 35,
                    label: () => (isZh() ? "折叠多行粘贴" : "Collapse paste")
                },
                SettingsPage
            )
        );
        (window as unknown as Record<string, unknown>).__DSH_COLLAPSE_PASTE__ = {
            version: "0.2.3",
            instance,
            engineEpoch: currentEpoch(),
            armed: true
        };
        console.info("[collapse-paste] armed", { instance });
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
            version: "0.2.3",
            instance,
            engineEpoch: currentEpoch(),
            armed: false,
            error: String(error)
        };
        console.error("[collapse-paste] disabled:", error);
    }
}
