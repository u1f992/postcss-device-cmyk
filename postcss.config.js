// @ts-check

import path from "node:path";

import atImport from "postcss-import";
import deviceCMYK from "./dist/index.js";

// FIXME: Is there a way to retrieve `outputDir` from `ctx`?
const outputDir = (() => {
  const idx = process.argv.findLastIndex(
    (arg) => arg === "-o" || arg === "--output"
  );
  return idx !== -1 && process.argv[idx + 1]
    ? path.dirname(process.argv[idx + 1])
    : "";
})();

export default (ctx) => ({
  map: true,
  plugins: [
    // This plugin works seamlessly with `postcss-import`;
    // otherwise, you would need to list all dependent files in `otherFiles`.
    atImport({ root: ctx.file.dirname }),

    deviceCMYK({
      cmykProfilePath: "../JapanColor2001Coated.icc",
      restoreJSONPath: path.join(outputDir, "device-cmyk.restore.json"),
      otherFiles: [
        // You can also specify additional CSS files that are not directly
        // `@import`ed in the input CSS but are linked together in the HTML.
        path.join(ctx.file.dirname, "cyan2.css"),
      ],
    }),
  ],
});
