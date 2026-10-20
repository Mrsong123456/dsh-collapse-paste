/**
 * Settings normalizer unit tests — pure, dependency-free core.
 *
 * @module test/settings
 */
import { test } from "node:test";
import assert from "node:assert/strict";

import { DEFAULT_COLLAPSE_CONFIG, normalizeCollapseConfig } from "../lib/core.js";

test("missing values resolve to the documented defaults", () => {
    assert.deepEqual(normalizeCollapseConfig(undefined), DEFAULT_COLLAPSE_CONFIG);
    assert.deepEqual(normalizeCollapseConfig({}), DEFAULT_COLLAPSE_CONFIG);
});

test("numbers are clamped to their ranges", () => {
    const low = normalizeCollapseConfig({ minLines: 0, minChars: -5, sentMinChars: -1, sentMinLines: 0 });
    assert.equal(low.minLines, 1);
    assert.equal(low.minChars, 0);
    assert.equal(low.sentMinChars, 0);
    assert.equal(low.sentMinLines, 1);

    const high = normalizeCollapseConfig({ minLines: 101, minChars: 200_000, sentMinLines: 200_000 });
    assert.equal(high.minLines, 100);
    assert.equal(high.minChars, 100_000);
    assert.equal(high.sentMinLines, 100_000);
});

test("fractions floor and non-numbers fall back", () => {
    const value = normalizeCollapseConfig({ minLines: 3.9, minChars: "abc", sentMinChars: null });
    assert.equal(value.minLines, 3);
    assert.equal(value.minChars, DEFAULT_COLLAPSE_CONFIG.minChars);
    assert.equal(value.sentMinChars, DEFAULT_COLLAPSE_CONFIG.sentMinChars);
});

test("booleans only turn off when explicitly false", () => {
    assert.equal(normalizeCollapseConfig({ active: false }).active, false);
    assert.equal(normalizeCollapseConfig({ active: true }).active, true);
    assert.equal(normalizeCollapseConfig({ foldSent: false }).foldSent, false);
});
