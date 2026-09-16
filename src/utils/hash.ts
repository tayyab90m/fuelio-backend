import bcrypt from "bcrypt";
import { createHash } from "node:crypto";

const SALT_ROUNDS = 10;

/** Hash a plaintext password for storage. */
export async function hashPassword(password: string): Promise<string> {
  return bcrypt.hash(password, SALT_ROUNDS);
}

/** Compare a plaintext password against a stored bcrypt hash. */
export async function verifyPassword(password: string, passwordHash: string): Promise<boolean> {
  return bcrypt.compare(password, passwordHash);
}

/**
 * Refresh tokens are long, high-entropy JWTs already — hashing them with
 * bcrypt would be needlessly slow (bcrypt truncates at 72 bytes and is
 * designed for low-entropy human passwords). We store a fast, deterministic
 * SHA-256 hash instead so we can look the token up by comparing hashes,
 * while never persisting the raw token.
 */
export function hashToken(token: string): string {
  return createHash("sha256").update(token).digest("hex");
}

export function verifyTokenHash(token: string, tokenHash: string): boolean {
  return hashToken(token) === tokenHash;
}
