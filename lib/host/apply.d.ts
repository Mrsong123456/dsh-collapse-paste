/**
 * Host half — the wiring.
 *
 * This build has no host-side behavior. The released 0.2.1 settings service
 * has no `installSection` verb, so the old settings-section wiring is gone.
 * The whole feature lives browser-side in `lib/client.js`, which watches the
 * composer's DOM after DSH's own paste pipeline commits and never touches
 * session state.
 */
/** Host plugin body — intentionally empty. */
export declare function apply(): void;
//# sourceMappingURL=apply.d.ts.map