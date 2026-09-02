#!/usr/bin/env tsx
import { hashPassword } from "../src/server/auth/password.js";

const password = process.argv[2];
if (!password) {
  console.error("Usage: npm run hash-password -- \"your-password\"");
  process.exit(1);
}

const hash = await hashPassword(password);
console.log(hash);
