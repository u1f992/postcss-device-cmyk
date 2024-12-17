import {
  instantiate,
  INTENT_RELATIVE_COLORIMETRIC,
  cmsFLAGS_NOCACHE,
  cmsFLAGS_HIGHRESPRECALC,
  cmsFLAGS_NOOPTIMIZE,
  cmsFLAGS_BLACKPOINTCOMPENSATION,

  // @ts-ignore
} from "lcms-wasm";

const lcms = await instantiate();
const UINT16_MAX = 65535;

type Uint8Number = number & { __uint8Number: never };
function uint8Number(num: number): Uint8Number {
  return Math.min(255, Math.max(0, Math.round(num))) as Uint8Number;
}

type NormalizedNumber = number & { __normalizedNumber: never };
function normalizedNumber(num: number): NormalizedNumber {
  return Math.min(1, Math.max(0, num)) as NormalizedNumber;
}

export type Uint8RGBColor = [Uint8Number, Uint8Number, Uint8Number] & {
  __rgbColor: never;
};
export type Uint8RGBColorString = string & { __uint8RGBColorString: never };
export function uint8RGBColor(rgb: [number, number, number]): Uint8RGBColor {
  return rgb.map((c) => uint8Number(c)) as Uint8RGBColor;
}
export function parseUint8RGBColor(str: Uint8RGBColorString): Uint8RGBColor {
  return JSON.parse(str) as Uint8RGBColor;
}
export function stringifyUint8RGBColor(
  rgb: Uint8RGBColor
): Uint8RGBColorString {
  return JSON.stringify(rgb) as Uint8RGBColorString;
}

export type CMYKColor = [
  NormalizedNumber,
  NormalizedNumber,
  NormalizedNumber,
  NormalizedNumber,
] & { __cmykColor: never };
export type CMYKColorString = string & { __cmykColorString: never };
export function cmykColor(cmyk: [number, number, number, number]): CMYKColor {
  return cmyk.map((c) => normalizedNumber(c)) as CMYKColor;
}
export function parseCMYKColor(str: CMYKColorString): CMYKColor {
  return JSON.parse(str) as CMYKColor;
}
export function stringifyCMYKColor(cmyk: CMYKColor): CMYKColorString {
  return JSON.stringify(cmyk) as CMYKColorString;
}

export type CIELABColor = [number, number, number] & { __cielabColor: never };

type NormalizedRGBColor = [
  NormalizedNumber,
  NormalizedNumber,
  NormalizedNumber,
] & {
  __normalizedRGBColor: never;
};
/**
 * https://www.w3.org/TR/css-color-5/#cmyk-rgb
 */
function convertCMYKToNormalizedRGBNaively([
  cyan,
  magenta,
  yellow,
  black,
]: CMYKColor): NormalizedRGBColor {
  return [
    normalizedNumber(1 - Math.min(1, cyan * (1 - black) + black)),
    normalizedNumber(1 - Math.min(1, magenta * (1 - black) + black)),
    normalizedNumber(1 - Math.min(1, yellow * (1 - black) + black)),
  ] as NormalizedRGBColor;
}
function convertCMYKToRGBNaively(cmyk: CMYKColor): Uint8RGBColor {
  return uint8RGBColor(
    convertCMYKToNormalizedRGBNaively(cmyk).map((c) => c * 255) as [
      number,
      number,
      number,
    ]
  );
}
/**
 * Written by ChatGPT. As a matter of fact, I am uncertain whether this implementation is appropriate.
 */
function convertNormalizedRGBToCIELABNaively([
  red,
  green,
  blue,
]: NormalizedRGBColor): CIELABColor {
  // RGB -> XYZ conversion
  const x_D65 = red * 0.4124564 + green * 0.3575761 + blue * 0.1804375;
  const y_D65 = red * 0.2126729 + green * 0.7151522 + blue * 0.072175;
  const z_D65 = red * 0.0193339 + green * 0.119192 + blue * 0.9503041;

  // Bradford transformation for D65 -> D50
  const M_Bradford = [
    [0.9555766, -0.0230393, 0.0631636],
    [-0.0282895, 1.0099416, 0.0210077],
    [0.0122982, -0.020483, 1.3299098],
  ];

  const x =
    M_Bradford[0][0] * x_D65 +
    M_Bradford[0][1] * y_D65 +
    M_Bradford[0][2] * z_D65;
  const y =
    M_Bradford[1][0] * x_D65 +
    M_Bradford[1][1] * y_D65 +
    M_Bradford[1][2] * z_D65;
  const z =
    M_Bradford[2][0] * x_D65 +
    M_Bradford[2][1] * y_D65 +
    M_Bradford[2][2] * z_D65;

  // Reference white point (D50)
  const x_n = 0.9642;
  const y_n = 1.0;
  const z_n = 0.8249;

  // XYZ -> CIELAB conversion
  const f = (t: number) =>
    t > 0.008856 ? Math.cbrt(t) : (903.3 * t + 16) / 116;

  const fx = f(x / x_n);
  const fy = f(y / y_n);
  const fz = f(z / z_n);

  const l = 116 * fy - 16;
  const a = 500 * (fx - fy);
  const b = 200 * (fy - fz);

  return [l, a, b] as CIELABColor;
}

