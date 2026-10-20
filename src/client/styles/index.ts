/**
 * Browser half — the stylesheet surface.
 *
 * The composer sheet travels as a TS string and is DOM-checked (idempotent
 * per document); `apply` ensures it before mounting.
 */
export { ensureComposerStyles, COMPOSER_CSS } from "./composer.js";
