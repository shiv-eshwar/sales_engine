import { createHash, randomBytes } from "node:crypto";

const DEFAULT_TTL_MS = 2 * 60 * 60 * 1000;

function hashToken(token: string): string {
  return createHash("sha256").update(token).digest("hex");
}

export class StreamTokenStore {
  private readonly byHash = new Map<string, { sessionId: string; expiresAt: number }>();

  constructor(private readonly ttlMs = DEFAULT_TTL_MS) {}

  issue(sessionId: string): string {
    for (const [hash, record] of this.byHash) {
      if (record.sessionId === sessionId) {
        this.byHash.delete(hash);
      }
    }
    const token = randomBytes(32).toString("base64url");
    this.byHash.set(hashToken(token), { sessionId, expiresAt: Date.now() + this.ttlMs });
    return token;
  }

  verify(token: string): string | null {
    if (!token) {
      return null;
    }
    const hash = hashToken(token);
    const record = this.byHash.get(hash);
    if (!record) {
      return null;
    }
    if (record.expiresAt < Date.now()) {
      this.byHash.delete(hash);
      return null;
    }
    return record.sessionId;
  }
}
