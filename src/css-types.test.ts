import { asCSSNumber, asCSSPercentage } from "./css-types.js";

import * as test from "node:test";
import assert from "node:assert";

test.test("CSSNumber", async (t) => {
  await t.test("valid", async () => {
    const testCases = [
      "0",
      "11",
      "-9",
      "+9",
      "11",
      "0.1",
      ".1",
      "-0.1",
      "-.1",
      "+0.1",
      "+.1",
      "1e1",
      "1E1",
      "1e-1",
      "1E-1",
      "1e+1",
      "1E+1",
      "1.1e1",
      "1.1E1",
      "1.1e-1",
      "1.1E-1",
      "1.1e+1",
      "1.1E+1",
      ".1e1",
      ".1E1",
      ".1e-1",
      ".1E-1",
      ".1e+1",
      ".1E+1",
    ];
    for (const testCase of testCases) {
      assert.notStrictEqual(asCSSNumber(testCase), null, `${testCase}`);
    }
  });
  await t.test("invalid", async () => {
    const testCases = ["", "00", "a"];
    for (const testCase of testCases) {
      assert.strictEqual(asCSSNumber(testCase), null);
    }
  });
});

test.test("CSSPercentage", async (t) => {
  await t.test("valid", async () => {
    const testCases = [
      "0%",
      "11%",
      "-9%",
      "+9%",
      "11%",
      "0.1%",
      ".1%",
      "-0.1%",
      "-.1%",
      "+0.1%",
      "+.1%",
      "1e1%",
      "1E1%",
      "1e-1%",
      "1E-1%",
      "1e+1%",
      "1E+1%",
      "1.1e1%",
      "1.1E1%",
      "1.1e-1%",
      "1.1E-1%",
      "1.1e+1%",
      "1.1E+1%",
      ".1e1%",
      ".1E1%",
      ".1e-1%",
      ".1E-1%",
      ".1e+1%",
      ".1E+1%",
    ];
    for (const testCase of testCases) {
      assert.notStrictEqual(asCSSPercentage(testCase), null, `${testCase}`);
    }
  });
  await t.test("invalid", async () => {
    const testCases = ["", "00", "a", "%"];
    for (const testCase of testCases) {
      assert.strictEqual(asCSSPercentage(testCase), null);
    }
  });
});
