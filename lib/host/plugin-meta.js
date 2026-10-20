/**
 * Host half — identity.
 *
 * The cordis row identity: the row name is declared by the bundle patch.
 * `inject` is empty because this half mounts nothing service-side — the
 * whole feature is browser-side.
 */
import { PLUGIN_NAME } from "./constants.js";
/** Row name: the identity the bundle patch inserts. */
export const name = PLUGIN_NAME;
/** No host-side services: pure UI plugin. */
export const inject = [];
//# sourceMappingURL=plugin-meta.js.map