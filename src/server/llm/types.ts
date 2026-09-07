export type LlmCompleteInput = {
  system: string;
  user: string;
  timeoutMs?: number;
};

export type LlmClient = {
  completeJson: (input: LlmCompleteInput) => Promise<string>;
};
