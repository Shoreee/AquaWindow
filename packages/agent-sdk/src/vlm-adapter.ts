import type { LayoutProposal, Observation } from './types.js';

/**
 * Frozen I/O contract for a later vision-language model.
 * The OS must never import a concrete model client — only this adapter.
 */
export interface VLMRequest {
  observation: Observation;
  instruction: string;
}

export interface VLMAdapter {
  readonly id: string;
  propose(request: VLMRequest): Promise<LayoutProposal | null>;
}

/** No-op adapter. Swap this for a real client without touching the shell. */
export class StubVLMAdapter implements VLMAdapter {
  readonly id = 'vlm-stub';

  async propose(_request: VLMRequest): Promise<LayoutProposal | null> {
    return null;
  }
}
