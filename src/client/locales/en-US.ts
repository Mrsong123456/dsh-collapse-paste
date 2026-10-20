/**
 * Browser half — the `en` dictionary.
 *
 * Every string the card and the badge render is resolved through the
 * `collapseMultiline` locale namespace; keys not in this table fall open to
 * the key itself, never to a crash.
 */
export const en = {
    title: "Collapse multiline paste",
    description: "Compress pasted multiline text in the composer into an expandable 'X chars / Y lines' badge.",
    active: "Active",
    activeHint: "Collapse multiline pastes in the composer. Off keeps stock behaviour.",
    minLines: "Minimum lines",
    minLinesHint: "Pasted text with at least this many lines collapses.",
    minChars: "Minimum chars",
    minCharsHint: "Also require this many characters. 0 means lines only.",
    invalid: "Enter a whole number in range.",
    label: "{chars} chars / {lines} lines",
    expand: "Expand",
    collapse: "Collapse",
    overridden: "Overridden",
    reset: "Reset to default",
    readOnly: "Settings are read-only in this deployment.",
    save: "Save",
    saving: "Saving…",
    discard: "Discard",
    unsaved: "Unsaved",
    statusError: "Error",
    saveFailed: "The deployment did not accept these values; they were left for you to correct."
};
