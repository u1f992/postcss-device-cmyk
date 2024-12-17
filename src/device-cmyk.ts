/**
 * https://www.w3.org/TR/css-syntax/#newline
 */
const newline = /\x0a/;

/**
 * https://www.w3.org/TR/css-syntax/#whitespace
 */
const whitespace = new RegExp(`(?:${newline.source})|\x09|\x20`);

const comment = /\/\*[\s\S]*?\*\//;

/**
 * FIXME: どこかで定義されていないか確認する
 */
const tokenSeparator = new RegExp(
  `(?:${whitespace.source})|(?:${comment.source})`
);

/**
 * A hash mark (#) indicates that the preceding type, word, or group occurs one
 * or more times, separated by comma tokens (which may optionally be surrounded
 * by [white space](https://www.w3.org/TR/css-syntax/#whitespace) and/or comments).
 * It may optionally be followed by the curly brace forms, above, to indicate
 * precisely how many times the repetition occurs, like `<length>#{1,4}`.
 *
 * https://drafts.csswg.org/css-values-4/#mult-comma
 */
const multComma = (re: RegExp, a: number) => {
  return new RegExp(
    Array(a)
      .fill(`(${re.source})`)
      .join(`(?:${tokenSeparator.source})*?,(?:${tokenSeparator.source})*?`)
  );
};

/**
 * A single number in curly braces ({A}) indicates that the preceding type, word,
 * or group occurs A times.
 *
 * https://drafts.csswg.org/css-values-4/#mult-num
 *
 * FIXME: "occurs A times"の意味がよくわからない。空白あるいはコメントを1つ以上挟む？
 */
const multNum = (re: RegExp, a: number) => {
  return new RegExp(
    Array(a).fill(`(${re.source})`).join(`(?:${tokenSeparator.source})+`)
  );
};

/**
 * When written literally, a number is either an [integer](https://drafts.csswg.org/css-values-4/#integer),
 * or zero or more decimal digits followed by a dot (.) followed by one or moredecimal digits;
 * optionally, it can be concluded by the letter "e" or "E" followed by an integer indicating
 * the base-ten exponent in [scientific notation](https://en.wikipedia.org/wiki/Scientific_notation).
 *
 * https://drafts.csswg.org/css-values-4/#number-value
 */
const number = /(?:(?:[\+-]?\d+?)|(?:[\+-]?\d*?\.\d+?))(?:[eE][\+-]?\d+?)?/;

/**
 * When written literally, a percentage consists of a [number](https://drafts.csswg.org/css-values-4/#number)
 * immediately followed by a percent sign %.
 *
 * https://drafts.csswg.org/css-values-4/#percentage-value
 */
const percentage = new RegExp(`(?:${number.source})%`);

/**
 * https://drafts.csswg.org/css-color-4/#typedef-color-alpha-value
 */
const alphaValue = new RegExp(`(?:${number.source})|(?:${percentage.source})`);

/**
 * `<cmyk-component> = <number> | <percentage> | none`
 *
 * https://drafts.csswg.org/css-color-5/#device-cmyk
 */
const cmykComponent = new RegExp(
  `(?:${number.source})|(?:${percentage.source})|(?:none)`
);

/**
 * `<legacy-device-cmyk-syntax> = device-cmyk( <number>#{4} )`
 *
 * https://drafts.csswg.org/css-color-5/#device-cmyk
 */
const legacyDeviceCMYKSyntax = new RegExp(
  `device-cmyk\\((?:${tokenSeparator.source})*(?:${
    multComma(number, 4).source
  })(?:${tokenSeparator.source})*\\)`
);

/**
 * `<modern-device-cmyk-syntax> = device-cmyk( <cmyk-component>{4} [ / [ <alpha-value> | none ] ]? )`
 *
 * https://drafts.csswg.org/css-color-5/#device-cmyk
 */
const modernDeviceCMYKSyntax = new RegExp(
  `device-cmyk\\((?:${tokenSeparator.source})*(?:${
    multNum(cmykComponent, 4).source
  })(?:(?:${tokenSeparator.source})*/(?:${tokenSeparator.source})*((?:${
    alphaValue.source
  })|none))?(?:${tokenSeparator.source})*\\)`
);

/**
 * `device-cmyk() = <legacy-device-cmyk-syntax> | <modern-device-cmyk-syntax>`
 *
 * https://drafts.csswg.org/css-color-5/#device-cmyk
 *
 * Legacy
 * - c: ret[1]
 * - m: ret[2]
 * - y: ret[3]
 * - k: ret[4]
 *
 * Modern
 * - c: ret[5]
 * - m: ret[6]
 * - y: ret[7]
 * - k: ret[8]
 * - a?: ret[9]
 */
const deviceCMYK = new RegExp(
  `(?:${legacyDeviceCMYKSyntax.source})|(?:${modernDeviceCMYKSyntax.source})`,
  "g"
);

export type NumberOrPercentageOrNone = number | `${number}%` | "none";

function parseLegacyComponent(val: string): number {
  return parseFloat(val);
}

function parseModernComponent(val: string): NumberOrPercentageOrNone {
  return (
    val === "none" || val.endsWith("%") ? val : parseFloat(val)
  ) as NumberOrPercentageOrNone;
}

export type DeviceCMYKParseResult = {
  c: NumberOrPercentageOrNone;
  m: NumberOrPercentageOrNone;
  y: NumberOrPercentageOrNone;
  k: NumberOrPercentageOrNone;
  a?: NumberOrPercentageOrNone;
};

export function matchDeviceCMYK(input: string): RegExpMatchArray | null {
  return input.match(deviceCMYK);
}

/**
 * https://drafts.csswg.org/css-color-5/#device-cmyk
 */
export function parseDeviceCMYK(input: string): DeviceCMYKParseResult | null {
  const match = new RegExp(`^(?:${deviceCMYK.source})$`).exec(input);
  return !match
    ? null
    : match[1]
      ? {
          c: parseLegacyComponent(match[1]),
          m: parseLegacyComponent(match[2]),
          y: parseLegacyComponent(match[3]),
          k: parseLegacyComponent(match[4]),
        }
      : {
          c: parseModernComponent(match[5]),
          m: parseModernComponent(match[6]),
          y: parseModernComponent(match[7]),
          k: parseModernComponent(match[8]),
          ...(typeof match[9] === "undefined"
            ? {}
            : { a: parseModernComponent(match[9]) }),
        };
}
