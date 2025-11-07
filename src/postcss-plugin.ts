import postcss from "postcss";
import valueParser from "postcss-value-parser";
import { applyKnownLimitations, parseCMYKComponents } from "./parse.js";
import { ciede2000 } from "./ciede2000.js";

function convertCMYKToRGB(
  cmyk: readonly [c: number, m: number, y: number, k: number],
  profile: Uint8Array | undefined
): [r: number, g: number, b: number] {
  return [0, 0, 0];
}

function convertCMYKToLab(
  cmyk: readonly [c: number, m: number, y: number, k: number],
  profile: Uint8Array | undefined
): [l: number, a: number, b: number] {
  return [0, 0, 0];
}

function convertRGBToLab(
  rgb: readonly [r: number, g: number, b: number]
): [l: number, a: number, b: number] {
  return [0, 0, 0];
}

class BiMap<K, V> {
  #k2v = new Map<K, V>();
  #v2ks = new Map<V, Set<K>>();

  values() {
    return this.#k2v.values();
  }

  has(key: K) {
    return this.#k2v.has(key);
  }

  set(key: K, value: V) {
    if (this.#k2v.has(key)) {
      const old = this.#k2v.get(key)!;
      if (old === value) return;
      const ks = this.#v2ks.get(old)!;
      ks.delete(key);
      if (ks.size === 0) this.#v2ks.delete(old);
    }
    this.#k2v.set(key, value);
    if (!this.#v2ks.has(value)) this.#v2ks.set(value, new Set());
    this.#v2ks.get(value)!.add(key);
  }

  get(key: K) {
    return this.#k2v.get(key);
  }

  getByValue(value: V) {
    return new Set(this.#v2ks.get(value) ?? []);
  }

  delete(key: K) {
    const value = this.#k2v.get(key);
    if (value === undefined) return;
    this.#k2v.delete(key);
    const ks = this.#v2ks.get(value);
    if (ks) {
      ks.delete(key);
      if (ks.size === 0) this.#v2ks.delete(value);
    }
  }
}

type DeviceCMYKOptions = {
  result?: Map<string, [r: number, g: number, b: number]> | undefined;
  fractionDigits?: number | undefined;
  cmykProfile?: Uint8Array | undefined;
};

export const deviceCMYK: postcss.PluginCreator<DeviceCMYKOptions> =
  Object.assign(
    (opts: DeviceCMYKOptions | undefined) => {
      const bimap = new BiMap<string, string>();
      const fractionDigits = opts?.fractionDigits ?? 4;
      const cmykProfile = opts?.cmykProfile;

      const lazy: (() => void)[] = [];

      return {
        postcssPlugin: "device-cmyk",

        Declaration(decl) {
          console.debug(`[Declaration]: ${decl}`);
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
            const [c, m, y, k, a] = applyKnownLimitations(parsed);
            const cmyk = [c, m, y, k] as const;
            const rgb = convertCMYKToRGB(cmyk, cmykProfile);

            const key = JSON.stringify(
              cmyk.map((v) => v.toFixed(fractionDigits))
            );
            if (!bimap.has(key)) {
              bimap.set(
                key,
                JSON.stringify(rgb.map((v) => v.toFixed(fractionDigits)))
              );
            }

            lazy.push(() => {
              const rgb = bimap.get(key);
              if (!rgb) {
                return;
              }
              const [r, g, b] = JSON.parse(rgb) as [string, string, string];

              node.value = "color";
              node.nodes = [
                { type: "word", value: "srgb" },
                { type: "space", value: " " },
                { type: "word", value: r },
                { type: "space", value: " " },
                { type: "word", value: g },
                { type: "space", value: " " },
                { type: "word", value: b },
                {
                  type: "div",
                  value: "/",
                  before: " ",
                  after: " ",
                },
                { type: "word", value: a.toFixed(fractionDigits) },
                // eslint-disable-next-line @typescript-eslint/no-explicit-any
              ] as any;

              decl.value = ast.toString();
            });

            // Do not walk into replaced node further
            changed = true;
            return !changed;
          });
        },

        OnceExit() {
          console.debug("[OnceExit]");
          let rgbs = Array.from(new Set(bimap.values())).filter(
            (val) => bimap.getByValue(val).size !== 1
          );
          while (rgbs.length !== 0) {
            for (const rgb of rgbs) {
              console.debug(rgb);
              const rgbRestored = (
                JSON.parse(rgb) as [string, string, string]
              ).map((c) => Number.parseFloat(c)) as [number, number, number];
              const rgbLab = convertRGBToLab(rgbRestored);
              const notChosen = Array.from(bimap.getByValue(rgb))
                .map((cmyk) => ({
                  key: cmyk,
                  lab: convertCMYKToLab(
                    (JSON.parse(cmyk) as [string, string, string, string]).map(
                      (c) => Number.parseFloat(c)
                    ) as [number, number, number, number],
                    cmykProfile
                  ),
                }))
                .map(({ key, lab }) => ({
                  key,
                  lab,
                  ret: ciede2000(lab, rgbLab).delta_E_00,
                }))
                .sort(({ ret: a }, { ret: b }) => a - b)
                .slice(1);

              for (const { key, lab } of notChosen) {
                // rgbRestoredからr,g,bそれぞれを±(1/10^fractionDigits)した3*3-1=26通りから、最もそのCMYKにCIEDE2000が近いrgbに移動
                // 1回以上動かしたkey=cmyk:stringにはhistoryをつけて、動いてきたrgbをpush

                const newRGB = [0, 0, 0];
                bimap.set(
                  key,
                  JSON.stringify(newRGB.map((c) => c.toFixed(fractionDigits)))
                );
              }
            }

            rgbs = Array.from(new Set(bimap.values())).filter(
              (val) => bimap.getByValue(val).size !== 1
            );
            break;
          }

          lazy.forEach((fn) => fn());
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

const result = new Map();
const processor = postcss([deviceCMYK({ result })]);
processor.process(css, { from: undefined }).then((result) => {
  console.log(result.css);
});
