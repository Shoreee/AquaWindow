import { spawn } from "node:child_process";
const args = process.argv.slice(2);
const children = [
  spawn("pnpm", ["exec", "tsx", "watch", "server/index.ts"], {
    stdio: "inherit",
  }),
  spawn("pnpm", ["exec", "vite", ...args], { stdio: "inherit" }),
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
