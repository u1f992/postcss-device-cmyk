// @ts-check

import postcss, { AtRule } from "postcss";
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
function collectAtColorProfileRules(root: postcss.Root) {
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

function extractLegacyDeviceCMYKSyntax({
  nodes,
}: valueParser.FunctionNode): [number, number, number, number, 1] | null {
  const filtered = nodes.filter((node) => node.type !== "comment");
  /**
   * Example input:
   *
   * ~~~
   * > valueParser("0, 0, 0, 1")
   * ValueParser {
   *   nodes: [
    { type: 'word', sourceIndex: 0, sourceEndIndex: 1, value: '0' },
    { type: 'div', sourceIndex: 1, sourceEndIndex: 3, value: ',', before: '', after: ' ' },
    { type: 'word', sourceIndex: 3, sourceEndIndex: 4, value: '0' },
    { type: 'div', sourceIndex: 4, sourceEndIndex: 6, value: ',', before: '', after: ' ' },
    { type: 'word', sourceIndex: 6, sourceEndIndex: 7, value: '0' },
    { type: 'div', sourceIndex: 7, sourceEndIndex: 9, value: ',', before: '', after: ' ' },
    { type: 'word', sourceIndex: 9, sourceEndIndex: 10, value: '1' }
   *   ]
   * }
   * ~~~
   */

  function parseNumber(input: string) {
    return Math.min(Math.max(0, Number.parseFloat(input)), 1);
  }

  return filtered[0].type === "word" &&
    filtered[1].type === "div" &&
    filtered[1].value === "," &&
    filtered[2].type === "word" &&
    filtered[3].type === "div" &&
    filtered[3].value === "," &&
    filtered[4].type === "word" &&
    filtered[5].type === "div" &&
    filtered[5].value === "," &&
    filtered[6].type === "word"
    ? [
        parseNumber(filtered[0].value),
        parseNumber(filtered[2].value),
        parseNumber(filtered[4].value),
        parseNumber(filtered[0].value),
        1,
      ]
    : null;
}

function extractPercentage(input: `${string}%`): number {
  return (
    Math.min(Math.max(0, Number.parseFloat(input.slice(0, -1))), 100) / 100
  );
}

function extractModernDeviceCMYKSyntax({
  nodes,
}: valueParser.FunctionNode): [number, number, number, number, number] | null {
  const filtered = nodes.filter((node) => node.type !== "comment");
  function parseNumber(input: string, { noneFallback } = { noneFallback: 0 }) {
    return input === "none"
      ? noneFallback // FIXME: is this right?
      : input.endsWith("%")
        ? extractPercentage(input as `${string}%`)
        : Math.min(Math.max(0, Number.parseFloat(input)), 1);
  }
  return filtered[0].type === "word" &&
    filtered[1].type === "space" &&
    filtered[2].type === "word" &&
    filtered[3].type === "space" &&
    filtered[4].type === "word" &&
    filtered[5].type === "space" &&
    filtered[6].type === "word"
    ? [
        parseNumber(filtered[0].value),
        parseNumber(filtered[2].value),
        parseNumber(filtered[4].value),
        parseNumber(filtered[6].value),
        filtered[7] &&
        filtered[7].type === "div" &&
        filtered[7].value === "/" &&
        filtered[8] &&
        filtered[8].type === "word"
          ? parseNumber(filtered[8].value, { noneFallback: 1 })
          : 1,
      ]
    : null;
}

function collectDeviceCMYKFunctions(root: postcss.Root) {
  const warnings: string[] = [];
  const ret = new Set<string>();
  root.walkDecls((decl) => {
    const parsed = valueParser(decl.value);
    for (const node of parsed.nodes) {
      if (node.type !== "function" || node.value !== "device-cmyk") {
        return;
      }

      const legacy = extractLegacyDeviceCMYKSyntax(node);
      if (legacy !== null) {
        ret.add(JSON.stringify(legacy));
        continue;
      }

      const modern = extractModernDeviceCMYKSyntax(node);
      if (modern !== null) {
        ret.add(JSON.stringify(modern));
        continue;
      }

      warnings.push(
        `nodes: [${node.nodes.map(({ value }) => value).join(",")}] cannot be parsed.`
      );
    }
  });
  return { deviceCMYKFunctions: ret, warnings };
}

export const PLUGIN_ID = "postcss-device-cmyk";
export const devickCMYK: postcss.PluginCreator<void> = Object.assign(
  () => ({
    postcssPlugin: PLUGIN_ID,
    // Use Once() instead of AtRule() to collect all @color-profiles before Once() in the next plugin
    Once(root: postcss.Root, { result }: postcss.Helpers) {
      const { atColorProfileRules, warnings: atColorProfileRulesWarnings } =
        collectAtColorProfileRules(root);
      const { deviceCMYKFunctions, warnings: deviceCMYKFunctionsWarnings } =
        collectDeviceCMYKFunctions(root);

      for (const warning of [
        ...atColorProfileRulesWarnings,
        ...deviceCMYKFunctionsWarnings,
      ]) {
        result.messages.push({
          type: "warning",
          plugin: PLUGIN_ID,
          warning,
        } as postcss.Message);
      }

      result.messages.push({
        type: "data",
        plugin: `${PLUGIN_ID}/collect-at-color-profile-rules`,
        data: atColorProfileRules,
      } as postcss.Message);

      result.messages.push({
        type: "data",
        plugin: `${PLUGIN_ID}/collect-device-cmyk-functions`,
        data: deviceCMYKFunctions,
      } as postcss.Message);
    },
  }),
  {
    /* FIXME: 型 'boolean' を型 'true' に割り当てることはできません。ts(2322) */
    postcss: true as true,
  }
);

const ret = await postcss([
  devickCMYK,
  Object.assign(
    () => ({
      postcssPlugin: "next-plugin",
      Once(root: postcss.Root, { result }: postcss.Helpers) {
        console.log(result.messages[0].data);
        console.log(result.messages[1].data);
      },
    }),
    { postcss: true }
  ) as postcss.PluginCreator<void>,
]).process(
  `
@color-profile device-cmyk {
  src: url(foobar.icc);
}

@color-profile --my-cmyk {
  src: url("./profile/baz.icc");
  rendering-intent: perceptual;
}

@color-profile --my-rgb {
  components: red,/* comment */green  ,  blue;
}

div {
  color: device-cmyk(0, 0, 0, 0);
  color: device-cmyk(100% 0 0 0);
  color: device-cmyk(0 1 0 0 / 0.8);
  color: device-cmyk(1 1 0 0 / 90%);
  color: device-cmyk(0 0 1 0 / none);
}
`,
  { from: undefined }
);

//console.log(ret.messages);
