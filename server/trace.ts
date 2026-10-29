import { mkdir, rename, writeFile } from "node:fs/promises";
import { randomUUID } from "node:crypto";
import { resolve } from "node:path";

/** Full model I/O for local replay. Authorization headers are never accepted here. */
export async function beginTrace(
  root: string,
  input: unknown,
  secret?: string,
) {
  const started = new Date();
  const date = new Intl.DateTimeFormat("sv-SE", {
    timeZone: "Asia/Shanghai",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(started);
  const id = `${started.toISOString().replace(/[:.]/g, "-")}-${randomUUID().slice(0, 8)}`;
  const directory = resolve(root, "log", date);
  await mkdir(directory, { recursive: true, mode: 0o700 });
  const file = resolve(directory, `${id}.json`);
  const trace: Record<string, unknown> = {
    id,
    startedAt: started.toISOString(),
    status: "pending",
    input,
  };
  const save = async () => {
    let json = JSON.stringify(trace, null, 2);
    if (secret) json = json.split(secret).join("[REDACTED]");
    json = json.replace(/\bsk-[A-Za-z0-9_-]{16,}/g, "[REDACTED]");
    const temporary = `${file}.tmp`;
    await writeFile(temporary, json + "\n", { mode: 0o600 });
    await rename(temporary, file);
  };
  await save();
  return {
    id,
    async complete(output: unknown, validation: unknown) {
      Object.assign(trace, {
        status: "complete",
        completedAt: new Date().toISOString(),
        durationMs: Date.now() - started.getTime(),
        output,
        validation,
      });
      await save();
    },
    async fail(
      error: { name: string; message: string; status?: number },
      output?: unknown,
    ) {
      Object.assign(trace, {
        status: "error",
        completedAt: new Date().toISOString(),
        durationMs: Date.now() - started.getTime(),
        error,
        ...(output === undefined ? {} : { output }),
      });
      await save();
    },
  };
}
