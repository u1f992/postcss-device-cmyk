/* eslint-disable @typescript-eslint/no-unused-vars */

import postcss from "postcss";
import { devickCMYK } from "./index.js";

const ret = await postcss([
  devickCMYK,
  Object.assign(
    () => ({
      postcssPlugin: "next-plugin",
      Once(root: postcss.Root, { result }: postcss.Helpers) {
        // console.log(result.messages[0].data);
        // console.log(result.messages[1].data);
      },
    }),
    { postcss: true }
  ) as postcss.PluginCreator<void>,
]).process(
  `
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

div {
  color: device-cmyk(0, 0, 0, 0);
  color: device-cmyk(100% 0 0 0);
  color: device-cmyk(0 1 0 0 / 0.8);
  color: device-cmyk(1 1 0 0 / 90%);
  color: device-cmyk(0 0 1 0 / none);
}
`,
  { from: undefined }
);
