Ghostscriptでテーブルを用いてRGBをCMYKに変換する。

```
> vivliostyle build manuscript.md -o rgb.pdf
> node main.js

before:
 0.03533  0.03239  0.03712  0.03951 CMYK OK


% Warning: RGB color not defined in LUT: 0 1 0
% Warning: RGB color not defined in LUT: 0 1 0

after:
 0.00219  0.00156  0.00352  0.03891 CMYK OK
```
