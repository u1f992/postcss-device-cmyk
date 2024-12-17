// @ts-check

import fs from "node:fs";
import path from "node:path";

import deviceCMYK from "./dist/index.js";

// FIXME: Is there a way to retrieve `outputDir` from `ctx`?
const outputDir = ((argv) => {
  const findLast = (flags) => {
    const idx = argv.findLastIndex((arg) => flags.includes(arg));
    return idx !== -1 && argv[idx + 1] ? argv[idx + 1] : null;
  };
  const dir = findLast(["-d", "--dir"]);
  const output = findLast(["-o", "--output"]);
  return dir
    ? path.resolve(dir)
    : output
      ? path.dirname(path.resolve(output))
      : "";
})(process.argv);

function collectFiles(dirname) {
  return fs.readdirSync(dirname, { withFileTypes: true }).flatMap((entry) => {
    const entryPath = path.join(dirname, entry.name);
    return entry.isDirectory()
      ? collectFiles(entryPath)
      : entry.isFile() && entryPath.endsWith(".css")
        ? [entryPath]
        : [];
  });
}

export default (ctx) => ({
  plugins: [
    deviceCMYK({
      profile: "../JapanColor2001Coated.icc",
      restore: outputDir,
      relatedFiles: collectFiles(ctx.file.dirname),
    }),
  ],
});
