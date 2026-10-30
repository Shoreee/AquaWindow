import { describe, expect, it, vi } from "vitest";
import { WindowKernel } from "../../kernel/kernel";
import { makeContext } from "./context";
import { validatePlans } from "./protocol";
import { compilePlan } from "./compiler";
import { AdaptationSession } from "./session";
import { CandidateBuffer } from "./buffer";
import { localPlans } from "./local";
import type { AgentPlan, CapsuleSnapshot } from "./types";

function setup() {
  const k = new WindowKernel();
  const paper = k.open({
    appId: "preview",
    title: "Paper",
    rect: { x: 70, y: 50, w: 560, h: 650 },
    props: { paperId: "2403.11872" },
  });
  const note = k.open({
    appId: "writer",
    title: "Note",
    rect: { x: 720, y: 80, w: 550, h: 600 },
    props: { docId: "draft" },
  });
  const W = { x: 8, y: 36, w: 1424, h: 778 };
  const context = (selected: string[] = []) =>
    makeContext(k.getState(), W, selected, [], { accepted: [], rejected: [] });
  const plans: AgentPlan[] = [
    {
      id: "evidence",
      title: "证据",
      rationale: "保留阅读位置",
      priority: 0.9,
      confidence: 0.9,
      primaryTargets: [note],
      supportTargets: [paper],
      steps: [
        {
          type: "peel",
          targets: [note],
          edge: "right",
          extent: 0.35,
          artifactIds: ["a"],
        },
        { type: "anchor", targets: [note], edge: "right", artifactIds: ["a"] },
      ],
      artifacts: [
        {
          id: "a",
          kind: "evidence",
          title: "表格",
          body: "41.2 s vs 57.9 s（内置演示数据）",
          sourceIds: [`${paper}:table`],
        },
      ],
    },
    {
      id: "depth",
      title: "后台",
      rationale: "保留主窗口",
      priority: 0.8,
      confidence: 0.8,
      primaryTargets: [note],
      supportTargets: [paper],
      steps: [
        {
          type: "permeate",
          targets: [paper, note],
          depth: 0.3,
          artifactIds: [],
        },
      ],
      artifacts: [],
    },
  ];
  return { k, paper, note, context, plans };
}

describe('two real reveal candidates',()=>{
 it('aligns an empty cutout with an actual lower importance region without manufacturing an artifact',()=>{
  const s=setup();s.k.setImportance(s.paper,[{id:'table',x:.2,y:.45,w:.5,h:.25,weight:1}]);
  const ctx=s.context([s.note]),plans=localPlans(ctx),before=s.k.getState();
  expect(plans.slice(0,2).map(p=>p.steps[0].type)).toEqual(['peel','peel']);
  expect(plans[0].artifacts).toEqual([]);
  const after=compilePlan(before,plans[0],ctx).state.windows[s.note],view=after.props.agentView as import('./types').AgentView;
  expect(view.revealMode).toBe('hole');expect(view.revealSource).toBe(s.paper);
  const region=view.revealRegion!,under=before.windows[s.paper].rect;
  expect(after.rect.x+(region.x+region.w/2)*after.rect.w).toBeCloseTo(under.x+under.w*.45);
  expect(after.rect.y+(region.y+region.h/2)*after.rect.h).toBeCloseTo(under.y+under.h*.575);
  expect(before.windows[s.note].rect.x).toBe(720);
 });
});

