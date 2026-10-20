/**
 * @comecaramelos/dsh-collapse-multiline-paste — pure core unit tests.
 *
 * Runs under node --test without a DOM: lib/core.js is dependency-free.
 *
 * @module test/core
 */
import { test } from "node:test";
import assert from "node:assert/strict";

import { PUA_RE, sanitize, countLines, meetsThreshold, diffPaste, locateLeaves } from "../lib/core.js";

test("sanitize strips the PUA ranges DSH strips on paste", () => {
    assert.equal(sanitize("a\uFFFCb"), "ab");
    assert.equal(sanitize("a\uE100b\uE11Dc"), "abc");
    assert.equal(sanitize("plain"), "plain");
    assert.equal(sanitize(""), "");
    // the global flag must not skip alternating matches
    assert.equal(sanitize("\uFFFCa\uFFFC"), "a");
});

test("PUA_RE matches the facade.paste range and nothing else", () => {
    assert.equal("x\uFFFC".replace(PUA_RE, ""), "x");
    assert.equal("x\uE100".replace(PUA_RE, ""), "x");
    assert.equal("x\uE11D".replace(PUA_RE, ""), "x");
    assert.equal("x\uE11E".replace(PUA_RE, ""), "x\uE11E"); // outside the range
    assert.equal("xé".replace(PUA_RE, ""), "xé");
});

test("countLines counts newline-separated lines", () => {
    assert.equal(countLines(""), 0);
    assert.equal(countLines("a"), 1);
    assert.equal(countLines("a\nb"), 2);
    assert.equal(countLines("a\nb\n"), 3);
    assert.equal(countLines("a\n\nb"), 3);
});

test("meetsThreshold requires lines and chars", () => {
    const cfg = { minLines: 3, minChars: 0 };
    assert.equal(meetsThreshold("a\nb", cfg), false);
    assert.equal(meetsThreshold("a\nb\nc", cfg), true);
    const cfgChars = { minLines: 1, minChars: 10 };
    assert.equal(meetsThreshold("short", cfgChars), false);
    assert.equal(meetsThreshold("0123456789", cfgChars), true);
    assert.equal(meetsThreshold("", cfg), false);
});

test("diffPaste finds the appended slice", () => {
    assert.deepEqual(diffPaste("abc", "abcdef\nghi"), { start: 3, removed: "", inserted: "def\nghi" });
});

test("diffPaste finds the prepended slice", () => {
    assert.deepEqual(diffPaste("b\nc", "a\nb\nc"), { start: 0, removed: "", inserted: "a\n" });
});

test("diffPaste finds the middle slice", () => {
    assert.deepEqual(diffPaste("abdef", "abXYZdef"), { start: 2, removed: "", inserted: "XYZ" });
});

test("diffPaste splits a select-all replacement", () => {
    assert.deepEqual(diffPaste("x\ny", "a\nb"), { start: 0, removed: "x\ny", inserted: "a\nb" });
});

test("diffPaste splits a one-char selection replacement", () => {
    assert.deepEqual(diffPaste("abc", "abd"), { start: 2, removed: "c", inserted: "d" });
});

test("diffPaste answers empty inserted on pure shrinkage", () => {
    assert.deepEqual(diffPaste("abcdef", "abc"), { start: 3, removed: "def", inserted: "" });
});

test("diffPaste handles no-op and identical edges", () => {
    assert.deepEqual(diffPaste("abc", "abc"), { start: 3, removed: "", inserted: "" });
    assert.deepEqual(diffPaste("", "x"), { start: 0, removed: "", inserted: "x" });
    assert.deepEqual(diffPaste("a", "aa"), { start: 1, removed: "", inserted: "a" });
});

test("locateLeaves spans a run across the leaves and their line breaks", () => {
    // "hi" then the pasted run "L1\nL2\nL3" folded into leaves.
    assert.deepEqual(locateLeaves(["hi", "L1", "\n", "L2", "\n", "L3"], 2, 8), { first: 1, last: 5, startOffset: 0, endOffset: 2 });
});

test("locateLeaves clamps an end that lands mid-leaf", () => {
    assert.deepEqual(locateLeaves(["ab", "cd"], 1, 2), { first: 0, last: 1, startOffset: 1, endOffset: 1 });
});

test("locateLeaves maps an insertion on a boundary to the FOLLOWING leaf", () => {
    // a zero-length chip marker at the start contributes "", the run starts
    // on the leaf that FOLLOWS, not the empty marker.
    assert.deepEqual(locateLeaves(["", "ab"], 0, 2), { first: 1, last: 1, startOffset: 0, endOffset: 2 });
});

test("locateLeaves skips zero-length leaves when anchoring", () => {
    assert.deepEqual(locateLeaves(["hi", "", "!", "x"], 3, 1), { first: 3, last: 3, startOffset: 0, endOffset: 1 });
});

test("locateLeaves answers null for empty insertions and off-document runs", () => {
    assert.equal(locateLeaves(["a", "b"], 0, 0), null);
    assert.equal(locateLeaves(["a", "b"], 5, 1), null);
    assert.equal(locateLeaves([], 0, 3), null);
});

test("end-to-end: a paste at the end folds from the first pasted leaf to the last", () => {
    const baseline = "hi";
    const pasted = "L1\nL2\nL3";
    const next = baseline + pasted;
    const { start, inserted } = diffPaste(baseline, next);
    assert.equal(start, 2);
    assert.equal(meetsThreshold(pasted, { minLines: 3, minChars: 0 }), true);
    assert.equal(countLines(pasted), 3);
    const span = locateLeaves(["hi", "L1", "\n", "L2", "\n", "L3"], start, inserted.length);
    // the "hi" leaf (index 0) stays out: the fold starts on "L1".
    assert.deepEqual(span, { first: 1, last: 5, startOffset: 0, endOffset: 2 });
});

test("end-to-end: a leading-newline paste still keeps the base text out of the fold", () => {
    const baseline = "hi";
    const pasted = "\nL1\nL2\nL3";
    const next = baseline + pasted;
    const { start, inserted } = diffPaste(baseline, next);
    const leaves = ["hi", "\n", "L1", "\n", "L2", "\n", "L3"];
    const span = locateLeaves(leaves, start, inserted.length);
    // the fold begins on the leading break leaf (index 1): the "hi" base text
    // (index 0) is never folded.
    assert.equal(span.first, 1);
});

test("end-to-end: small paste below the threshold does not qualify", () => {
    const baseline = "line1";
    const next = "line1 small\npaste";
    const { start, inserted } = diffPaste(baseline, next);
    assert.equal(inserted.length > 0, true);
    assert.equal(meetsThreshold(" small\npaste", { minLines: 3, minChars: 0 }), false);
});
