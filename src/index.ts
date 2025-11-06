import fs from "node:fs";
import path from "node:path";

import postcss from "postcss";

import {
  CMYKColorString,
  parseCMYKColor,
  stringifyCMYKColor,
  Uint8RGBColorString,
  parseUint8RGBColor,
  ManagedCMYKTransformer,
  getNaiveCMYKTransformer,
  CMYKTransformer,
} from "./color-spaces.js";
import {
  createTransformationTable,
  createRestorationTable,
} from "./create-tables.js";
import { parseDeviceCMYK, sanitize } from "./_device-cmyk.js";

function pluginWithoutRestoration(
  cmykProfile: Uint8Array | null
): Omit<postcss.Plugin, "postcssPlugin"> {
  return {
    prepare() {
      let cmykTransformer: CMYKTransformer | null = null;
      return {
        Once() {
          cmykTransformer = cmykProfile
            ? new ManagedCMYKTransformer(cmykProfile, true)
            : getNaiveCMYKTransformer();
        },
        Declaration(decl) {
          parseDeviceCMYK(decl.value)
            ?.map((match) => ({ match, rawCMYKA: parseDeviceCMYK(match) }))
            .filter(({ rawCMYKA }) => rawCMYKA !== null)
            .forEach(({ match, rawCMYKA }) => {
              const cmyk = sanitize(rawCMYKA!);
              if (cmykProfile) {
                const [l, a, b] = cmykTransformer!.toCIELAB(cmyk);
                decl.value = decl.value.replaceAll(
                  match,
                  `lab(${l} ${a} ${b}${rawCMYKA!.a ? ` / ${rawCMYKA!.a}` : ""})`
                );
              } else {
                const [r, g, b] = cmykTransformer!.toRGB(cmyk);
                decl.value = decl.value.replaceAll(
                  match,
                  `rgb(${r} ${g} ${b}${rawCMYKA!.a ? ` / ${rawCMYKA!.a}` : ""})`
                );
              }
            });
        },
        OnceExit() {
          cmykTransformer![Symbol.dispose]();
          cmykTransformer = null;
        },
      };
    },
  };
}

import { collectAtColorProfileRules } from "./at-color-profile.js";
import { collectDeviceCMYKFunctions } from "./device-cmyk.js";

const gather = Object.assign(
  (cmykStorage: Set<CMYKColorString>) =>
    ({
      postcssPlugin: "postcss-device-cmyk-gather",
      Declaration(decl) {
        matchDeviceCMYK(decl.value)
          ?.map((m) => parseDeviceCMYK(m))
          .filter((raw) => raw !== null)
          .forEach((raw) => cmykStorage.add(stringifyCMYKColor(sanitize(raw))));
      },
    }) as postcss.Plugin,
  { postcss: true }
);

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function writeRestoreJSON(outputDir: string, obj: Record<string, any>) {
  if (!fs.existsSync(outputDir)) {
    fs.mkdirSync(outputDir, { recursive: true });
  }
  fs.writeFileSync(
    path.join(outputDir, "device-cmyk.restore.json"),
    JSON.stringify(obj),
    { encoding: "utf-8" }
  );
}

function pluginWithRestoration(
  cmykProfile: Uint8Array | null,
  outputDir: string,
  relatedFiles: readonly string[]
): Omit<postcss.Plugin, "postcssPlugin"> {
  return {
    prepare() {
      const transformationTable = new Map<
        CMYKColorString,
        Uint8RGBColorString
      >();

      return {
        async Once(root) {
          const cmykStorage = new Set<CMYKColorString>();

          const processor = postcss([gather(cmykStorage)]);
          await processor.process(root.toString(), {
            from: root.source?.input.from,
          });
          for (const file of relatedFiles) {
            await processor.process(
              fs.readFileSync(file, { encoding: "utf-8" }),
              { from: file }
            );
          }

          using cmykTransformer = cmykProfile
            ? new ManagedCMYKTransformer(cmykProfile, true)
            : getNaiveCMYKTransformer();
          createTransformationTable(
            cmykStorage,
            cmykTransformer,
            transformationTable
          );
        },

        Declaration(decl) {
          matchDeviceCMYK(decl.value)
            ?.map((m) => ({ m, raw: parseDeviceCMYK(m) }))
            .filter(({ raw }) => raw !== null)
            .forEach(({ m, raw }) => {
              const rgbJSON = transformationTable.get(
                stringifyCMYKColor(sanitize(raw!))
              );
              if (!rgbJSON) {
                throw new Error();
              }
              const [r, g, b] = parseUint8RGBColor(rgbJSON);
              decl.value = decl.value.replaceAll(
                m,
                `rgb(${r} ${g} ${b}${raw!.a ? ` / ${raw!.a}` : ""})`
              );
            });
        },

        OnceExit() {
          const restorationTable = createRestorationTable(transformationTable);
          writeRestoreJSON(
            outputDir,
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
  };
}

export type Options = {
  profile?: string;
  restore?: boolean | string;
  relatedFiles?: readonly string[];
};

export default Object.assign(
  ({ profile, restore = false, relatedFiles = [] }: Options) => {
    const cmykProfile =
      typeof profile !== "undefined" ? fs.readFileSync(profile) : null;
    return Object.assign(
      typeof restore === "boolean" && !restore
        ? pluginWithoutRestoration(cmykProfile)
        : pluginWithRestoration(
            cmykProfile,
            path.resolve(
              typeof restore === "boolean" ? process.cwd() : restore
            ),
            relatedFiles
          ),
      { postcssPlugin: "postcss-device-cmyk" }
    ) as postcss.Plugin;
  },
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
  { postcss: true as const }
);
