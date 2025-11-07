import postcss from "postcss";
import valueParser from "postcss-value-parser";

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

function parseNumberOrPercentageOrNone(node: valueParser.Node | undefined) {
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
type CMYKColor = [
  c: number | "none",
  m: number | "none",
  y: number | "none",
  k: number | "none",
  a: number | "none" | null,
];
type RestrictedCMYKColor = [
  c: number,
  m: number,
  y: number,
  k: number,
  a: number,
];

/**
 * @see https://drafts.csswg.org/css-color-5/#device-cmyk
 */
function parseCMYKComponents(nodes: valueParser.Node[]): CMYKColor | null {
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

function knownLimitations([c, m, y, k, a]: CMYKColor): RestrictedCMYKColor {
  return [
    noneBehavesAsZero(c),
    noneBehavesAsZero(m),
    noneBehavesAsZero(y),
    noneBehavesAsZero(k),
    a === null ? 1 : noneBehavesAsZero(a),
  ];
}

type DeviceCMYKOptions = {
  result?: Map<string, string> | undefined;
  toRGBProfile?: Uint8Array | undefined;
};

export const deviceCMYK: postcss.PluginCreator<DeviceCMYKOptions> =
  Object.assign(
    (opts: DeviceCMYKOptions | undefined) => {
      const result = opts?.result ?? new Map<string, string>();
      const toRGBProfile = opts?.toRGBProfile;

      return {
        postcssPlugin: "device-cmyk",

        Declaration(decl) {
          let changed = false;
          const ast = valueParser(decl.value);
          ast.walk((node) => {
            if (node.type !== "function" || node.value !== "device-cmyk") {
              return;
            }
            const parsed = parseCMYKComponents(node.nodes);
            if (parsed === null) {
              return;
            }
            const [c, m, y, k, a] = knownLimitations(parsed);
            const cmyk = [c, m, y, k] as const;

            // node.value = "color";
            // node.nodes = [
            //   { type: "word", value: "srgb" },
            //   { type: "space", value: " " },
            //   { type: "word", value: "0" },
            //   { type: "space", value: " " },
            //   { type: "word", value: "0" },
            //   { type: "space", value: " " },
            //   { type: "word", value: "0" },
            //   {
            //     type: "div",
            //     value: "/",
            //     before: " ",
            //     after: " ",
            //   },
            //   { type: "word", value: "1" },

            //   // eslint-disable-next-line @typescript-eslint/no-explicit-any
            // ] as any;

            // Do not walk into replaced node further
            changed = true;
            return !changed;
          });
          if (changed) {
            decl.value = ast.toString();
          }
        },
      } as postcss.Plugin;
    },
    { postcss: true as const }
  );

const css = `
.foo {
  --legacy-no-space: device-cmyk(0,0.1,0.2,0.3);
  --legacy-no-space-comment-0: device-cmyk(/**/0,0.1,0.2,0.3);
  --legacy-no-space-comment-1: device-cmyk(0/**/,0.1,0.2,0.3);

  --modern: device-cmyk(0 0.1 0.2 0.3);
  --modern-percentage: device-cmyk(0 10% 20% 30%);

  --modern-alpha: device-cmyk(0 0.1 0.2 0.3 / 0.5);
  --modern-alpha-percentage: device-cmyk(0 0.1 0.2 0.3 / 50%);

  --modern-allows-none: device-cmyk(0 none 0.2 0.3 / none);

  --example-border: 1px solid device-cmyk(0 0 0 1);
  --example-gradient: linear-gradient(device-cmyk(0 0 0 0), device-cmyk(1 0 0 0));
}
`;

const result = new Map<string, string>();
const processor = postcss([deviceCMYK({ result })]);
processor.process(css, { from: undefined }).then((result) => {
  console.log(result.css);
});
