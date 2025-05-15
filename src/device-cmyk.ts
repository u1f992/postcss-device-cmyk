import postcss from "postcss";
import valueParser from "postcss-value-parser";
import {
  CSSNone,
  CSSNumber,
  CSSPercentage,
  toCSSNone,
  toCSSNumber,
  toCSSPercentage,
} from "./util.js";

function extractLegacyDeviceCMYKSyntax({
  nodes,
}: valueParser.FunctionNode):
  | [CSSNumber, CSSNumber, CSSNumber, CSSNumber]
  | null {
  const { nodes: filtered } = valueParser(
    nodes
      .map((node) => (node.type === "comment" ? "" : node.value))
      .join(" ")
      .trim()
  );
  const [c, m, y, k] = [
    filtered[0] && filtered[0].type === "word"
      ? toCSSNumber(filtered[0].value)
      : null,
    filtered[1].type === "div" &&
    filtered[1].value === "," &&
    filtered[2].type === "word"
      ? toCSSNumber(filtered[2].value)
      : null,
    filtered[3].type === "div" &&
    filtered[3].value === "," &&
    filtered[4].type === "word"
      ? toCSSNumber(filtered[4].value)
      : null,
    filtered[5].type === "div" &&
    filtered[5].value === "," &&
    filtered[6].type === "word"
      ? toCSSNumber(filtered[6].value)
      : null,
  ];
  return c !== null && m !== null && y !== null && k !== null
    ? [c, m, y, k]
    : null;
}

function extractModernDeviceCMYKSyntax({
  nodes,
}: valueParser.FunctionNode):
  | [
      CSSNumber | CSSPercentage | CSSNone,
      CSSNumber | CSSPercentage | CSSNone,
      CSSNumber | CSSPercentage | CSSNone,
      CSSNumber | CSSPercentage | CSSNone,
      CSSNumber | CSSPercentage | CSSNone,
    ]
  | [
      CSSNumber | CSSPercentage | CSSNone,
      CSSNumber | CSSPercentage | CSSNone,
      CSSNumber | CSSPercentage | CSSNone,
      CSSNumber | CSSPercentage | CSSNone,
    ]
  | null {
  const { nodes: filtered } = valueParser(
    nodes
      .map((node) => (node.type === "comment" ? "" : node.value))
      .join(" ")
      .trim()
  );
  const [c, m, y, k, a] = [
    filtered[0] && filtered[0].type === "word"
      ? toCSSNumber(filtered[0].value) ||
        toCSSPercentage(filtered[0].value) ||
        toCSSNone(filtered[0].value)
      : null,
    filtered[1].type === "space" && filtered[2] && filtered[2].type === "word"
      ? toCSSNumber(filtered[2].value) ||
        toCSSPercentage(filtered[2].value) ||
        toCSSNone(filtered[2].value)
      : null,
    filtered[3].type === "space" && filtered[4] && filtered[4].type === "word"
      ? toCSSNumber(filtered[4].value) ||
        toCSSPercentage(filtered[4].value) ||
        toCSSNone(filtered[4].value)
      : null,
    filtered[5].type === "space" && filtered[6] && filtered[6].type === "word"
      ? toCSSNumber(filtered[6].value) ||
        toCSSPercentage(filtered[6].value) ||
        toCSSNone(filtered[6].value)
      : null,
    filtered[7] &&
    filtered[7].type === "div" &&
    filtered[7].value === "/" &&
    filtered[8] &&
    filtered[8].type === "word"
      ? toCSSNumber(filtered[8].value) ||
        toCSSPercentage(filtered[8].value) ||
        toCSSNone(filtered[8].value)
      : null,
  ];
  return c !== null && m !== null && y !== null && k !== null
    ? a !== null
      ? [c, m, y, k, a]
      : [c, m, y, k]
    : null;
}

/**
 * https://www.w3.org/TR/css-color-5/#device-cmyk
 */
export function collectDeviceCMYKFunctions(root: postcss.Root) {
  const warnings: string[] = [];
  const ret = new Set<string>();

  function processNode(node: valueParser.Node) {
    if (node.type === "function" && node.value === "device-cmyk") {
      const legacy = extractLegacyDeviceCMYKSyntax(node);
      if (legacy !== null) {
        ret.add(JSON.stringify(legacy));
        return;
      }

      const modern = extractModernDeviceCMYKSyntax(node);
      if (modern !== null) {
        ret.add(JSON.stringify(modern));
        return;
      }

      warnings.push(
        `nodes: [${node.nodes.map(({ value }) => value).join(",")}] cannot be parsed.`
      );
      return;
    }

    if (node.type === "function" && node.nodes) {
      for (const childNode of node.nodes) {
        processNode(childNode);
      }
    }
  }

  root.walkDecls((decl) => {
    const parsed = valueParser(decl.value);
    for (const node of parsed.nodes) {
      processNode(node);
    }
  });

  return { deviceCMYKFunctions: ret, warnings };
}