describe("adaptation transaction and gesture", () => {
  it("cancels both a tap and a fully hatched release before the reset deadline", () => {
    const s = setup();
    let t = 0;
    const session = new AdaptationSession(
      {
        kernel: s.k,
        context: s.context,
        plans: () => s.plans,
        request: vi.fn(),
        feedback: vi.fn(),
        notify: vi.fn(),
      },
      () => t,
    );
    session.press();
    t = 200;
    session.release();
    expect(session.store.get().phase).toBe("idle");
    session.press();
    t = 700;
    session.advance();
    expect(session.store.get().phase).toBe("hatching");
    session.select(s.note);
    expect(session.store.get().deadline).toBe(3200);
    t = 2700;
    session.advance();
    expect(session.store.get().phase).toBe("hatching");
    session.release();
    expect(s.k.canUndo()).toBe(false);
  });
  it('offers seven independent candidates, waits for arrows, and accepts on release with one undo entry',()=>{
    const s=setup();let t=0;const before=s.k.getState();
    const session=new AdaptationSession({kernel:s.k,context:s.context,plans:()=>localPlans(s.context()),request:vi.fn(),feedback:vi.fn(),notify:vi.fn()},()=>t);
    session.press();expect(session.store.get().selectedIds).toEqual([]);t=2500;session.advance();
    expect(session.store.get().selectedIds).toEqual(before.order.filter(id=>before.windows[id].form==='normal'&&!before.windows[id].minimized));
    expect(session.store.get().plans).toHaveLength(7);
    expect(session.store.get().index).toBe(0);
    t=10000;session.advance();expect(session.store.get().index).toBe(0);
    session.navigate(2);expect(session.store.get().plan?.steps[0].type).toBe('yield');
    t+=180;session.advance();session.navigate(1);expect(session.store.get().index).toBe(3);
    session.release();expect(session.store.get().phase).toBe('applying');expect(s.k.canUndo()).toBe(false);
    t+=10000;session.advance();expect(session.store.get().phase).toBe('idle');expect(s.k.lastHistory()?.actor).toBe('agent');
    s.k.undo();expect(s.k.getState().windows).toEqual(before.windows);expect(s.k.canUndo()).toBe(false);
  });
  it("restores artifacts, capsules, order and focus on cancel without losing edited props", () => {
    const s = setup();
    let t = 0;
    s.k.setProps(s.note, { edited: "keep me" });
    const before = s.k.getState();
    const cap: AgentPlan = {
      ...s.plans[0],
      steps: [
        { type: "encapsulate", targets: [s.note, s.paper], edge: "right" },
      ],
    };
    const session = new AdaptationSession(
      {
        kernel: s.k,
        context: s.context,
        plans: () => [cap],
        request: vi.fn(),
        feedback: vi.fn(),
        notify: vi.fn(),
      },
      () => t,
    );
    session.press();
    t = 2500;
    session.advance();
    session.navigate(3);
    expect(s.k.get(s.paper).minimized).toBe(false);
    t = 6501; session.advance();
    expect(s.k.get(s.paper).minimized).toBe(true);
    const snap = s.k.get(s.note).props.agentCapsule as CapsuleSnapshot;
    expect(snap.members).toHaveLength(2);
    session.release();
    expect(session.store.get().phase).toBe("idle");
    s.k.undo();
    const after = s.k.getState();
    expect(after.windows).toEqual(before.windows);
    expect(after.order).toEqual(before.order);
    expect(after.focusedId).toBe(before.focusedId);
  });
  it("waits at most three extra seconds and never applies a stale response later", () => {
    const s = setup();
    let t = 0;
    const notify = vi.fn();
    let plans: AgentPlan[] | null = null;
    const session = new AdaptationSession(
      {
        kernel: s.k,
        context: s.context,
        plans: () => plans,
        request: vi.fn(),
        feedback: vi.fn(),
        notify,
      },
      () => t,
    );
    session.press();
    t = 2500;
    session.advance();
    expect(session.store.get().phase).toBe("waiting");
    t = 5500;
    session.advance();
    expect(session.store.get().phase).toBe("idle");
    expect(notify).toHaveBeenCalledOnce();
    plans = s.plans;
    t = 6000;
    session.advance();
    expect(s.k.canUndo()).toBe(false);
  });
  it("does not resurrect an externally closed target during invalidation", () => {
    const s = setup();
    let t = 0;
    const session = new AdaptationSession(
      {
        kernel: s.k,
        context: s.context,
        plans: () => s.plans,
        request: vi.fn(),
        feedback: vi.fn(),
        notify: vi.fn(),
      },
      () => t,
    );
    session.press();
    t = 2500;
    session.advance();
    s.k.close(s.paper);
    session.invalidate();
    expect(s.k.get(s.paper)).toBeUndefined();
    expect(s.k.get(s.note).props.agentView).toBeUndefined();
  });
});

