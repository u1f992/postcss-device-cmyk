const cssNumberBrand = Symbol();
/**
 * https://www.w3.org/TR/css-values-4/#number-value
 *
 * > When written literally, a *number* is either an [integer](https://www.w3.org/TR/css-values-4/#integer), or zero or more decimal digits followed by a dot (.) followed by one or more decimal digits; optionally, it can be concluded by the letter “e” or “E” followed by an integer indicating the base-ten exponent in [scientific notation](https://en.wikipedia.org/wiki/Scientific_notation). It corresponds to the [\<number-token\>](https://www.w3.org/TR/css-syntax-3/#typedef-number-token) production in the [CSS Syntax Module](https://www.w3.org/TR/css-syntax/) [\[CSS-SYNTAX-3\]](https://www.w3.org/TR/css-values-4/#biblio-css-syntax-3). As with integers, the first character of a number may be immediately preceded by ‘-’ or ‘+’ to indicate the number’s sign.
 */
export type CSSNumber = `${number}` & { [cssNumberBrand]: unknown };
export function asCSSNumber(input: string): CSSNumber | null {
  return /^[-+]?(?:(?:(?:0|[1-9][0-9]*)\.[0-9]+)|(?:0|[1-9][0-9]*)|(?:\.[0-9]+))(?:[eE](?:[-+]?(?:0|[1-9][0-9]*)))?$/.test(
    input
  )
    ? (input as CSSNumber)
    : null;
}

const cssPercentageBrand = Symbol();
/**
 * https://www.w3.org/TR/css-values-4/#percentage-value
 *
 * > When written literally, a *percentage* consists of a [number](https://www.w3.org/TR/css-values-4/#number) immediately followed by a percent sign ‘%’. It corresponds to the [\<percentage-token\>](https://www.w3.org/TR/css-syntax-3/#typedef-percentage-token) production in the [CSS Syntax Module](https://www.w3.org/TR/css-syntax/) [\[CSS-SYNTAX-3\]](https://www.w3.org/TR/css-values-4/#biblio-css-syntax-3).
 */
export type CSSPercentage = `${CSSNumber}%` & { [cssPercentageBrand]: unknown };
export function asCSSPercentage(input: string): CSSPercentage | null {
  return input.endsWith("%") && asCSSNumber(input.slice(0, -1)) !== null
    ? (input as CSSPercentage)
    : null;
}

const cssNoneBrand = Symbol();
export type CSSNone = "none" & { [cssNoneBrand]: unknown };
export function asCSSNone(input: string): CSSNone | null {
  return input === "none" ? (input as CSSNone) : null;
}

const cssDashedIdentBrand = Symbol();
/**
 * https://www.w3.org/TR/css-values-4/#typedef-dashed-ident
 *
 * > The ‘*[\<dashed-ident\>](https://www.w3.org/TR/css-values-4/#typedef-dashed-ident)*’ production is a [\<custom-ident\>](https://www.w3.org/TR/css-values-4/#identifier-value), with all the case-sensitivity that implies, with the additional restriction that it must start with two dashes (U+002D HYPHEN-MINUS).
 */
export type CSSDashedIdent = `--${string}` & { [cssDashedIdentBrand]: unknown };
export function asCSSDashedIdent(input: string): CSSDashedIdent | null {
  return input.startsWith("--") &&
    /* FIXME: Not mented in the document */
    !input.includes(" ") &&
    !input.includes(",")
    ? (input as CSSDashedIdent)
    : null;
}
