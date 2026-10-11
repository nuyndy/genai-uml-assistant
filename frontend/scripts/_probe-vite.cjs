// Temporary probe: where did this vite@8.3.0 really come from?
const fs = require("fs");
const path = require("path");
const pkg = require("vite/package.json");
console.log("vite", pkg.version, "_resolved:", pkg._resolved || "(none)");
console.log(
  "vite realpath:",
  fs.realpathSync(path.dirname(require.resolve("vite/package.json"))),
);
console.log(
  "is symlink/reparse point:",
  fs
    .lstatSync(path.join(__dirname, "..", "node_modules", "vite"))
    .isSymbolicLink(),
);
console.log(
  "root package.json deps:",
  JSON.stringify(require("../package.json").devDependencies.vite),
);
console.log(
  "package-lock vite entry:",
  JSON.stringify(
    require("../package-lock.json").packages["node_modules/vite"] || null,
  ),
);