describe("plan protocol and semantic sources", () => {
  it("rejects invented windows, unsupported source IDs, unsafe parameters and missing selected subjects", () => {
    const s = setup(),
      ctx = s.context();
    expect(validatePlans({ plans: s.plans }, ctx)).toHaveLength(2);
    expect(
      validatePlans(
        { plans: [{ ...s.plans[0], primaryTargets: ["invented"] }] },
        ctx,
      ),
    ).toEqual([]);
    expect(
      validatePlans(
        {
          plans: [
            {
              ...s.plans[0],
              artifacts: [{ ...s.plans[0].artifacts[0], sourceIds: ["fake"] }],
            },
          ],
        },
        ctx,
      ),
    ).toEqual([]);
    expect(
      validatePlans(
        {
          plans: [
            {
              ...s.plans[1],
              steps: [
                {
                  type: "permeate",
                  targets: [s.note],
                  depth: Infinity,
                  artifactIds: [],
                },
              ],
            },
          ],
        },
        ctx,
      ),
    ).toEqual([]);
    expect(
      validatePlans({ plans: s.plans }, { ...ctx, selectedIds: [s.paper] }),
    ).toEqual([]);
  });
  it("requires branch outputs and merged conclusions to retain every input source", () => {
    const s = setup();
    const a = s.plans[0].artifacts[0],
      b = { ...a, id: "b", sourceIds: [`${s.paper}:abstract`] },
      c = { ...a, id: "c", sourceIds: [...a.sourceIds, ...b.sourceIds] };
    const p: AgentPlan = {
      ...s.plans[0],
      artifacts: [a, b, c],
      steps: [
        {
          type: "branch",
          targets: [s.note],
          branches: [
            {
              id: "b1",
              targetId: s.note,
              sourceIds: a.sourceIds,
              artifactId: a.id,
            },
            {
              id: "b2",
              targetId: s.note,
              sourceIds: b.sourceIds,
              artifactId: b.id,
            },
          ],
        },
        {
          type: "merge",
          targets: [s.note],
          artifactIds: ["a", "b"],
          resultId: "c",
        },
      ],
    };
    expect(validatePlans({ plans: [p] }, s.context())).toHaveLength(1);
    expect(
      validatePlans(
        {
          plans: [
            { ...p, artifacts: [a, b, { ...c, sourceIds: a.sourceIds }] },
          ],
        },
        s.context(),
      ),
    ).toEqual([]);
  });
  it("keeps semantic keys stable across geometry/time but invalidates meaningful content and scope", () => {
    const s = setup(),
      before = s.context();
    s.k.setRect(s.note, { ...s.k.get(s.note).rect, x: 400 });
    expect(s.context().key).toBe(before.key);
    expect(s.context([s.note]).key).not.toBe(before.key);
    s.k.setProps(s.paper, { paperId: "2402.09931" });
    expect(s.context().semanticKey).not.toBe(before.semanticKey);
    expect(
      compilePlan(s.k.getState(), s.plans[0], s.context()).state.windows[s.note]
        .rect.x,
    ).toBe(400);
  });
});

