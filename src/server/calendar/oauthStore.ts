import type Database from "better-sqlite3";
import { decryptSecret, encryptSecret } from "../crypto/secret.js";

const OPERATOR_ID = "operator";

export type StoredOAuth = {
  email: string | null;
  refreshToken: string;
  accessToken: string | null;
  accessExpiresAt: string | null;
};

export function getOAuthTokens(db: Database.Database, secret: string): StoredOAuth | null {
  const row = db.prepare("SELECT * FROM calendar_oauth WHERE id = ?").get(OPERATOR_ID) as
    | {
        email: string | null;
        encrypted_refresh_token: string;
        encrypted_access_token: string | null;
        access_expires_at: string | null;
      }
    | undefined;
  if (!row) return null;
  return {
    email: row.email,
    refreshToken: decryptSecret(row.encrypted_refresh_token, secret),
    accessToken: row.encrypted_access_token ? decryptSecret(row.encrypted_access_token, secret) : null,
    accessExpiresAt: row.access_expires_at
  };
}

export function saveOAuthTokens(
  db: Database.Database,
  secret: string,
  input: StoredOAuth
): void {
  db.prepare(
    `INSERT INTO calendar_oauth (id, email, encrypted_refresh_token, encrypted_access_token, access_expires_at, updated_at)
     VALUES (?, ?, ?, ?, ?, ?)
     ON CONFLICT(id) DO UPDATE SET
       email = excluded.email,
       encrypted_refresh_token = excluded.encrypted_refresh_token,
       encrypted_access_token = excluded.encrypted_access_token,
       access_expires_at = excluded.access_expires_at,
       updated_at = excluded.updated_at`
  ).run(
    OPERATOR_ID,
    input.email,
    encryptSecret(input.refreshToken, secret),
    input.accessToken ? encryptSecret(input.accessToken, secret) : null,
    input.accessExpiresAt,
    new Date().toISOString()
  );
}

export function deleteOAuthTokens(db: Database.Database): void {
  db.prepare("DELETE FROM calendar_oauth WHERE id = ?").run(OPERATOR_ID);
}
