import { toCSSNumber, toCSSPercentage } from "./util.js";

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
      assert.notStrictEqual(toCSSNumber(testCase), null, `${testCase}`);
    }
  });
  await t.test("invalid", async () => {
    const testCases = ["", "00", "a"];
    for (const testCase of testCases) {
      assert.strictEqual(toCSSNumber(testCase), null);
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
      assert.notStrictEqual(toCSSPercentage(testCase), null, `${testCase}`);
    }
  });
  await t.test("invalid", async () => {
    const testCases = ["", "00", "a", "%"];
    for (const testCase of testCases) {
      assert.strictEqual(toCSSPercentage(testCase), null);
    }
  });
});
