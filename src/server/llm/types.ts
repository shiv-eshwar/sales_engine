export type LlmHealth = { ok: boolean | null; message: string; checkedAt: string | null };

export type LlmCompleteInput = {
  system: string;
  user: string;
  timeoutMs?: number;
};

export type LlmClient = {
  getHealth?: () => LlmHealth;
  completeJson: (input: LlmCompleteInput) => Promise<string>;
};
