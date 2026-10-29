import type { KernelState, Rect, WindowState } from "../../kernel/types";

export type Edge = "left" | "right" | "top" | "bottom";
export type Primitive =
  | "arrange"
  | "anchor"
  | "peel"
  | "yield"
  | "encapsulate"
  | "branch"
  | "merge"
  | "permeate";
export interface Source {
  id: string;
  windowId: string;
  title: string;
  text: string;
  kind: "paper" | "table" | "note" | "file";
}
export interface ContextWindow {
  id: string;
  app: string;
  title: string;
  role: string;
  rect: Rect;
  depth: number;
  focused: boolean;
  sourceIds: string[];
  selection?: string;
  scroll: number;
}
export interface AgentContext {
  version: 1;
  key: string;
  semanticKey: string;
  task: "papers" | "files";
  selectedIds: string[];
  focusedId: string | null;
  work: Rect;
  windows: ContextWindow[];
  sources: Source[];
  activity: { type: string; windowId?: string; detail?: string }[];
  feedback: { accepted: string[]; rejected: string[] };
}
type TargetStep = { targets: string[] };
export type PrimitiveStep =
  | (TargetStep & { type: "arrange"; layout: "compare" | "focus" })
  | (TargetStep & { type: "anchor"; edge: Edge; artifactIds: string[] })
  | (TargetStep & {
      type: "peel";
      mode?: "edge" | "hole";
      edge: Edge;
      extent: number;
      artifactIds: string[];
    })
  | (TargetStep & { type: "yield"; direction: Edge; amount: number })
  | (TargetStep & { type: "encapsulate"; edge: Edge })
  | (TargetStep & {
      type: "branch";
      branches: {
        id: string;
        targetId: string;
        sourceIds: string[];
        artifactId: string;
      }[];
    })
  | (TargetStep & { type: "merge"; artifactIds: string[]; resultId: string })
  | (TargetStep & { type: "permeate"; depth: number; artifactIds: string[] });
export interface Artifact {
  id: string;
  kind: "evidence" | "comparison" | "files" | "summary";
  title: string;
  body: string;
  sourceIds: string[];
}
export interface AgentPlan {
  id: string;
  title: string;
  rationale: string;
  priority: number;
  confidence: number;
  primaryTargets: string[];
  supportTargets: string[];
  steps: PrimitiveStep[];
  artifacts: Artifact[];
}
export interface PlanBuffer {
  context: AgentContext;
  plans: AgentPlan[];
  generatedAt: number;
}
export interface RewardProvider {
  evaluate(
    context: AgentContext,
    plan: AgentPlan,
  ): { score: number; reason?: string } | null;
}
export const unconfiguredReward: RewardProvider = { evaluate: () => null };
export interface CapsuleSnapshot {
  title: string;
  members: WindowState[];
  order: string[];
  focusedId: string | null;
  scroll: Record<string, number>;
}
export interface AgentView {
  planId: string;
  title: string;
  rationale: string;
  steps: Primitive[];
  edge: Edge;
  extent: number;
  artifacts: Artifact[];
  sources: Source[];
  branches: {
    id: string;
    title: string;
    artifactId: string;
    sourceIds: string[];
  }[];
  merged?: string;
  anchored: boolean;
  revealed: boolean;
  revealMode?: "edge" | "hole";
  revealRegion?: Rect;
  revealSource?: string;
  layer: boolean;
  supporting: boolean;
}
export interface CompiledPlan {
  state: KernelState;
  plan: AgentPlan;
}
export const PRIMITIVE_LABELS: Record<Primitive, string> = {
  arrange: "移位",
  anchor: "锚附",
  peel: "揭示",
  yield: "让界",
  encapsulate: "包裹",
  branch: "分生",
  merge: "汇合",
  permeate: "渗层",
};
