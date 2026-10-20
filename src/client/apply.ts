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
import { arm, dispose } from "./engine/engine.js";
import { bindLocale, bindScope, type SettingsScope } from "./engine/config.js";
import { getConfig } from "./settings.js";
import { SettingsPage } from "./settings-page.js";
import { ensureComposerStyles } from "./styles/index.js";
import { installTranscriptFold } from "./fold/transcript.js";
import type { PluginContext } from "./types.js";

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
            version: "0.2.0",
            armed: true
        };
        console.info("[collapse-paste] armed");
    } catch (error) {
        // Fail-open: the composer and transcript keep their stock behaviour.
        (window as unknown as Record<string, unknown>).__DSH_COLLAPSE_PASTE__ = {
            version: "0.2.0",
            armed: false,
            error: String(error)
        };
        console.error("[collapse-paste] disabled:", error);
    }
}
