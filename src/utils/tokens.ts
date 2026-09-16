import jwt from "jsonwebtoken";
import { env } from "../config/env";

export interface RefreshTokenPayload {
  sub: string; // user id
}

/** Sign a long-lived refresh token, separate from the short-lived access token. */
export function signRefreshToken(payload: RefreshTokenPayload): string {
  const options: jwt.SignOptions = { expiresIn: env.REFRESH_TOKEN_TTL as jwt.SignOptions["expiresIn"] };
  return jwt.sign(payload, env.JWT_REFRESH_SECRET, options);
}

/** Verify and decode a refresh token. Throws if invalid/expired. */
export function verifyRefreshToken(token: string): RefreshTokenPayload {
  return jwt.verify(token, env.JWT_REFRESH_SECRET) as RefreshTokenPayload;
}
