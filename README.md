# postcss-device-cmyk

```
$ npm install --save-dev postcss-cli postcss-import @u1f992/postcss-device-cmyk
```

This PostCSS plugin is designed to facilitate CMYK color PDF output for CSS processing engines that do not support [`device-cmyk`](https://drafts.csswg.org/css-color-5/#device-cmyk) (which includes the vast majority of engines).

## Usage

<figure>
<figcaption>postcss.config.js</figcaption>

~~~
export default (ctx) => ({
  plugins: [
    deviceCMYK({
      profile?: string,
      restore: bool | string = false,
      relatedFiles: string[] as const = []
    }),
  ],
});
~~~

</figure>

The `profile` option allows you to specify a color profile in the `*.icc` format. When a color profile is provided, it improves color accuracy when converting to RGB for display. If no profile is specified, this plugin will perform a [naive CMYK to RGB conversion](https://www.w3.org/TR/css-color-5/#cmyk-rgb).

If your goal is to display `device-cmyk()` correctly in web browsers and you already have a specific color profile, it is best to use `{ profile: "..." }`. This option leverages the CIELAB values from the color profile and delegates accurate rendering to the browser. If you only need to reference `device-cmyk()` in your CSS and can tolerate minor color inaccuracies, using an empty object `{ }` is sufficient.

If you plan to export PDFs from browsers and process them further in tools like InDesign or Scribus for professional printing, you must enable the `restore` option. Setting it to `true` will output `device-cmyk.restore.json` to the current working directory, while specifying a string will save the file to the given directory. In this scenario, specifying a color profile is less critical; even if colors like 100% cyan are temporarily mapped to `#ff0000`, the final result will not be affected.

When `restore` is enabled, the `relatedFiles` option becomes important. To accurately restore the original CMYK values, all CMYK colors must map to unique RGB values. This requires analyzing every CSS file, including those imported via `@import` or loaded alongside other stylesheets in HTML. Without this comprehensive analysis, the transformation table cannot be created. To include all CSS files under the input file's directory, use the following snippet:

~~~js
function collectFiles(dir) {
  return fs.readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
    const filePath = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      return collectFiles(filePath);
    }
    return entry.isFile() && filePath.endsWith(".css") ? [filePath] : [];
  });
}
~~~

This plugin also integrates seamlessly with [postcss-import](https://github.com/postcss/postcss-import).

When `restore` is enabled, `device-cmyk()` will always be converted to `rgb()`, regardless of the `profile` setting. This happens because even when `lab()` is used in CSS, browsers convert colors to RGB when generating PDFs (further investigation needed).

<figure>
<table>
<tr>
<td colspan="2" rowspan="2"></td>
<th colspan="2"><code>profile</code></th>
</tr>
<tr>
<th>Specified</th>
<th>Not Specified</th>
</tr>
<tr>
<th rowspan="2"><code>restore</code></th>
<th>Specified</th>
<td><code>rgb()</code></td>
<td><code>rgb()</code></td>
</tr>
<tr>
<th>Not Specified</th>
<td><code>lab()</code></td>
<td><code>rgb()</code></td>
</tr>
</table>
<figcaption>Output behavior</figcaption>
</figure>

## License

GPL-3.0 except [src/ciede2000.ts](src/ciede2000.ts) (MIT).
