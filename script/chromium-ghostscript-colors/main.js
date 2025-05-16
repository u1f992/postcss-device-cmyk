// @ts-check

import child_process from "node:child_process";
import fs from "node:fs";
import os from "node:os";
import { fileURLToPath } from "node:url";
import {
  Worker,
  isMainThread,
  parentPort,
  workerData,
} from "node:worker_threads";

import { Decimal } from "decimal.js";
import { chromium } from "playwright";

const BITS = 16;

if (isMainThread) {
  // ---- Main thread ----

  /**
   * @param {number} bits
   * @param {{ precision?: number }} opts
   */
  function* steps(bits, opts = {}) {
    const precision = opts.precision || 50;
    const D = Decimal.clone({ precision });
    const max = new D(2).pow(bits).minus(1);
    for (let i = new D(0); i.lessThanOrEqualTo(max); i = i.plus(1)) {
      yield i.div(max).toFixed(precision);
    }
  }

  const cpuCount = os.cpus().length;
  const allSteps = Array.from(steps(BITS, { precision: 50 }));
  /** @type {string[][]} */
  const chunks = Array.from({ length: cpuCount }, () => []);
  allSteps.forEach((step, i) => chunks[i % cpuCount].push(step));

  /** @type {[Map<string, Set<string>>, Map<string, Set<string>>, Map<string, Set<string>>]} */
  const actualSteps = [new Map(), new Map(), new Map()];

  await Promise.all(
    chunks.map(
      (chunk) =>
        /** @type {Promise<void>} */ (
          new Promise((resolve, reject) => {
            const worker = new Worker(fileURLToPath(import.meta.url), {
              workerData: chunk,
            });
            worker.on("message", (partial) => {
              for (let i = 0; i < 3; i++) {
                for (const [output, inputList] of Object.entries(partial[i])) {
                  if (!actualSteps[i].has(output)) {
                    actualSteps[i].set(output, new Set());
                  }
                  const s = actualSteps[i].get(output);
                  if (typeof s === "undefined") {
                    // never
                    throw new Error();
                  }
                  for (const input of inputList) {
                    s.add(input);
                  }
                }
              }
              resolve();
            });
            worker.on("error", reject);
            worker.on("exit", (code) => {
              if (code !== 0)
                reject(new Error(`Worker exited with code ${code}`));
            });
          })
        )
    )
  );

  fs.writeFileSync(
    "output.json",
    JSON.stringify(
      actualSteps.map((m) => {
        const obj = {};
        for (const [k, v] of m.entries()) {
          obj[k] = Array.from(v).sort();
        }
        return obj;
      }),
      null,
      2
    )
  );
} else {
  // ---- Worker thread ----

  /** @type {string[]} */
  const steps = workerData;
  /** @type {[Map<string, Set<string>>, Map<string, Set<string>>, Map<string, Set<string>>]} */
  const mapping = [new Map(), new Map(), new Map()];

  const browser = await chromium.launch();
  try {
    for (const c of steps) {
      const page = await browser.newPage();
      await page.setContent(
        `<html><body style="background-color: color(srgb ${c} ${c} ${c})"></body></html>`,
        { waitUntil: "load" }
      );
      const pdf = await page.pdf({
        width: "10px",
        height: "10px",
        printBackground: true,
      });
      const output = child_process.spawnSync(
        "gswin64c",
        ["-dBATCH", "-dNOPAUSE", "-dPDFDEBUG", "-sDEVICE=nullpage", "-"],
        { input: pdf }
      );
      const decoded = new TextDecoder().decode(output.stderr);
      const lines = decoded
        .split("\n")
        .map((line) => line.trim())
        .filter((line) => line.endsWith("rg") || line.endsWith("RG"));

      for (const line of lines) {
        const [r, g, b] = line.split(" ").slice(0, 3);
        const values = [r, g, b];
        for (let i = 0; i < 3; i++) {
          const v = values[i];
          if (!mapping[i].has(v)) {
            mapping[i].set(v, new Set());
          }
          const map = mapping[i].get(v);
          if (typeof map === "undefined") {
            // never
            throw new Error();
          }
          map.add(c);
        }
      }

      await page.close();
    }
  } finally {
    await browser.close();
  }

  const result = [0, 1, 2].map((i) => {
    const obj = {};
    for (const [output, inputSet] of mapping[i].entries()) {
      obj[output] = Array.from(inputSet).sort();
    }
    return obj;
  });

  parentPort?.postMessage(result);
}
