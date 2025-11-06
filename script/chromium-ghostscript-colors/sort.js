// @ts-check

import fs from "node:fs";

const raw = JSON.parse(fs.readFileSync("output.json", "utf8"));

const sorted = raw.map((channel) => {
  return Object.fromEntries(
    Object.entries(channel)
      .sort((a, b) => Number(a[0]) - Number(b[0]))
      .map(([k, v]) => [k, [...v].sort((a, b) => Number(a) - Number(b))])
  );
});

fs.writeFileSync("sorted.json", JSON.stringify(sorted, null, 2));
