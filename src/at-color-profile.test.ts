import { collectAtColorProfileRules } from "./at-color-profile.js";

import assert from "node:assert";
import * as test from "node:test";

import postcss from "postcss";

test.test("collectAtColorProfileRules", async (t) => {
  assert.deepStrictEqual(
    Object.fromEntries(
      collectAtColorProfileRules(
        postcss.parse(`
@color-profile device-cmyk {
  src: url(foobar.icc);
}

@color-profile --my-cmyk {
  src: url("./profile/baz.icc");
  rendering-intent: perceptual;
}

@color-profile --my-rgb {
  components: red,/* comment */green  ,  blue;
}
`)
      ).atColorProfileRules
    ),
    {
      "device-cmyk": {
        src: "foobar.icc",
        "rendering-intent": "relative-colorimetric",
        components: null,
      },
      "--my-cmyk": {
        src: "./profile/baz.icc",
        "rendering-intent": "perceptual",
        components: null,
      },
      "--my-rgb": {
        src: null,
        "rendering-intent": "relative-colorimetric",
        components: ["red", "green", "blue"],
      },
    }
  );
});
