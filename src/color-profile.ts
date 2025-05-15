// @ts-check

import postcss from "postcss";
import valueParser from "postcss-value-parser";

/**
 * https://www.w3.org/TR/css-values-4/#typedef-dashed-ident
 */
type DashedIdent = `--${string}`;
type AcceptedTarget = DashedIdent | "device-cmyk";
type AcceptedProp = "src" | "rendering-intent" | "components";
type AcceptedRenderingIntentValue =
  | "relative-colorimetric"
  | "absolute-colorimetric"
  | "perceptual"
  | "saturation";
type ColorProfileSetting = {
  src: string | null;
  "rendering-intent": AcceptedRenderingIntentValue;
  components: string[] | null;
};

const DEFAULT_COLOR_PROFILE_SETTING: ColorProfileSetting = {
  src: null,
  "rendering-intent": "relative-colorimetric",
  components: null,
};

function isDashedIdent(target: string): target is DashedIdent {
  return (
    target.startsWith("--") &&
    /* FIXME: Not mented in the document */
    !target.includes(" ") &&
    !target.includes(",")
  );
}

function isDeviceCMYK(target: string): target is "device-cmyk" {
  return target === "device-cmyk";
}

function isValidTarget(target: string): target is AcceptedTarget {
  return isDashedIdent(target) || isDeviceCMYK(target);
}

function isValidProp(prop: string): prop is AcceptedProp {
  return prop === "src" || prop === "rendering-intent" || prop === "components";
}

function isValidRenderingIntent(
  renderingIntent: string
): renderingIntent is AcceptedRenderingIntentValue {
  return (
    renderingIntent === "relative-colorimetric" ||
    renderingIntent === "absolute-colorimetric" ||
    renderingIntent === "perceptual" ||
    renderingIntent === "saturation"
  );
}

function hasURL(
  parsedValue: valueParser.ParsedValue
): parsedValue is valueParser.ParsedValue & {
  nodes: [
    {
      type: "function";
      value: "url";
      nodes: [{ type: "string" | "word"; value: string }];
    },
  ];
} {
  const { nodes } = parsedValue;
  return (
    nodes.length === 1 &&
    nodes[0].type === "function" &&
    nodes[0].value === "url" &&
    nodes[0].nodes.length === 1 &&
    (nodes[0].nodes[0].type === "string" || nodes[0].nodes[0].type === "word")
  );
}

function extractComponents({ nodes }: valueParser.ParsedValue) {
  const filtered = nodes.filter((node) => node.type !== "comment");
  /**
   * Example input:
   *
   * ~~~
   * > valueParser("red , green , blue")
   * ValueParser {
   *   nodes: [
   *     { type: 'word', sourceIndex: 0, sourceEndIndex: 3, value: 'red' },
   *     { type: 'div', sourceIndex: 3, sourceEndIndex: 6, value: ',', before: ' ', after: ' ' },
   *     { type: 'word', sourceIndex: 6, sourceEndIndex: 11, value: 'green' },
   *     { type: 'div', sourceIndex: 11, sourceEndIndex: 14, value: ',', before: ' ', after: ' ' },
   *     { type: 'word', sourceIndex: 14, sourceEndIndex: 18, value: 'blue' }
   *   ]
   * }
   * ~~~
   */

  // The pattern must be [word, div, word, div, ..., word]
  // So the length must be odd
  if (filtered.length % 2 === 0) {
    return null;
  }
  const words = [];
  for (let i = 0; i < filtered.length; i++) {
    if (i % 2 === 0) {
      // Even indices must be of type 'word'
      if (filtered[i].type !== "word") {
        return null;
      }
      words.push(filtered[i].value);
    } else {
      // Odd indices must be of type 'div'
      if (filtered[i].type !== "div") {
        return null;
      }
    }
  }
  return words;
}

/**
 * https://www.w3.org/TR/css-color-5/#at-profile
 */
export function collectAtColorProfileRules(root: postcss.Root) {
  const fragments: ({ target: AcceptedTarget } & (
    | { prop: "src"; value: string }
    | { prop: "rendering-intent"; value: AcceptedRenderingIntentValue }
    | { prop: "components"; value: string[] }
  ))[] = [];
  const warnings: string[] = [];

  const seen = new WeakSet();
  root.walkDecls((decl) => {
    const { parent } = decl;
    if (
      !parent ||
      parent.type !== "atrule" ||
      (parent as postcss.AtRule).name !== "color-profile" ||
      seen.has(parent)
    ) {
      return;
    }
    seen.add(parent);

    const atRule = parent as postcss.AtRule;
    const { params: target } = atRule;
    if (!isValidTarget(target)) {
      warnings.push(`target: ${target} is invalid for @color-profile`);
      return;
    }
    atRule.walkDecls(({ prop, value }) => {
      if (!isValidProp(prop)) {
        warnings.push(
          `prop: ${prop} is invalid for @color-profile ${target} { ... }`
        );
        return;
      }
      if (prop === "src") {
        const parsed = valueParser(value);
        if (!hasURL(parsed)) {
          warnings.push(`value: ${value} does not contains url( ... )`);
          return;
        }
        fragments.push({
          target,
          prop,
          value: parsed.nodes[0].nodes[0].value,
        });
      } else if (prop === "rendering-intent") {
        if (!isValidRenderingIntent(value)) {
          warnings.push(
            `value: ${value} is invalid for @color-profile ${target} { rendering-intent: ... ; }`
          );
          return;
        }
        fragments.push({ target, prop, value });
      } else if (prop === "components") {
        const components = extractComponents(valueParser(value));
        if (components === null) {
          warnings.push(
            `components: ${value} cannot be parsed as \`<ident>#\``
          );
          return;
        }
        fragments.push({ target, prop, value: components });
      }
    });
  });

  const atColorProfileRules = fragments.reduce(
    (acc, cur) => {
      if (!Object.keys(acc).includes(cur.target)) {
        acc[cur.target] = structuredClone(DEFAULT_COLOR_PROFILE_SETTING);
      }
      // @ts-ignore
      acc[cur.target][cur.prop] = cur.value;
      return acc;
    },
    {
      "device-cmyk": structuredClone(DEFAULT_COLOR_PROFILE_SETTING),
    } as Record<AcceptedTarget, ColorProfileSetting>
  );

  return { atColorProfileRules, warnings };
}
