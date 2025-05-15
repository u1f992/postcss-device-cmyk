// @ts-check

import postcss from "postcss";
import valueParser from "postcss-value-parser";

import { CSSDashedIdent, asCSSDashedIdent } from "./css-types.js";

const targetBrand = Symbol();
type Target = (CSSDashedIdent | "device-cmyk") & { [targetBrand]: unknown };
function asTarget(input: string): Target | null {
  const dashedIdent = asCSSDashedIdent(input);
  return dashedIdent !== null || input === "device-cmyk"
    ? (input as Target)
    : null;
}

const propBrand = Symbol();
const propValues = ["src", "rendering-intent", "components"] as const;
type Prop = (typeof propValues)[number] & { [propBrand]: unknown };
function asProp(input: string): Prop | null {
  return (propValues as readonly string[]).includes(input)
    ? (input as Prop)
    : null;
}

const renderingIntentBrand = Symbol();
const renderingIntentValues = [
  "relative-colorimetric",
  "absolute-colorimetric",
  "perceptual",
  "saturation",
] as const;
type RenderingIntent = (typeof renderingIntentValues)[number] & {
  [renderingIntentBrand]: unknown;
};
function asRenderingIntent(input: string): RenderingIntent | null {
  return (renderingIntentValues as readonly string[]).includes(input)
    ? (input as RenderingIntent)
    : null;
}

const atColorProfileBrand = Symbol();
type AtColorProfile = {
  src: string | null;
  "rendering-intent": RenderingIntent;
  components: string[] | null;
} & { [atColorProfileBrand]: unknown };
function newAtColorProfile(
  params = {
    src: null,
    "rendering-intent": "relative-colorimetric",
    components: null,
  }
): AtColorProfile {
  return structuredClone(params) as AtColorProfile;
}

function extractURL({ nodes }: valueParser.ParsedValue): string | null {
  return nodes.length === 1 &&
    nodes[0].type === "function" &&
    nodes[0].value === "url" &&
    nodes[0].nodes.length === 1 &&
    (nodes[0].nodes[0].type === "string" || nodes[0].nodes[0].type === "word")
    ? nodes[0].nodes[0].value
    : null;
}

function extractComponents({ nodes }: valueParser.ParsedValue) {
  const { nodes: filtered } = valueParser(
    nodes
      .map((node) => (node.type === "comment" ? "" : node.value))
      .join(" ")
      .trim()
  );
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
  const fragments: ({ target: Target } & (
    | { prop: "src"; value: string }
    | { prop: "rendering-intent"; value: RenderingIntent }
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
    const target = asTarget(atRule.params);
    if (target === null) {
      warnings.push(`target: ${atRule.params} is invalid for @color-profile`);
      return;
    }
    atRule.walkDecls(({ prop: prop_, value }) => {
      const prop = asProp(prop_);
      if (prop === null) {
        warnings.push(
          `prop: ${prop_} is invalid for @color-profile ${target} { ... }`
        );
        return;
      }
      if (prop === "src") {
        const url = extractURL(valueParser(value));
        if (url === null) {
          warnings.push(`value: ${value} does not contains url( ... )`);
          return;
        }
        fragments.push({ target, prop, value: url });
      } else if (prop === "rendering-intent") {
        const renderingIntent = asRenderingIntent(value);
        if (renderingIntent === null) {
          warnings.push(
            `value: ${value} is invalid for @color-profile ${target} { rendering-intent: ... ; }`
          );
          return;
        }
        fragments.push({ target, prop, value: renderingIntent });
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
    (acc: Map<Target, AtColorProfile>, cur) => {
      if (!acc.has(cur.target)) {
        acc.set(cur.target, newAtColorProfile());
      }
      const profile = acc.get(cur.target)!;
      if (cur.prop === "src") {
        profile.src = cur.value;
      } else if (cur.prop === "rendering-intent") {
        profile["rendering-intent"] = cur.value;
      } else if (cur.prop === "components") {
        profile.components = cur.value;
      }
      return acc;
    },
    new Map<Target, AtColorProfile>([
      [asTarget("device-cmyk")!, newAtColorProfile()],
    ])
  );

  return { atColorProfileRules, warnings };
}
