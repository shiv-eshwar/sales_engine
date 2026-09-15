import { randomUUID } from "node:crypto";
import type Database from "better-sqlite3";
import { hashPassword, verifyPassword } from "./password.js";

export type UserRow = {
  id: string;
  email: string;
  password_hash: string;
  created_at: string;
};

export class DuplicateEmailError extends Error {
  constructor() {
    super("An account with this email already exists");
    this.name = "DuplicateEmailError";
  }
}

function isUniqueConstraint(error: unknown): boolean {
  return typeof error === "object" && error !== null && "code" in error && (error as { code: string }).code === "SQLITE_CONSTRAINT_UNIQUE";
}

export function normalizeEmail(email: string): string {
  return email.trim().toLowerCase();
}

export function findUserByEmail(db: Database.Database, email: string): UserRow | undefined {
  return db.prepare("SELECT * FROM users WHERE email = ?").get(normalizeEmail(email)) as UserRow | undefined;
}

export function findUserById(db: Database.Database, id: string): UserRow | undefined {
  return db.prepare("SELECT * FROM users WHERE id = ?").get(id) as UserRow | undefined;
}

export async function createUser(db: Database.Database, email: string, password: string): Promise<UserRow> {
  const row: UserRow = {
    id: randomUUID(),
    email: normalizeEmail(email),
    password_hash: await hashPassword(password),
    created_at: new Date().toISOString()
  };
  try {
    db.prepare("INSERT INTO users (id, email, password_hash, created_at) VALUES (?, ?, ?, ?)").run(
      row.id,
      row.email,
      row.password_hash,
      row.created_at
    );
  } catch (error) {
    if (isUniqueConstraint(error)) {
      throw new DuplicateEmailError();
    }
    throw error;
  }
  return row;
}

const UNKNOWN_USER_HASH =
  "scrypt$00000000000000000000000000000000$00000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000";

export async function authenticateUser(
  db: Database.Database,
  email: string,
  password: string
): Promise<UserRow | null> {
  const user = findUserByEmail(db, email);
  if (!user) {
    await verifyPassword(password, UNKNOWN_USER_HASH);
    return null;
  }
  const ok = await verifyPassword(password, user.password_hash);
  return ok ? user : null;
}
