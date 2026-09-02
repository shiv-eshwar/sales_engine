export type LlmCompleteInput = {
  system: string;
  user: string;
};

export type LlmClient = {
  completeJson: (input: LlmCompleteInput) => Promise<string>;
};
