import postcss from "postcss";
import valueParser from "postcss-value-parser";

function isNumberWord(
  node: valueParser.Node | undefined
): node is valueParser.WordNode & { value: `${number}` } {
  if (!node || node.type !== "word") {
    return false;
  }
  const ret = parseFloat(node.value);
  if (Number.isNaN(ret)) {
    return false;
  }
  return true;
}
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

function parseCMYKComponents(nodes: valueParser.Node[]) {
  const withoutComments = nodes.filter((node) => node.type !== "comment");
  const shouldC = isNumberWord(withoutComments[0]);
  const shouldM = isNumberWord(withoutComments[2]);
  const shouldY = isNumberWord(withoutComments[4]);
  const shouldK = isNumberWord(withoutComments[6]);
  if (!(shouldC && shouldM && shouldY && shouldK)) {
    return null;
  }
  if (
    isDivComma(withoutComments[1]) &&
    isDivComma(withoutComments[3]) &&
    isDivComma(withoutComments[5])
  ) {
    const c = clamp(parseFloat(withoutComments[0].value));
    const m = clamp(parseFloat(withoutComments[2].value));
    const y = clamp(parseFloat(withoutComments[4].value));
    const k = clamp(parseFloat(withoutComments[6].value));
    return { c, m, y, k, a: null };
  } else if (
    isSpace(withoutComments[1]) &&
    isSpace(withoutComments[3]) &&
    isSpace(withoutComments[5])
  ) {
    return {};
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