describe("precomputation buffer", () => {
  it("debounces requests, runs one at a time and keeps only the latest queued context", async () => {
    const s = setup();
    let t = 0;
    let resolve!: (value: Response) => void;
    const fetcher = vi.fn(
      (_url: RequestInfo | URL, _options?: RequestInit) =>
        new Promise<Response>((r) => {
          resolve = r;
        }),
    );
    const buffer = new CandidateBuffer(fetcher as typeof fetch, () => t);
    buffer.setRemoteEnabled(true);
    buffer.request(s.context());
    t = 1100;
    buffer.tick();
    expect(fetcher).not.toHaveBeenCalled();
    t = 1200;
    buffer.tick();
    expect(fetcher).toHaveBeenCalledOnce();
    buffer.request({ ...s.context(), key: "second" });
    buffer.request({ ...s.context(), key: "latest" });
    t = 10000;
    buffer.tick();
    expect(fetcher).toHaveBeenCalledOnce();
    resolve(new Response(JSON.stringify({ plans: s.plans })));
    await new Promise((r) => setTimeout(r, 0));
    buffer.tick();
    expect(fetcher).toHaveBeenCalledTimes(2);
    expect(
      JSON.parse(fetcher.mock.calls[1][1]!.body as string).context.key,
    ).toBe("latest");
    resolve(new Response(JSON.stringify({ plans: s.plans })));
    await new Promise((r) => setTimeout(r, 0));
    buffer.stop();
  });
  it("expires at 60 seconds and cannot reuse a buffer across changed sources or targets", () => {
    const s = setup();
    let t = 0;
    const buffer = new CandidateBuffer(fetch, () => t);
    buffer.setRemoteEnabled(true);
    const ctx = s.context();
    buffer.entries.set(ctx.key, {
      context: ctx,
      plans: s.plans,
      generatedAt: 0,
    });
    t = 45000;
    expect(buffer.get(ctx)).toHaveLength(2);
    expect(
      buffer.get({ ...ctx, key: "selected", selectedIds: [s.paper] }),
    ).toBeNull();
    expect(buffer.get({ ...ctx, semanticKey: "changed" })).toBeNull();
    t = 60001;
    expect(buffer.get(ctx)).toBeNull();
  });
});

 describe("local rehearsal and remote opt-in", () => {
  it("replaces stale selection and focus after a window is collected", () => {
    const s = setup(), ctx = s.context([s.note]);
    const remaining = ctx.windows.filter(w => w.id !== s.note);
    const plans = localPlans({ ...ctx, windows: remaining, focusedId: s.note });
    expect(plans).toHaveLength(7);
    for (const plan of plans) {
      expect(plan.primaryTargets.length).toBeGreaterThan(0);
      expect(plan.primaryTargets.every(id => remaining.some(w => w.id === id))).toBe(true);
    }
    expect(localPlans({ ...ctx, windows: [] })).toEqual([]);
  });
  it("uses valid local plans and moves windows without any model request by default", () => {
    const s = setup(), fetcher = vi.fn();
    const buffer = new CandidateBuffer(fetcher as typeof fetch);
    const ctx = s.context();
    buffer.request(ctx, true);
    buffer.tick();
    expect(buffer.remoteEnabled).toBe(false);
    expect(fetcher).not.toHaveBeenCalled();
    const plans = buffer.get(ctx)!;
    expect(plans).toHaveLength(7);
    expect(validatePlans({ plans: localPlans(ctx) }, ctx)).toHaveLength(7);
    const compiled = compilePlan(s.k.getState(), plans[2], ctx).state;
    expect(compiled.windows[s.note].rect.x).not.toBe(s.k.get(s.note).rect.x);
    expect(compiled.windows[s.paper].rect).toEqual(s.k.get(s.paper).rect);
    for (const window of Object.values(compiled.windows)) {
      expect(window.rect.x).toBeGreaterThanOrEqual(ctx.work.x);
      expect(window.rect.x + window.rect.w).toBeLessThanOrEqual(ctx.work.x + ctx.work.w);
    }
  });
  it("ignores an in-flight remote response after the user disables DeepSeek", async () => {
    const s = setup(); let t = 0, resolve!: (value: Response) => void;
    const fetcher = vi.fn((_url: RequestInfo | URL, options?: RequestInit) => {
      expect(options?.headers).toMatchObject({ "x-aw-deepseek": "enabled" });
      return new Promise<Response>((r) => { resolve = r; });
    });
    const buffer = new CandidateBuffer(fetcher as typeof fetch, () => t);
    buffer.setRemoteEnabled(true);buffer.request(s.context(), true);t = 700;buffer.tick();
    expect(fetcher).toHaveBeenCalledOnce();
    buffer.setRemoteEnabled(false);
    expect(fetcher.mock.calls[0][1]?.signal?.aborted).toBe(true);
    resolve(new Response(JSON.stringify({ plans: s.plans })));
    await new Promise((r) => setTimeout(r, 0));
    expect(buffer.status).toBe("local");
    expect(buffer.get(s.context())?.[0].id).toBe("local-hole");
    buffer.request(s.context(), true);buffer.tick();
    expect(fetcher).toHaveBeenCalledOnce();
  });
});
