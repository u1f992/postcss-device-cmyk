export type RGBColor = [number, number, number];
export type RGBColorString = string & { _rgbColorString: never };

export function parseRGBColor(str: RGBColorString): RGBColor {
  return JSON.parse(str);
}

export function stringifyRGBColor(rgb: RGBColor): RGBColorString {
  return JSON.stringify(rgb) as RGBColorString;
}

export type CMYKColor = [number, number, number, number];
export type CMYKColorString = string & { _cmykColorString: never };

export function parseCMYKColor(str: CMYKColorString): CMYKColor {
  return JSON.parse(str);
}

export function stringifyCMYKColor(cmyk: CMYKColor): CMYKColorString {
  return JSON.stringify(cmyk) as CMYKColorString;
}

export type LabColor = [number, number, number];
