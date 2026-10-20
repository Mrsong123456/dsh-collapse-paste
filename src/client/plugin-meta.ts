/**
 * Browser half — identity and the services the shell must resolve.
 *
 * The position in the loader is the package name (`dsh-collapse-paste`); the
 * locale namespace is the lookup root for every string this half renders,
 * and the plugin id tags the injected `style` elements. The browser half is
 * emitted as its own bundle and cannot import ./host/constants.ts, so the id
 * is mirrored here — keep both sides in step.
 */

/** Locale dictionary namespace this half registers and renders from. */
export const LOCALE_NAMESPACE = "collapseMultiline";

/** npm id of this bundle; tags the injected `style` elements. */
export const PLUGIN_ID = "dsh-collapse-paste";

/**
 * Services the shell must resolve before `apply` runs.
 *
 * Locale for copy, slots for the Settings page and the transcript fold's
 * registration. There is no settings service in the released 0.2.1 client;
 * the plugin persists its own settings in the browser instead.
 */
export const inject = ["locale", "slots"];
