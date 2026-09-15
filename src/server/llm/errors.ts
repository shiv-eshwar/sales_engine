export type LlmErrorCode = "login_required" | "authentication" | "rate_limit" | "unavailable" | "timeout" | "invalid_response";

export class LlmError extends Error {
  constructor(public readonly code: LlmErrorCode, message: string, public readonly httpStatus?: number) {
    super(message);
    this.name = "LlmError";
  }
}

export function providerError(status: number, body: string): LlmError {
  // Inspect upstream diagnostics only to classify them; never expose raw bodies,
  // which can contain credentials, account details, or prompt content.
  if (/token_revoked|invalidated oauth|refresh_token_reused|refresh_token_expired/i.test(body)) {
    return new LlmError("login_required", "The AI service's ChatGPT login expired or was revoked. The server administrator needs to reconnect ChatGPT. Your conversation is still here; retry after reconnection.", status);
  }
  if (status === 401 || status === 403) {
    return new LlmError("authentication", "The AI service could not authenticate. The server administrator needs to check the proxy credentials and upstream provider login.", status);
  }
  if (status === 429) return new LlmError("rate_limit", "The AI service is busy or has reached its usage limit. Please try again shortly.", status);
  return new LlmError("unavailable", `The AI service is unavailable (HTTP ${status}). Please try again shortly.`, status);
}
