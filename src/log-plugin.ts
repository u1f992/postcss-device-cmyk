import postcss from "postcss";
import valueParser from "postcss-value-parser";

function isDivComma(
  node: valueParser.Node | undefined
): node is valueParser.DivNode & { value: "," } {
  if (!node || node.type !== "div" || node.value !== ",") {
    return false;
  }
  return true;
}
function isSpace(
  node: valueParser.Node | undefined
): node is valueParser.SpaceNode {
  return !!node && node.type === "space";
}
function isDivSlash(
  node: valueParser.Node | undefined
): node is valueParser.DivNode & { value: "/" } {
  if (!node || node.type !== "div" || node.value !== "/") {
    return false;
  }
  return true;
}
function clamp(num: number) {
  return Math.max(0, Math.min(num, 1));
}

function parseNumberOrPercentage(node: valueParser.Node | undefined) {
  if (!node || node.type !== "word") {
    return null;
  }
  const value = node.value.trim();
  if (value.endsWith("%")) {
    const num = Number.parseFloat(value.slice(0, -1));
    if (!Number.isFinite(num)) {
      return null;
    }
    return num / 100;
  } else {
    const num = Number.parseFloat(value);
    if (!Number.isFinite(num)) {
      return null;
    }
    return num;
  }
}

function parseCMYKComponents(nodes: valueParser.Node[]) {
  const withoutComments = nodes.filter((node) => node.type !== "comment");
  console.log(withoutComments);
  const shouldC = parseNumberOrPercentage(withoutComments[0]);
  const shouldM = parseNumberOrPercentage(withoutComments[2]);
  const shouldY = parseNumberOrPercentage(withoutComments[4]);
  const shouldK = parseNumberOrPercentage(withoutComments[6]);
  if (
    shouldC === null ||
    shouldM === null ||
    shouldY === null ||
    shouldK === null
  ) {
    return null;
  }
  if (
    isDivComma(withoutComments[1]) &&
    isDivComma(withoutComments[3]) &&
    isDivComma(withoutComments[5])
  ) {
    return {
      c: clamp(shouldC),
      m: clamp(shouldM),
      y: clamp(shouldY),
      k: clamp(shouldK),
      a: 1,
    };
  } else if (
    isSpace(withoutComments[1]) &&
    isSpace(withoutComments[3]) &&
    isSpace(withoutComments[5])
  ) {
    const mayA = parseNumberOrPercentage(withoutComments[8]);
    return {
      c: clamp(shouldC),
      m: clamp(shouldM),
      y: clamp(shouldY),
      k: clamp(shouldK),
      a: isDivSlash(withoutComments[7]) && mayA !== null ? mayA : 1,
    };
  }
  return null;
}

export const deviceCMYK: postcss.PluginCreator<void> = Object.assign(
  () =>
    ({
      postcssPlugin: "device-cmyk",

      Declaration(decl) {
        const ast = valueParser(decl.value);
        let changed = false;

        ast.walk((node) => {
          if (node.type !== "function" || node.value !== "device-cmyk") {
            return;
          }
          const components = parseCMYKComponents(node.nodes);
          if (components === null) {
            return;
          }
          console.log(components);

          const message = valueParser.stringify(node.nodes).trim();
          console.log(`[postcss-log] ${message}`);

          node.value = "color";
          node.nodes = [
            { type: "word", value: "srgb" },
            { type: "space", value: " " },
            { type: "word", value: "0" },
            { type: "space", value: " " },
            { type: "word", value: "0" },
            { type: "space", value: " " },
            { type: "word", value: "0" },
            {
              type: "div",
              value: "/",
              before: " ",
              after: " ",
            },
            { type: "word", value: "1" },

            // eslint-disable-next-line @typescript-eslint/no-explicit-any
          ] as any;

          changed = true;
          // Do not walk into replaced node further
          return false;
        });

        if (changed) {
          decl.value = ast.toString();
        }
      },
    }) as postcss.Plugin,
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

  color: device-cmyk(単色);
  background: linear-gradient(90deg, #fff, device-cmyk("グラデ1"), device-cmyk("グラデ2"));
  box-shadow: 0 0 10px device-cmyk(影);
  border: 1px solid device-cmyk(枠線);
}
`;

postcss([deviceCMYK])
  .process(css, { from: undefined })
  .then((result) => {
    console.log("変換後CSS:");
    console.log(result.css);
  });
