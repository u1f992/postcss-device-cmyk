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
import { deviceCMYK, parseDeviceCMYK, sanitize } from "./_device-cmyk.js";

export { parseDeviceCMYK };

import { collectAtColorProfileRules } from "./color-profile.js";
import { collectDeviceCMYKFunctions } from "./device-cmyk.js";

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

export const PLUGIN_ID = "postcss-device-cmyk";
export const devickCMYK: postcss.PluginCreator<void> = Object.assign(
  () => ({
    postcssPlugin: PLUGIN_ID,
    // Use Once() instead of AtRule() to collect all @color-profiles before Once() in the next plugin
    Once(root: postcss.Root, { result }: postcss.Helpers) {
      const { atColorProfileRules, warnings: atColorProfileRulesWarnings } =
        collectAtColorProfileRules(root);
      const { deviceCMYKFunctions, warnings: deviceCMYKFunctionsWarnings } =
        collectDeviceCMYKFunctions(root);

      for (const warning of [
        ...atColorProfileRulesWarnings,
        ...deviceCMYKFunctionsWarnings,
      ]) {
        result.messages.push({
          type: "warning",
          plugin: PLUGIN_ID,
          warning,
        } as postcss.Message);
      }

      result.messages.push({
        type: "data",
        plugin: `${PLUGIN_ID}/collect-at-color-profile-rules`,
        data: atColorProfileRules,
      } as postcss.Message);

      result.messages.push({
        type: "data",
        plugin: `${PLUGIN_ID}/collect-device-cmyk-functions`,
        data: deviceCMYKFunctions,
      } as postcss.Message);
    },
  }),
  {
    /* FIXME: 型 'boolean' を型 'true' に割り当てることはできません。ts(2322) */
    postcss: true as true,
  }
);
