import fs from "node:fs";
import path from "node:path";

import postcss from "postcss";

import {
  CMYKColorString,
  parseCMYKColor,
  stringifyCMYKColor,
  RGBColorString,
  parseRGBColor,
} from "./color-spaces.js";
import {
  createTransformationTable,
  createRestorationTable,
} from "./create-tables.js";
import { deviceCMYK, parseDeviceCMYK, sanitize } from "./device-cmyk.js";

export { parseDeviceCMYK };

const gather = Object.assign(
  (cmykStorage: Set<CMYKColorString>) =>
    ({
      postcssPlugin: "postcss-device-cmyk-gather",
      Declaration(decl) {
        decl.value
          .match(deviceCMYK)
          ?.map((m) => parseDeviceCMYK(m))
          .filter((raw) => raw !== null)
          .forEach((raw) => cmykStorage.add(stringifyCMYKColor(sanitize(raw))));
      },
    }) as postcss.Plugin,
  { postcss: true }
);

export type Options = {
  cmykProfilePath: string;
  restoreJSONPath: string;
  otherFiles: readonly string[];
};

export default Object.assign(
  ({ cmykProfilePath, restoreJSONPath, otherFiles = [] }: Options) =>
    ({
      postcssPlugin: "postcss-device-cmyk",
      prepare() {
        const cmykProfile = fs.readFileSync(cmykProfilePath);
        const jsonWriter =
          (outputPath: string) => (obj: Record<string, any>) => {
            const outputDir = path.dirname(path.resolve(outputPath));
            if (!fs.existsSync(outputDir)) {
              fs.mkdirSync(outputDir, { recursive: true });
            }
            fs.writeFileSync(outputPath, JSON.stringify(obj), {
              encoding: "utf-8",
            });
          };
        const restoreJSONWriter = jsonWriter(restoreJSONPath);

        const transformationTable = new Map<CMYKColorString, RGBColorString>();

        return {
          async Once(root) {
            const cmykStorage = new Set<CMYKColorString>();

            const processor = postcss([gather(cmykStorage)]);
            await processor.process(root.toString(), {
              from: root.source?.input.from,
            });
            for (const file of otherFiles) {
              await processor.process(
                fs.readFileSync(file, { encoding: "utf-8" }),
                { from: file }
              );
            }

            createTransformationTable(
              cmykStorage,
              cmykProfile,
              transformationTable
            );
          },

          Declaration(decl) {
            decl.value
              .match(deviceCMYK)
              ?.map((m) => ({ m, raw: parseDeviceCMYK(m) }))
              .filter(({ raw }) => raw !== null)
              .forEach(({ m, raw }) => {
                const rgbJSON = transformationTable.get(
                  stringifyCMYKColor(sanitize(raw!))
                );
                if (!rgbJSON) {
                  throw new Error();
                }
                const [r, g, b] = parseRGBColor(rgbJSON);
                decl.value = decl.value.replaceAll(
                  m,
                  `rgb(${r} ${g} ${b}${raw!.a ? ` / ${raw!.a}` : ""})`
                );
              });
          },

          OnceExit() {
            const restorationTable =
              createRestorationTable(transformationTable);
            restoreJSONWriter(
              Object.fromEntries(
                Array.from(restorationTable).map(([rgb, cmyk]) => [
                  rgb,
                  parseCMYKColor(cmyk),
                ])
              )
            );
          },
        };
      },
    }) as postcss.Plugin,
  {
    postcss: true,
  }
);
