import {
  instantiate,
  INTENT_RELATIVE_COLORIMETRIC,
  cmsFLAGS_NOCACHE,
  cmsFLAGS_HIGHRESPRECALC,
  cmsFLAGS_NOOPTIMIZE,
  cmsFLAGS_BLACKPOINTCOMPENSATION,

  // @ts-ignore
} from "lcms-wasm";

import { CMYKColor, LabColor, RGBColor } from "./color-spaces.js";

const lcms = await instantiate();
const UINT16_MAX = 65535;

export class CMYKToRGB {
  #rgbProfile;
  #cmykProfile;
  #transformer;

  constructor(cmykProfile: Uint8Array, blackPointCompensation: boolean) {
    this.#rgbProfile = lcms.cmsCreate_sRGBProfile();
    const rgbFormatter = lcms.cmsFormatterForColorspaceOfProfile(
      this.#rgbProfile,
      1,
      false
    );

    this.#cmykProfile = lcms.cmsOpenProfileFromMem(
      cmykProfile,
      cmykProfile.byteLength
    );
    const cmykFormatter = lcms.cmsFormatterForColorspaceOfProfile(
      this.#cmykProfile,
      2,
      false
    );

    const intent = INTENT_RELATIVE_COLORIMETRIC;
    const flags =
      cmsFLAGS_NOCACHE |
      cmsFLAGS_HIGHRESPRECALC |
      cmsFLAGS_NOOPTIMIZE |
      (blackPointCompensation ? cmsFLAGS_BLACKPOINTCOMPENSATION : 0);

    this.#transformer = lcms.cmsCreateTransform(
      this.#cmykProfile,
      cmykFormatter,
      this.#rgbProfile,
      rgbFormatter,
      intent,
      flags
    );
  }

  transform(cmyk: CMYKColor): RGBColor {
    // @ts-ignore
    return [
      ...lcms.cmsDoTransform(
        this.#transformer,
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
    lcms.cmsDeleteTransform(this.#transformer);
    lcms.cmsCloseProfile(this.#cmykProfile);
    lcms.cmsCloseProfile(this.#rgbProfile);
  }
}

export class CMYKToLab {
  #labProfile;
  #cmykProfile;
  #transformer;

  constructor(cmykProfile: Uint8Array, blackPointCompensation: boolean) {
    this.#labProfile = lcms.cmsCreateLab4Profile();
    const labFormatter = lcms.cmsFormatterForColorspaceOfProfile(
      this.#labProfile,
      4,
      true
    );

    this.#cmykProfile = lcms.cmsOpenProfileFromMem(
      cmykProfile,
      cmykProfile.byteLength
    );
    const cmykFormatter = lcms.cmsFormatterForColorspaceOfProfile(
      this.#cmykProfile,
      2,
      false
    );

    const intent = INTENT_RELATIVE_COLORIMETRIC;
    const flags =
      cmsFLAGS_NOCACHE |
      cmsFLAGS_HIGHRESPRECALC |
      cmsFLAGS_NOOPTIMIZE |
      (blackPointCompensation ? cmsFLAGS_BLACKPOINTCOMPENSATION : 0);

    this.#transformer = lcms.cmsCreateTransform(
      this.#cmykProfile,
      cmykFormatter,
      this.#labProfile,
      labFormatter,
      intent,
      flags
    );
  }

  transform(cmyk: CMYKColor): LabColor {
    // @ts-ignore
    return [
      ...lcms.cmsDoTransform(
        this.#transformer,
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
    lcms.cmsDeleteTransform(this.#transformer);
    lcms.cmsCloseProfile(this.#cmykProfile);
    lcms.cmsCloseProfile(this.#labProfile);
  }
}

export class RGBToLab {
  #labProfile;
  #rgbProfile;
  #transformer;

  constructor(blackPointCompensation: boolean) {
    this.#labProfile = lcms.cmsCreateLab4Profile();
    const labFormatter = lcms.cmsFormatterForColorspaceOfProfile(
      this.#labProfile,
      4,
      true
    );

    this.#rgbProfile = lcms.cmsCreate_sRGBProfile();
    const rgbFormatter = lcms.cmsFormatterForColorspaceOfProfile(
      this.#rgbProfile,
      1,
      false
    );

    const intent = INTENT_RELATIVE_COLORIMETRIC;
    const flags =
      cmsFLAGS_NOCACHE |
      cmsFLAGS_HIGHRESPRECALC |
      cmsFLAGS_NOOPTIMIZE |
      (blackPointCompensation ? cmsFLAGS_BLACKPOINTCOMPENSATION : 0);

    this.#transformer = lcms.cmsCreateTransform(
      this.#rgbProfile,
      rgbFormatter,
      this.#labProfile,
      labFormatter,
      intent,
      flags
    );
  }

  transform(rgb: RGBColor): LabColor {
    // @ts-ignore
    return [
      ...lcms.cmsDoTransform(this.#transformer, new Uint8ClampedArray(rgb), 1),
    ];
  }

  [Symbol.dispose]() {
    lcms.cmsDeleteTransform(this.#transformer);
    lcms.cmsCloseProfile(this.#rgbProfile);
    lcms.cmsCloseProfile(this.#labProfile);
  }
}
