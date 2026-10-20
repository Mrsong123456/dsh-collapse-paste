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

/** One settings control's spec: its kind and, for ints, the valid range. */
export interface FieldSpec {
    kind: "bool" | "int";
    min?: number;
    max?: number;
}

/** The card's controls, by field key. */
export const FIELDS: Record<string, FieldSpec> = {
    active: { kind: "bool" },
    minLines: { kind: "int", min: 1, max: 100 },
    minChars: { kind: "int", min: 0, max: 10000 }
};

/** Control order in the card body. */
export const FIELD_ORDER = ["active", "minLines", "minChars"];
