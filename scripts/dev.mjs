import { spawn } from "node:child_process";
import { fileURLToPath } from 'node:url';
const args = process.argv.slice(2);
const children = [
  spawn(process.execPath, [fileURLToPath(new URL('../node_modules/tsx/dist/cli.mjs',import.meta.url)), "watch", "server/index.ts"], {
    stdio: "inherit",
  }),
  spawn(process.execPath, [fileURLToPath(new URL('../node_modules/vite/bin/vite.js',import.meta.url)), ...args], { stdio: "inherit" }),
];
let stopping = false;
function stop(code = 0) {
  if (stopping) return;
  stopping = true;
  for (const child of children) child.kill("SIGTERM");
  process.exitCode = code;
}
for (const signal of ["SIGINT", "SIGTERM"]) process.on(signal, () => stop());
for (const child of children) {
  child.on("exit", (code) => stop(code ?? 0));
  child.on("error", () => stop(1));
}
