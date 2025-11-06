import { collectDeviceCMYKFunctions } from "./device-cmyk.js";

import * as test from "node:test";
import assert from "node:assert";

import postcss from "postcss";

const testCases = {
  single: {
    legacy: {
      "comma-separated": {
        $: [
          "p { color: device-cmyk(0,0.1,0.2,0.3); }",
          [JSON.stringify(["0", "0.1", "0.2", "0.3"])],
        ],
        "space+$": [
          "p { color: device-cmyk( 0,0.1,0.2,0.3); }",
          [JSON.stringify(["0", "0.1", "0.2", "0.3"])],
        ],
        "space+$+space": [
          "p { color: device-cmyk( 0,0.1,0.2,0.3 ); }",
          [JSON.stringify(["0", "0.1", "0.2", "0.3"])],
        ],
        "space+$+comment": [
          "p { color: device-cmyk( 0,0.1,0.2,0.3/**/); }",
          [JSON.stringify(["0", "0.1", "0.2", "0.3"])],
        ],
        "comment+$": [
          "p { color: device-cmyk(/**/0,0.1,0.2,0.3); }",
          [JSON.stringify(["0", "0.1", "0.2", "0.3"])],
        ],
        "comment+$+space": [
          "p { color: device-cmyk(/**/0,0.1,0.2,0.3 ); }",
          [JSON.stringify(["0", "0.1", "0.2", "0.3"])],
        ],
        "comment+$+comment": [
          "p { color: device-cmyk(/**/0,0.1,0.2,0.3/**/); }",
          [JSON.stringify(["0", "0.1", "0.2", "0.3"])],
        ],
      },
      "(comma+space)-separated": {
        $: [
          "p { color: device-cmyk(0, 0.1, 0.2, 0.3); }",
          [JSON.stringify(["0", "0.1", "0.2", "0.3"])],
        ],
        "space+$": [
          "p { color: device-cmyk( 0, 0.1, 0.2, 0.3); }",
          [JSON.stringify(["0", "0.1", "0.2", "0.3"])],
        ],
        "space+$+space": [
          "p { color: device-cmyk( 0, 0.1, 0.2, 0.3 ); }",
          [JSON.stringify(["0", "0.1", "0.2", "0.3"])],
        ],
        "space+$+comment": [
          "p { color: device-cmyk( 0, 0.1, 0.2, 0.3/**/); }",
          [JSON.stringify(["0", "0.1", "0.2", "0.3"])],
        ],
        "comment+$": [
          "p { color: device-cmyk(/**/0, 0.1, 0.2, 0.3); }",
          [JSON.stringify(["0", "0.1", "0.2", "0.3"])],
        ],
        "comment+$+space": [
          "p { color: device-cmyk(/**/0, 0.1, 0.2, 0.3 ); }",
          [JSON.stringify(["0", "0.1", "0.2", "0.3"])],
        ],
        "comment+$+comment": [
          "p { color: device-cmyk(/**/0, 0.1, 0.2, 0.3/**/); }",
          [JSON.stringify(["0", "0.1", "0.2", "0.3"])],
        ],
      },
      "(comma+comment)-separated": {
        $: [
          "p { color: device-cmyk(0,/**/0.1,/**/0.2,/**/0.3); }",
          [JSON.stringify(["0", "0.1", "0.2", "0.3"])],
        ],
        "space+$": [
          "p { color: device-cmyk( 0,/**/0.1,/**/0.2,/**/0.3); }",
          [JSON.stringify(["0", "0.1", "0.2", "0.3"])],
        ],
        "space+$+space": [
          "p { color: device-cmyk( 0,/**/0.1,/**/0.2,/**/0.3 ); }",
          [JSON.stringify(["0", "0.1", "0.2", "0.3"])],
        ],
        "space+$+comment": [
          "p { color: device-cmyk( 0,/**/0.1,/**/0.2,/**/0.3/**/); }",
          [JSON.stringify(["0", "0.1", "0.2", "0.3"])],
        ],
        "comment+$": [
          "p { color: device-cmyk(/**/0,/**/0.1,/**/0.2,/**/0.3); }",
          [JSON.stringify(["0", "0.1", "0.2", "0.3"])],
        ],
        "comment+$+space": [
          "p { color: device-cmyk(/**/0,/**/0.1,/**/0.2,/**/0.3 ); }",
          [JSON.stringify(["0", "0.1", "0.2", "0.3"])],
        ],
        "comment+$+comment": [
          "p { color: device-cmyk(/**/0,/**/0.1,/**/0.2,/**/0.3/**/); }",
          [JSON.stringify(["0", "0.1", "0.2", "0.3"])],
        ],
      },
      "(space+comma+space)-separated": {
        $: [
          "p { color: device-cmyk(0 , 0.1 , 0.2 , 0.3); }",
          [JSON.stringify(["0", "0.1", "0.2", "0.3"])],
        ],
        "space+$": [
          "p { color: device-cmyk( 0 , 0.1 , 0.2 , 0.3); }",
          [JSON.stringify(["0", "0.1", "0.2", "0.3"])],
        ],
        "space+$+space": [
          "p { color: device-cmyk( 0 , 0.1 , 0.2 , 0.3 ); }",
          [JSON.stringify(["0", "0.1", "0.2", "0.3"])],
        ],
        "space+$+comment": [
          "p { color: device-cmyk( 0 , 0.1 , 0.2 , 0.3/**/); }",
          [JSON.stringify(["0", "0.1", "0.2", "0.3"])],
        ],
        "comment+$": [
          "p { color: device-cmyk(/**/0 , 0.1 , 0.2 , 0.3); }",
          [JSON.stringify(["0", "0.1", "0.2", "0.3"])],
        ],
        "comment+$+space": [
          "p { color: device-cmyk(/**/0 , 0.1 , 0.2 , 0.3 ); }",
          [JSON.stringify(["0", "0.1", "0.2", "0.3"])],
        ],
        "comment+$+comment": [
          "p { color: device-cmyk(/**/0 , 0.1 , 0.2 , 0.3/**/); }",
          [JSON.stringify(["0", "0.1", "0.2", "0.3"])],
        ],
      },
      "(space+comma+comment)-separated": {
        $: [
          "p { color: device-cmyk(0 ,/**/0.1 ,/**/0.2 ,/**/0.3); }",
          [JSON.stringify(["0", "0.1", "0.2", "0.3"])],
        ],
        "space+$": [
          "p { color: device-cmyk( 0 ,/**/0.1 ,/**/0.2 ,/**/0.3); }",
          [JSON.stringify(["0", "0.1", "0.2", "0.3"])],
        ],
        "space+$+space": [
          "p { color: device-cmyk( 0 ,/**/0.1 ,/**/0.2 ,/**/0.3 ); }",
          [JSON.stringify(["0", "0.1", "0.2", "0.3"])],
        ],
        "space+$+comment": [
          "p { color: device-cmyk( 0 ,/**/0.1 ,/**/0.2 ,/**/0.3/**/); }",
          [JSON.stringify(["0", "0.1", "0.2", "0.3"])],
        ],
        "comment+$": [
          "p { color: device-cmyk(/**/0 ,/**/0.1 ,/**/0.2 ,/**/0.3); }",
          [JSON.stringify(["0", "0.1", "0.2", "0.3"])],
        ],
        "comment+$+space": [
          "p { color: device-cmyk(/**/0 ,/**/0.1 ,/**/0.2 ,/**/0.3 ); }",
          [JSON.stringify(["0", "0.1", "0.2", "0.3"])],
        ],
        "comment+$+comment": [
          "p { color: device-cmyk(/**/0 ,/**/0.1 ,/**/0.2 ,/**/0.3/**/); }",
          [JSON.stringify(["0", "0.1", "0.2", "0.3"])],
        ],
      },
      "(comment+comma+space)-separated": {
        $: [
          "p { color: device-cmyk(0/**/, 0.1/**/, 0.2/**/, 0.3); }",
          [JSON.stringify(["0", "0.1", "0.2", "0.3"])],
        ],
        "space+$": [
          "p { color: device-cmyk( 0/**/, 0.1/**/, 0.2/**/, 0.3); }",
          [JSON.stringify(["0", "0.1", "0.2", "0.3"])],
        ],
        "space+$+space": [
          "p { color: device-cmyk( 0/**/, 0.1/**/, 0.2/**/, 0.3 ); }",
          [JSON.stringify(["0", "0.1", "0.2", "0.3"])],
        ],
        "space+$+comment": [
          "p { color: device-cmyk( 0/**/, 0.1/**/, 0.2/**/, 0.3/**/); }",
          [JSON.stringify(["0", "0.1", "0.2", "0.3"])],
        ],
        "comment+$": [
          "p { color: device-cmyk(/**/0/**/, 0.1/**/, 0.2/**/, 0.3); }",
          [JSON.stringify(["0", "0.1", "0.2", "0.3"])],
        ],
        "comment+$+space": [
          "p { color: device-cmyk(/**/0/**/, 0.1/**/, 0.2/**/, 0.3 ); }",
          [JSON.stringify(["0", "0.1", "0.2", "0.3"])],
        ],
        "comment+$+comment": [
          "p { color: device-cmyk(/**/0/**/, 0.1/**/, 0.2/**/, 0.3/**/); }",
          [JSON.stringify(["0", "0.1", "0.2", "0.3"])],
        ],
      },
      "(comment+comma+comment)-separated": {
        $: [
          "p { color: device-cmyk(0/**/,/**/0.1/**/,/**/0.2/**/,/**/0.3); }",
          [JSON.stringify(["0", "0.1", "0.2", "0.3"])],
        ],
        "space+$": [
          "p { color: device-cmyk( 0/**/,/**/0.1/**/,/**/0.2/**/,/**/0.3); }",
          [JSON.stringify(["0", "0.1", "0.2", "0.3"])],
        ],
        "space+$+space": [
          "p { color: device-cmyk( 0/**/,/**/0.1/**/,/**/0.2/**/,/**/0.3 ); }",
          [JSON.stringify(["0", "0.1", "0.2", "0.3"])],
        ],
        "space+$+comment": [
          "p { color: device-cmyk( 0/**/,/**/0.1/**/,/**/0.2/**/,/**/0.3/**/); }",
          [JSON.stringify(["0", "0.1", "0.2", "0.3"])],
        ],
        "comment+$": [
          "p { color: device-cmyk(/**/0/**/,/**/0.1/**/,/**/0.2/**/,/**/0.3); }",
          [JSON.stringify(["0", "0.1", "0.2", "0.3"])],
        ],
        "comment+$+space": [
          "p { color: device-cmyk(/**/0/**/,/**/0.1/**/,/**/0.2/**/,/**/0.3 ); }",
          [JSON.stringify(["0", "0.1", "0.2", "0.3"])],
        ],
        "comment+$+comment": [
          "p { color: device-cmyk(/**/0/**/,/**/0.1/**/,/**/0.2/**/,/**/0.3/**/); }",
          [JSON.stringify(["0", "0.1", "0.2", "0.3"])],
        ],
      },
    },
    modern: {
      "without-alpha": {
        number: {
          "space-separated": {
            $: [
              "p { color: device-cmyk(0 0.1 0.2 0.3); }",
              [JSON.stringify(["0", "0.1", "0.2", "0.3"])],
            ],
          },
          "comment-separated": {
            $: [
              "p { color: device-cmyk(0/**/0.1/**/0.2/**/0.3); }",
              [JSON.stringify(["0", "0.1", "0.2", "0.3"])],
            ],
          },
        },
        percentage: {
          "space-separated": {
            $: [
              "p { color: device-cmyk(0% 0.1% 0.2% 0.3%); }",
              [JSON.stringify(["0%", "0.1%", "0.2%", "0.3%"])],
            ],
          },
          "comment-separated": {
            $: [
              "p { color: device-cmyk(0%/**/0.1%/**/0.2%/**/0.3%); }",
              [JSON.stringify(["0%", "0.1%", "0.2%", "0.3%"])],
            ],
          },
        },
        none: {
          "space-separated": {
            $: [
              "p { color: device-cmyk(none none none none); }",
              [JSON.stringify(["none", "none", "none", "none"])],
            ],
          },
          "comment-separated": {
            $: [
              "p { color: device-cmyk(none/**/none/**/none/**/none); }",
              [JSON.stringify(["none", "none", "none", "none"])],
            ],
          },
        },
      },
      "with-alpha": {
        number: {
          "space-separated": {
            $: [
              "p { color: device-cmyk(0 0.1 0.2 0.3 / 0.4); }",
              [JSON.stringify(["0", "0.1", "0.2", "0.3", "0.4"])],
            ],
          },
          "comment-separated": {
            $: [
              "p { color: device-cmyk(0/**/0.1/**/0.2/**/0.3/**///**/0.4); }",
              [JSON.stringify(["0", "0.1", "0.2", "0.3", "0.4"])],
            ],
          },
        },
        percentage: {
          "space-separated": {
            $: [
              "p { color: device-cmyk(0% 0.1% 0.2% 0.3% / 0.4%); }",
              [JSON.stringify(["0%", "0.1%", "0.2%", "0.3%", "0.4%"])],
            ],
          },
          "comment-separated": {
            $: [
              "p { color: device-cmyk(0%/**/0.1%/**/0.2%/**/0.3%/**///**/0.4%); }",
              [JSON.stringify(["0%", "0.1%", "0.2%", "0.3%", "0.4%"])],
            ],
          },
        },
        none: {
          "space-separated": {
            $: [
              "p { color: device-cmyk(none none none none / none); }",
              [JSON.stringify(["none", "none", "none", "none", "none"])],
            ],
          },
          "comment-separated": {
            $: [
              "p { color: device-cmyk(none/**/none/**/none/**/none/**///**/none); }",
              [JSON.stringify(["none", "none", "none", "none", "none"])],
            ],
          },
        },
      },
    },
  },
  "full-css": [
    `.legacy-cyan {
  color: device-cmyk(1, 0, 0, 0);
}
.modern-key {
  color: device-cmyk(0 0 0 1 / 1)
}
.gradient-magenta {
  background: linear-gradient(device-cmyk(0 1 0 0), device-cmyk(0 0 0 0));
}`,
    [
      JSON.stringify(["1", "0", "0", "0"]),
      JSON.stringify(["0", "0", "0", "1", "1"]),
      JSON.stringify(["0", "1", "0", "0"]),
      JSON.stringify(["0", "0", "0", "0"]),
    ],
  ],
};

async function runTests(
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  obj: Record<string, [string, string[]] | Record<string, any>>,
  t: test.TestContext,
  path: string[]
) {
  for (const [key, value] of Object.entries(obj)) {
    if (Array.isArray(value)) {
      await t.test(key, () => {
        const { deviceCMYKFunctions } = collectDeviceCMYKFunctions(
          postcss.parse(value[0])
        );
        assert.deepStrictEqual(
          Array.from(deviceCMYKFunctions),
          value[1],
          path.join("/")
        );
      });
    } else {
      await t.test(key, async (subT) => {
        await runTests(value, subT, [...path, key]);
      });
    }
  }
}

test.test("collectDeviceCMYKFunctions", async (t) => {
  await runTests(testCases, t, ["collectDeviceCMYKFunctions"]);
});
