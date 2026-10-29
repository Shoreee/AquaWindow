import {ADAPTIVE_PROMPT} from "../src/agent/adaptive/prompt.ts";
import {
  createServer,
  type IncomingMessage,
  type ServerResponse,
} from "node:http";
import { readFile, stat } from "node:fs/promises";
import { resolve, extname, sep } from "node:path";
import { fileURLToPath } from "node:url";
import {
  validatePlans,
} from "../src/agent/adaptive/protocol.ts";
import type { AgentContext } from "../src/agent/adaptive/types.ts";
import { beginTrace } from "./trace.ts";

const root = resolve(fileURLToPath(new URL("..", import.meta.url)));
// Keep secrets entirely on this process. Existing environment variables take priority.
for (const name of [".env.local", ".env"]) {
  try {
    const env = await readFile(resolve(root, name), "utf8");
    for (const line of env.split("\n")) {
      const match = line.match(/^([A-Z_][A-Z_0-9]*)\s*=\s*(.*)$/);
      if (match && !process.env[match[1]])
        process.env[match[1]] = match[2].trim().replace(/^(['"])(.*)\1$/, "$2");
    }
  } catch {
    /* Optional local environment file. */
  }
}
const key = process.env.DEEPSEEK_API_KEY;
const model = process.env.DEEPSEEK_MODEL ?? "deepseek-flash";
const send = (res: ServerResponse, status: number, value: unknown) => {
  res.writeHead(status, {
    "content-type": "application/json; charset=utf-8",
    "cache-control": "no-store",
  });
  res.end(JSON.stringify(value));
};
const pending = new Map<string, { promise: Promise<unknown>; controller: AbortController; subscribers: number }>();
async function body(req: IncomingMessage): Promise<unknown> {
  const chunks: Buffer[] = [];
  let size = 0;
  for await (const chunk of req) {
    size += chunk.length;
    if (size > 64000) throw new Error("body_limit");
    chunks.push(chunk);
  }
  return JSON.parse(Buffer.concat(chunks).toString());
}
function isContext(v: unknown): v is AgentContext {
  if (!v || typeof v !== "object") return false;
  const c = v as AgentContext;
  return (
    c.version === 1 &&
    typeof c.key === "string" &&
    c.key.length < 100 &&
    typeof c.semanticKey === "string" &&
    ["papers", "files"].includes(c.task) &&
    Array.isArray(c.windows) &&
    c.windows.length <= 8 &&
    c.windows.every(
      (w) =>
        typeof w.id === "string" &&
        typeof w.title === "string" &&
        w.title.length < 500 &&
        Array.isArray(w.sourceIds) &&
        w.rect &&
        Object.values(w.rect).every(Number.isFinite),
    ) &&
    Array.isArray(c.selectedIds) &&
    c.selectedIds.every((id) => c.windows.some((w) => w.id === id)) &&
    Array.isArray(c.sources) &&
    c.sources.length <= 40 &&
    c.sources.every(
      (s) =>
        typeof s.id === "string" &&
        typeof s.title === "string" &&
        typeof s.text === "string" &&
        s.text.length <= 12000 &&
        c.windows.some((w) => w.id === s.windowId),
    )
  );
}
async function plan(context: AgentContext, signal: AbortSignal) {
  const input = {
    model,
    messages: [
      { role: "system", content: ADAPTIVE_PROMPT },
      { role: "user", content: JSON.stringify(context) },
    ],
    response_format: { type: "json_object" },
    thinking: { type: "enabled" },
    reasoning_effort: "low",
    max_tokens: 4096,
  };
  const trace = await beginTrace(root, input, key);
  let output: unknown;
  try {
    const response = await fetch("https://api.deepseek.com/chat/completions", {
      method: "POST",
      headers: {
        authorization: `Bearer ${key}`,
        "content-type": "application/json",
      },
      signal: AbortSignal.any([signal, AbortSignal.timeout(55000)]),
      body: JSON.stringify(input),
    });
    const text = await response.text();
    try {
      output = JSON.parse(text);
    } catch {
      output = { rawText: text, httpStatus: response.status };
    }
    if (!response.ok)
      throw Object.assign(
        new Error(
          response.status === 401
            ? "auth"
            : response.status === 429
              ? "limited"
              : "upstream",
        ),
        {
          status:
            response.status === 401 ? 401 : response.status === 429 ? 429 : 502,
        },
      );
    const data = output as {
      choices?: { message?: { content?: string }; finish_reason?: string }[];
    };
    const choice = data.choices?.[0];
    if (!choice?.message?.content || choice.finish_reason === "length")
      throw Object.assign(new Error("invalid"), { status: 502 });
    const raw: unknown = JSON.parse(choice.message.content);
    const plans = validatePlans(raw, context);
    if (
      !raw ||
      typeof raw !== "object" ||
      !Array.isArray((raw as { plans?: unknown }).plans) ||
      ((raw as { plans: unknown[] }).plans.length > 0 && !plans.length)
    )
      throw Object.assign(new Error("invalid"), { status: 502 });
    await trace.complete(output, {
      acceptedPlanIds: plans.map((p) => p.id),
      rejectedCount: (raw as { plans: unknown[] }).plans.length - plans.length,
    });
    return { plans, model, traceId: trace.id };
  } catch (e) {
    const error = e as Error & { status?: number };
    await trace.fail(
      { name: error.name, message: error.message, status: error.status },
      output,
    );
    throw e;
  }
}
const mime: Record<string, string> = {
  ".html": "text/html",
  ".js": "application/javascript",
  ".css": "text/css",
  ".svg": "image/svg+xml",
  ".png": "image/png",
  ".woff2": "font/woff2",
  ".webm": "video/webm",
};
const server = createServer(async (req, res) => {
  const pathname = new URL(req.url ?? "/", "http://localhost").pathname;
  if (pathname === "/api/agent/status")
    return send(res, 200, { configured: !!key, model });
  if (pathname === "/api/agent/plan") {
    if (req.method !== "POST") return send(res, 405, { error: "method" });
    if (req.headers["x-aw-deepseek"] !== "enabled") return send(res, 403, { error: "disabled" });
    if (!key) return send(res, 503, { error: "unconfigured" });
    try {
      const input = (await body(req)) as { context?: unknown };
      if (!isContext(input?.context))
        return send(res, 400, { error: "context" });
      const context = input.context;
      const cacheKey = JSON.stringify(context);
      let job = pending.get(cacheKey);
      if (!job) {
        const controller = new AbortController();
        job = { controller, subscribers: 0, promise: plan(context, controller.signal) };
        pending.set(cacheKey, job);
      }
      const current = job;
      current.subscribers++;
      let released = false;
      const release = () => {
        if (released) return;
        released = true;
        if (--current.subscribers === 0) {
          current.controller.abort();
          if (pending.get(cacheKey) === current) pending.delete(cacheKey);
        }
      };
      res.once("close", release);
      try {
        const result = await current.promise;
        if (!res.destroyed) send(res, 200, result);
      } finally {
        res.off("close", release);
        release();
      }
    } catch (e) {
      const err = e as Error & { status?: number };
      const timeout = err.name === "TimeoutError" || err.name === "AbortError";
      if (!res.destroyed) send(res, timeout ? 504 : (err.status ?? 400), {
        error: timeout
          ? "timeout"
          : ["auth", "limited", "invalid", "upstream", "body_limit"].includes(
                err.message,
              )
            ? err.message
            : "invalid",
      });
    }
    return;
  }
  if (process.argv.includes("--serve-dist")) {
    try {
      const dist = resolve(root, "dist");
      let file = resolve(dist, "." + decodeURIComponent(pathname));
      if (!file.startsWith(dist + sep) && file !== dist) {
        res.writeHead(403);
        res.end();
        return;
      }
      try {
        if (!(await stat(file)).isFile()) file = resolve(dist, "index.html");
      } catch {
        file = resolve(dist, "index.html");
      }
      const data = await readFile(file);
      res.writeHead(200, {
        "content-type": mime[extname(file)] ?? "application/octet-stream",
      });
      res.end(data);
    } catch {
      send(res, 404, { error: "not_found" });
    }
  } else send(res, 404, { error: "not_found" });
});
server.listen(Number(process.env.AGENT_PORT ?? 8787), "127.0.0.1", () =>
  console.log(
    `AquaWindow Agent listening on http://127.0.0.1:${process.env.AGENT_PORT ?? 8787} · ${key ? "configured" : "key required"}`,
  ),
);
