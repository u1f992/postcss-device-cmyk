import type valueParser from "postcss-value-parser";

const isComma = (
  node: valueParser.Node | undefined
): node is valueParser.DivNode & { value: "," } =>
  !!node && node.type === "div" && node.value === ",";

const isSpace = (
  node: valueParser.Node | undefined
): node is valueParser.SpaceNode => !!node && node.type === "space";

const isSlash = (
  node: valueParser.Node | undefined
): node is valueParser.DivNode & { value: "/" } =>
  !!node && node.type === "div" && node.value === "/";

const clamp = (num: number) => Math.max(0, Math.min(num, 1));

function parseNumberOrPercentageOrNone(
  node: valueParser.Node | undefined
): number | "none" | null {
  if (!node || node.type !== "word") {
    return null;
  }
  const value = node.value.trim();
  if (value === "none") {
    return "none";
  } else if (value.endsWith("%")) {
    const num = Number.parseFloat(value.slice(0, -1));
    return !Number.isFinite(num) ? null : num / 100;
  } else {
    const num = Number.parseFloat(value);
    return !Number.isFinite(num) ? null : num;
  }
}

export type CMYKColor = readonly [
  c: number | "none",
  m: number | "none",
  y: number | "none",
  k: number | "none",
  a: number | "none" | null,
];

/**
 * @see https://drafts.csswg.org/css-color-5/#device-cmyk
 */
export function parseCMYKComponents(
  nodes: valueParser.Node[]
): CMYKColor | null {
  const withoutComments = nodes.filter((node) => node.type !== "comment");
  // console.debug(withoutComments);
  const shouldC = parseNumberOrPercentageOrNone(withoutComments[0]);
  const shouldM = parseNumberOrPercentageOrNone(withoutComments[2]);
  const shouldY = parseNumberOrPercentageOrNone(withoutComments[4]);
  const shouldK = parseNumberOrPercentageOrNone(withoutComments[6]);
  return ![7, 9].includes(withoutComments.length) ||
    shouldC === null ||
    shouldM === null ||
    shouldY === null ||
    shouldK === null
    ? null
    : shouldC !== "none" &&
        isComma(withoutComments[1]) &&
        shouldM !== "none" &&
        isComma(withoutComments[3]) &&
        shouldY !== "none" &&
        isComma(withoutComments[5]) &&
        shouldK !== "none"
      ? [clamp(shouldC), clamp(shouldM), clamp(shouldY), clamp(shouldK), null]
      : isSpace(withoutComments[1]) &&
          isSpace(withoutComments[3]) &&
          isSpace(withoutComments[5])
        ? (() => {
            const mayA = parseNumberOrPercentageOrNone(withoutComments[8]);
            return [
              shouldC === "none" ? ("none" as const) : clamp(shouldC),
              shouldM === "none" ? ("none" as const) : clamp(shouldM),
              shouldY === "none" ? ("none" as const) : clamp(shouldY),
              shouldK === "none" ? ("none" as const) : clamp(shouldK),
              isSlash(withoutComments[7]) && mayA !== null
                ? mayA === "none"
                  ? ("none" as const)
                  : clamp(mayA)
                : null,
            ];
          })()
        : null;
}

/**
 * @see https://drafts.csswg.org/css-color-4/#missing
 */
const noneBehavesAsZero = (component: number | "none") =>
  component === "none" ? 0 : component;

export type RestrictedCMYKColor = readonly [
  c: number,
  m: number,
  y: number,
  k: number,
  a: number,
];

export function applyKnownLimitations([
  c,
  m,
  y,
  k,
  a,
]: CMYKColor): RestrictedCMYKColor {
  return [
    noneBehavesAsZero(c),
    noneBehavesAsZero(m),
    noneBehavesAsZero(y),
    noneBehavesAsZero(k),
    a === null ? 1 : noneBehavesAsZero(a),
  ];
}
