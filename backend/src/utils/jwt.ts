import crypto from 'crypto';
import { config } from '../config/env.ts';

export interface TokenPayload {
  uid: string;
  email: string;
  displayName?: string;
  iat?: number;
  exp?: number;
}

const base64UrlEncode = (str: string): string => {
  return Buffer.from(str)
    .toString('base64')
    .replace(/=/g, '')
    .replace(/\+/g, '-')
    .replace(/\//g, '_');
};

const base64UrlDecode = (str: string): string => {
  let base64 = str.replace(/-/g, '+').replace(/_/g, '/');
  while (base64.length % 4) {
    base64 += '=';
  }
  return Buffer.from(base64, 'base64').toString('utf8');
};

export const signToken = (
  payload: Omit<TokenPayload, 'iat' | 'exp'>,
  expiresInSeconds: number = 7 * 24 * 60 * 60, // 7 days
): string => {
  const header = { alg: 'HS256', typ: 'JWT' };
  const now = Math.floor(Date.now() / 1000);
  const fullPayload: TokenPayload = {
    ...payload,
    iat: now,
    exp: now + expiresInSeconds,
  };

  const encodedHeader = base64UrlEncode(JSON.stringify(header));
  const encodedPayload = base64UrlEncode(JSON.stringify(fullPayload));

  const signature = crypto
    .createHmac('sha256', config.jwtSecret)
    .update(`${encodedHeader}.${encodedPayload}`)
    .digest('base64')
    .replace(/=/g, '')
    .replace(/\+/g, '-')
    .replace(/\//g, '_');

  return `${encodedHeader}.${encodedPayload}.${signature}`;
};

// In-memory revoked tokens store: token signature -> expiration timestamp
const revokedTokens = new Map<string, number>();

// Clean up expired revoked tokens periodically
const cleanupRevokedTokens = () => {
  const now = Math.floor(Date.now() / 1000);
  for (const [sig, exp] of revokedTokens.entries()) {
    if (exp < now) {
      revokedTokens.delete(sig);
    }
  }
};

export const revokeToken = (token: string): boolean => {
  try {
    const parts = token.split('.');
    if (parts.length !== 3) return false;
    const [, encodedPayload, signature] = parts;
    const payload: TokenPayload = JSON.parse(base64UrlDecode(encodedPayload));
    const exp = payload.exp || Math.floor(Date.now() / 1000) + 7 * 24 * 60 * 60;
    revokedTokens.set(signature, exp);
    cleanupRevokedTokens();
    return true;
  } catch {
    return false;
  }
};

export const isTokenRevoked = (token: string): boolean => {
  try {
    const parts = token.split('.');
    if (parts.length !== 3) return true;
    const [, , signature] = parts;
    return revokedTokens.has(signature);
  } catch {
    return true;
  }
};

export const verifyToken = (token: string): TokenPayload | null => {
  try {
    if (isTokenRevoked(token)) {
      return null;
    }

    const parts = token.split('.');
    if (parts.length !== 3) return null;

    const [encodedHeader, encodedPayload, signature] = parts;

    // Strictly enforce algorithm and token type
    const header = JSON.parse(base64UrlDecode(encodedHeader));
    if (header.alg !== 'HS256' || header.typ !== 'JWT') {
      return null;
    }

    const expectedSignature = crypto
      .createHmac('sha256', config.jwtSecret)
      .update(`${encodedHeader}.${encodedPayload}`)
      .digest('base64')
      .replace(/=/g, '')
      .replace(/\+/g, '-')
      .replace(/\//g, '_');

    const signatureBuffer = Buffer.from(signature);
    const expectedBuffer = Buffer.from(expectedSignature);

    if (
      signatureBuffer.length !== expectedBuffer.length ||
      !crypto.timingSafeEqual(signatureBuffer, expectedBuffer)
    ) {
      return null;
    }

    const payload: TokenPayload = JSON.parse(base64UrlDecode(encodedPayload));
    const now = Math.floor(Date.now() / 1000);

    if (payload.exp && payload.exp < now) {
      return null; // Expired
    }

    return payload;
  } catch {
    return null;
  }
};
