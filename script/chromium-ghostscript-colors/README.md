ChromiumとGhostscriptで表現できる色

- `main.js` - `output.json` 生成　35分ほどかかる
- `sort.js` - `sorted.json` 整列済み

RGBで同一のマッピングを使用しているようだ。

```
Welcome to Node.js v22.13.1.
Type ".help" for more information.
> var assert = await import("node:assert")
undefined
> var fs = await import("node:fs")
undefined
> var json = JSON.parse(fs.readFileSync("sorted.json"))
undefined
> assert.deepStrictEqual(json[0],json[1])
undefined
> assert.deepStrictEqual(json[1],json[2])
undefined
```

小数点以下5桁目を四捨五入と思われる。

```
      "0.88633554589150835431448844129091325246051728084230"
    ],
    "0.886400": [
      "0.88635080491340505073624780651560234988937209124895",
```