function convertCMYKToCIELABNaively(cmyk: CMYKColor) {
  return convertNormalizedRGBToCIELABNaively(
    convertCMYKToNormalizedRGBNaively(cmyk)
  );
}

export interface CMYKTransformer {
  toRGB: (cmyk: CMYKColor) => Uint8RGBColor;
  toCIELAB: (cmyk: CMYKColor) => CIELABColor;
  [Symbol.dispose]: () => void;
}

export function getNaiveCMYKTransformer(): CMYKTransformer {
  return {
    toRGB: convertCMYKToRGBNaively,
    toCIELAB: convertCMYKToCIELABNaively,
    [Symbol.dispose]: () => {},
  };
}

export class ManagedCMYKTransformer implements CMYKTransformer {
  #cmykProfile;
  #rgbProfile;
  #cielabProfile;
  #cmykToRGBTransformer;
  #cmykToCIELABTransformer;

  constructor(cmykProfile: Uint8Array, blackPointCompensation: boolean) {
    this.#cmykProfile = lcms.cmsOpenProfileFromMem(
      cmykProfile,
      cmykProfile.byteLength
    );
    const cmykFormatter = lcms.cmsFormatterForColorspaceOfProfile(
      this.#cmykProfile,
      2,
      false
    );

    this.#rgbProfile = lcms.cmsCreate_sRGBProfile();
    const rgbFormatter = lcms.cmsFormatterForColorspaceOfProfile(
      this.#rgbProfile,
      1,
      false
    );

    this.#cielabProfile = lcms.cmsCreateLab4Profile();
    const cielabFormatter = lcms.cmsFormatterForColorspaceOfProfile(
      this.#cielabProfile,
      4,
      true
    );

    const intent = INTENT_RELATIVE_COLORIMETRIC;
    const flags =
      cmsFLAGS_NOCACHE |
      cmsFLAGS_HIGHRESPRECALC |
      cmsFLAGS_NOOPTIMIZE |
      (blackPointCompensation ? cmsFLAGS_BLACKPOINTCOMPENSATION : 0);

    this.#cmykToRGBTransformer = lcms.cmsCreateTransform(
      this.#cmykProfile,
      cmykFormatter,
      this.#rgbProfile,
      rgbFormatter,
      intent,
      flags
    );

    this.#cmykToCIELABTransformer = lcms.cmsCreateTransform(
      this.#cmykProfile,
      cmykFormatter,
      this.#cielabProfile,
      cielabFormatter,
      intent,
      flags
    );
  }

  toRGB(cmyk: CMYKColor): Uint8RGBColor {
    // @ts-ignore
    return uint8RGBColor([
      ...lcms.cmsDoTransform(
        this.#cmykToRGBTransformer,
        new Uint16Array(
          cmyk.map((val) =>
            Math.round(Math.min(1, Math.max(0, val)) * UINT16_MAX)
          )
        ),
        1
      ),
    ]);
  }

  toCIELAB(cmyk: CMYKColor): CIELABColor {
    // @ts-ignore
    return [
      ...lcms.cmsDoTransform(
        this.#cmykToCIELABTransformer,
        new Uint16Array(
          cmyk.map((val) =>
            Math.round(Math.min(1, Math.max(0, val)) * UINT16_MAX)
          )
        ),
        1
      ),
    ];
  }

  [Symbol.dispose]() {
    lcms.cmsDeleteTransform(this.#cmykToCIELABTransformer);
    lcms.cmsDeleteTransform(this.#cmykToRGBTransformer);
    lcms.cmsCloseProfile(this.#cielabProfile);
    lcms.cmsCloseProfile(this.#rgbProfile);
    lcms.cmsCloseProfile(this.#cmykProfile);
  }
}

export class RGBToCIELABTransformer {
  #rgbProfile;
  #cielabProfile;
  #rgbToCIELABTransformer;

  constructor(blackPointCompensation: boolean) {
    this.#rgbProfile = lcms.cmsCreate_sRGBProfile();
    const rgbFormatter = lcms.cmsFormatterForColorspaceOfProfile(
      this.#rgbProfile,
      1,
      false
    );

    this.#cielabProfile = lcms.cmsCreateLab4Profile();
    const cielabFormatter = lcms.cmsFormatterForColorspaceOfProfile(
      this.#cielabProfile,
      4,
      true
    );

    const intent = INTENT_RELATIVE_COLORIMETRIC;
    const flags =
      cmsFLAGS_NOCACHE |
      cmsFLAGS_HIGHRESPRECALC |
      cmsFLAGS_NOOPTIMIZE |
      (blackPointCompensation ? cmsFLAGS_BLACKPOINTCOMPENSATION : 0);

    this.#rgbToCIELABTransformer = lcms.cmsCreateTransform(
      this.#rgbProfile,
      rgbFormatter,
      this.#cielabProfile,
      cielabFormatter,
      intent,
      flags
    );
  }

  toCIELAB(rgb: Uint8RGBColor): CIELABColor {
    // @ts-ignore
    return [
      ...lcms.cmsDoTransform(
        this.#rgbToCIELABTransformer,
        new Uint8ClampedArray(rgb),
        1
      ),
    ];
  }

  [Symbol.dispose]() {
    lcms.cmsDeleteTransform(this.#rgbToCIELABTransformer);
    lcms.cmsCloseProfile(this.#cielabProfile);
    lcms.cmsCloseProfile(this.#rgbProfile);
  }
}
