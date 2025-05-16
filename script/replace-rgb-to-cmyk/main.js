// @ts-check

import fs from "node:fs";
import { spawnSync } from "node:child_process";

const myPs = fs.readFileSync("replace-rgb-to-cmyk.ps");

const rgbPDF = fs.readFileSync("rgb.pdf");

const { stdout: beforeColorInspect } = spawnSync(
  "gswin64c",
  [
    "-dQUIET",
    "-dSAFER",
    "-dBATCH",
    "-dNOPAUSE",
    "-sDEVICE=ink_cov",
    "-sOutputFile=-",
    "-",
  ],
  { input: rgbPDF }
);
console.log("before:\n" + new TextDecoder().decode(beforeColorInspect));

const { stdout: rgbPs, stderr: rgbPsStdError } = spawnSync(
  "gswin64c",
  [
    "-dQUIET", // suppress the top banner (GPL Ghostscript 10.04.0 (2024-09-18)\nCopyright (C) 2024 Artifex Software, Inc.  All rights reserved. ...)
    "-dSAFER", // \
    "-dBATCH", // from https://ghostscript.readthedocs.io/en/gs10.05.1/Use.html
    "-dNOPAUSE", // /
    "-sDEVICE=ps2write",
    "-sOutputFile=-",
    "-",
  ],
  { input: rgbPDF }
);
console.error(new TextDecoder().decode(rgbPsStdError))
fs.writeFileSync("rgb.ps", rgbPs, { encoding: "utf-8" });

const { stdout: cmykPDF, stderr: cmykPDFStdError } = spawnSync(
  "gswin64c",
  [
    "-dQUIET",
    "-dSAFER",
    "-dBATCH",
    "-dNOPAUSE",
    "-sstdout=%stderr", // https://ghostscript.readthedocs.io/en/latest/Use.html#interacting-with-pipes
    "-sDEVICE=pdfwrite",
    "-sOutputFile=-",
    "-",
  ],
  { input: Buffer.concat([myPs, Buffer.from("\n"), rgbPs]) }
);
fs.writeFileSync("cmyk.pdf", cmykPDF);
console.error(new TextDecoder().decode(cmykPDFStdError))

const { stdout: afterColorInspect } = spawnSync(
  "gswin64c",
  [
    "-dQUIET",
    "-dSAFER",
    "-dBATCH",
    "-dNOPAUSE",
    "-sDEVICE=ink_cov",
    "-sOutputFile=-",
    "-",
  ],
  { input: cmykPDF }
);
console.log("after:\n" + new TextDecoder().decode(afterColorInspect));
