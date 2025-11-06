import { ciede2000 } from "./ciede2000.js";
import {
  CMYKColorString,
  parseCMYKColor,
  Uint8RGBColor,
  Uint8RGBColorString,
  parseUint8RGBColor,
  stringifyUint8RGBColor,
  uint8RGBColor,
  CMYKTransformer,
  RGBToCIELABTransformer,
} from "./color-spaces.js";

function createRawTransformationTable(
  cmykStorage: Set<CMYKColorString>,
  cmykTransformer: CMYKTransformer,
  out: Map<CMYKColorString, Uint8RGBColorString>
): void {
  for (const cmykJSON of cmykStorage) {
    const cmykColor = parseCMYKColor(cmykJSON);
    const rgbColor = cmykTransformer.toRGB(cmykColor);
    out.set(cmykJSON, stringifyUint8RGBColor(rgbColor));
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

function generateVariants(rgb: Uint8RGBColor, delta: number): Uint8RGBColor[] {
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
            .map((b) => stringifyUint8RGBColor(uint8RGBColor([r, g, b])))
        )
      )
    )
  ).map((str) => parseUint8RGBColor(str));
}

function deduplicate(
  map: Map<CMYKColorString, Uint8RGBColorString>,
  cmykTransformer: CMYKTransformer
): void {
  const nextRGBStorage = new Map<CMYKColorString, Uint8RGBColorString[]>();

  using rgbToCIELABTransformer = new RGBToCIELABTransformer(true);

  let conflicting = new Map(
    Array.from(reversed(map).entries()).filter(([_, v]) => v.size !== 1)
  );

  while (conflicting.size !== 0) {
    for (const [rgb, cmykSet] of conflicting.entries()) {
      const rgbColor = parseUint8RGBColor(rgb);
      const labFromRGB = rgbToCIELABTransformer.toCIELAB(rgbColor);

      const notChosen = Array.from(cmykSet)
        .map((cmyk) => ({
          cmyk,
          lab: cmykTransformer.toCIELAB(parseCMYKColor(cmyk)),
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
              lab: rgbToCIELABTransformer.toCIELAB(rgb),
            }))
            .sort(
              (a, b) =>
                ciede2000(labFromRGB, a.lab).delta_E_00 -
                ciede2000(labFromRGB, b.lab).delta_E_00
            )
            .map(({ rgb }) => stringifyUint8RGBColor(rgb));
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
  cmykTransformer: CMYKTransformer,
  outTransformationTable: Map<CMYKColorString, Uint8RGBColorString>
): void {
  createRawTransformationTable(
    cmykStorage,
    cmykTransformer,
    outTransformationTable
  );
  deduplicate(outTransformationTable, cmykTransformer);
}

export function createRestorationTable(
  transformationTable: Map<CMYKColorString, Uint8RGBColorString>
) {
  return new Map(
    Array.from(transformationTable.entries()).map(([v, k]) => [k, v])
  );
}
