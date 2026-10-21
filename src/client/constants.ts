/**
 * Browser half — fixed DOM identifiers and field specs.
 *
 * The DOM strings are contracts with the running composer shell (a stock
 * Lexical editor renders its paragraph children as direct `div`s of the
 * `[data-composer-input]` root) and with the stylesheet this half injects.
 * Changing any of them is a behavior change, not a rename.
 */

/** Composer root selector (ComposerContentEditable div). */
export const ROOT_SELECTOR = "[data-composer-input]";

/** Quiet window after the last mutation before a commit is settled. */
export const QUIET_MS = 80;
