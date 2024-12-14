# postcss-device-cmyk

```
$ npm install --save-dev postcss-cli postcss-import @u1f992/postcss-device-cmyk
```

This PostCSS plugin is designed to facilitate CMYK color PDF output for CSS processing engines that do not support [`device-cmyk`](https://drafts.csswg.org/css-color-5/#device-cmyk) (which includes the vast majority of engines).

The plugin identifies all instances of the `device-cmyk` function in the input CSS file(s), converts them to approximate RGB colors, and replaces them in the CSS. The converted RGB colors are carefully adjusted to ensure uniqueness, even for very similar CMYK colors (e.g., `device-cmyk(1 0 0 0)` and `device-cmyk(0.99 0 0 0)`), which are mapped to distinct RGB values. Additionally, the plugin generates a JSON file containing a reverse conversion table. This table enables the original CMYK colors to be restored from the RGB colors in the PDF using scripts in software such as InDesign or Scribus.

For detailed usage instructions, please refer to [postcss.config.js](postcss.config.js).

## License

GPL-3.0 except [src/ciede2000.ts](src/ciede2000.ts) (MIT).
