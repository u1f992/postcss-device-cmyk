import { ciede2000 } from "./ciede2000.js";
import {
  CMYKColorString,
  parseCMYKColor,
  RGBColor,
  RGBColorString,
  parseRGBColor,
  stringifyRGBColor,
} from "./color-spaces.js";
import { CMYKToRGB, CMYKToLab, RGBToLab } from "./transform.js";

function createRawTransformationTable(
  cmykStorage: Set<CMYKColorString>,
  cmykProfile: Uint8Array,
  out: Map<CMYKColorString, RGBColorString>
): void {
  using cmykToRGB = new CMYKToRGB(cmykProfile, true);
  for (const cmykJSON of cmykStorage) {
    const cmykColor = parseCMYKColor(cmykJSON);
    const rgbColor = cmykToRGB.transform(cmykColor);
    out.set(cmykJSON, stringifyRGBColor(rgbColor));
  }
}

function reversed<TK, TV>(map: Map<TK, TV>): Map<TV, Set<TK>> {
  const ret = new Map<TV, Set<TK>>();
  for (const [k, v] of map.entries()) {
    if (!ret.has(v)) {
      ret.set(v, new Set());
    }
    ret.get(v)!.add(k);
  }
  return ret;
}

function generateVariants(rgb: RGBColor, delta: number): RGBColor[] {
  const ranges = rgb.map((c) =>
    Array.from({ length: delta * 2 + 1 }, (_, i) =>
      Math.max(0, Math.min(255, c - delta + i))
    )
  );
  return Array.from(
    new Set(
      ranges[0].flatMap((r) =>
        ranges[1].flatMap((g) =>
          ranges[2]
            .filter((b) => r !== rgb[0] || g !== rgb[1] || b !== rgb[2])
            .map((b) => stringifyRGBColor([r, g, b]))
        )
      )
    )
  ).map((str) => parseRGBColor(str));
}

function deduplicate(
  map: Map<CMYKColorString, RGBColorString>,
  cmykProfile: Uint8Array
): void {
  const nextRGBStorage = new Map<CMYKColorString, RGBColorString[]>();

  using cmykToLab = new CMYKToLab(cmykProfile, true);
  using rgbToLab = new RGBToLab(true);

  let conflicting = new Map(
    Array.from(reversed(map).entries()).filter(([_, v]) => v.size !== 1)
  );

  while (conflicting.size !== 0) {
    for (const [rgb, cmykSet] of conflicting.entries()) {
      const rgbColor = parseRGBColor(rgb);
      const labFromRGB = rgbToLab.transform(rgbColor);

      const notChosen = Array.from(cmykSet)
        .map((cmyk) => ({
          cmyk,
          lab: cmykToLab.transform(parseCMYKColor(cmyk)),
        }))
        .sort(
          (a, b) =>
            ciede2000(labFromRGB, a.lab).delta_E_00 -
            ciede2000(labFromRGB, b.lab).delta_E_00
        )
        .map(({ cmyk }) => cmyk)
        .slice(1);

      for (const cmyk of notChosen) {
        if (!nextRGBStorage.has(cmyk)) {
          const nextRGBList = generateVariants(rgbColor, 10)
            .map((rgb) => ({
              rgb,
              lab: rgbToLab.transform(rgb),
            }))
            .sort(
              (a, b) =>
                ciede2000(labFromRGB, a.lab).delta_E_00 -
                ciede2000(labFromRGB, b.lab).delta_E_00
            )
            .map(({ rgb }) => stringifyRGBColor(rgb));
          nextRGBList.unshift(rgb);
          nextRGBStorage.set(cmyk, nextRGBList);
        }

        const arr = nextRGBStorage.get(cmyk);
        const idx = arr!.indexOf(rgb);
        if (idx === -1) {
          throw new Error();
        }
        const nextRGB = arr![idx + 1];

        map.set(cmyk, nextRGB);
      }
    }
    conflicting = new Map(
      Array.from(reversed(map).entries()).filter(([_, v]) => v.size !== 1)
    );
  }
}

export function createTransformationTable(
  cmykStorage: Set<CMYKColorString>,
  cmykProfile: Uint8Array,
  outTransformationTable: Map<CMYKColorString, RGBColorString>
): void {
  createRawTransformationTable(
    cmykStorage,
    cmykProfile,
    outTransformationTable
  );
  deduplicate(outTransformationTable, cmykProfile);
}

export function createRestorationTable(
  transformationTable: Map<CMYKColorString, RGBColorString>
) {
  return new Map(
    Array.from(transformationTable.entries()).map(([v, k]) => [k, v])
  );
}
