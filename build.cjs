// Build wrapper: injecte le patch fs EISDIR dans tous les processus Node via NODE_OPTIONS

const fs = require("fs");
const path = require("path");
const { execSync } = require("child_process");

// Placer le patch dans node_modules pour que Next.js l'accepte dans NODE_OPTIONS
const patchSrc = path.join(__dirname, "patch-fs.cjs");
const patchDst = path.join(__dirname, "node_modules", ".dimzbox-patch-fs.cjs");
fs.copyFileSync(patchSrc, patchDst);

const env = Object.assign({}, process.env);

// Construire NODE_OPTIONS proprement
const existingOpts = (env.NODE_OPTIONS || "").trim();
const requireFlag = "--require " + JSON.stringify(patchDst);
env.NODE_OPTIONS = existingOpts ? existingOpts + " " + requireFlag : requireFlag;

let exitCode = 0;
try {
  execSync("npx next build --webpack", {
    stdio: "inherit",
    cwd: __dirname,
    env,
  });
} catch (e) {
  exitCode = e.status || 1;
} finally {
  try { fs.unlinkSync(patchDst); } catch {}
}

process.exit(exitCode);
