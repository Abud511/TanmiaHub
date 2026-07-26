/**
 * نظام المصادقة المحلي المستقل - اسم مستخدم/كلمة مرور + JWT
 * لا يعتمد على أي خدمة خارجية.
 */
import bcrypt from "bcryptjs";
import type { Request, Response } from "express";
import { SignJWT, jwtVerify } from "jose";
import type { Account } from "../drizzle/schema";
import { getAccountById } from "./db";

export const LOCAL_COOKIE_NAME = "platform_session";
const SESSION_DAYS = 30;

function getSecret() {
  const secret = process.env.JWT_SECRET || "change-me-in-production";
  return new TextEncoder().encode(secret);
}

export async function hashPassword(password: string) {
  return bcrypt.hash(password, 10);
}

export async function verifyPassword(password: string, hash: string) {
  return bcrypt.compare(password, hash);
}

export async function createSessionToken(accountId: number) {
  return new SignJWT({ accountId })
    .setProtectedHeader({ alg: "HS256" })
    .setIssuedAt()
    .setExpirationTime(`${SESSION_DAYS}d`)
    .sign(getSecret());
}

export async function verifySessionToken(token: string): Promise<number | null> {
  try {
    const { payload } = await jwtVerify(token, getSecret());
    const accountId = payload.accountId;
    return typeof accountId === "number" ? accountId : null;
  } catch {
    return null;
  }
}

export function getLocalCookieOptions(req: Request) {
  const forwardedProto = req.headers["x-forwarded-proto"];
  const protoList = Array.isArray(forwardedProto)
    ? forwardedProto
    : (forwardedProto ?? "").split(",");
  const secure =
    req.protocol === "https" ||
    protoList.some(p => p.trim().toLowerCase() === "https");
  return {
    httpOnly: true,
    path: "/",
    sameSite: "lax" as const,
    secure,
    maxAge: SESSION_DAYS * 24 * 60 * 60 * 1000,
  };
}

export function setSessionCookie(req: Request, res: Response, token: string) {
  res.cookie(LOCAL_COOKIE_NAME, token, getLocalCookieOptions(req));
}

export function clearSessionCookie(req: Request, res: Response) {
  const opts = getLocalCookieOptions(req);
  res.clearCookie(LOCAL_COOKIE_NAME, { ...opts, maxAge: -1 });
}

/** استخراج الحساب الحالي من كوكي الجلسة */
export async function getAccountFromRequest(req: Request): Promise<Account | null> {
  try {
    const cookies = parseCookies(req.headers.cookie ?? "");
    let token = cookies[LOCAL_COOKIE_NAME];
    // آلية احتياطية: عند حظر الكوكيز (iframe / Safari ITP) نقبل الجلسة من ترويسة Authorization
    if (!token) {
      const authHeader = req.headers["x-session-token"] ?? req.headers.authorization;
      const raw = Array.isArray(authHeader) ? authHeader[0] : authHeader;
      if (raw) {
        token = raw.startsWith("Bearer ") ? raw.slice(7) : raw;
      }
    }
    if (!token) return null;
    const accountId = await verifySessionToken(token);
    if (!accountId) return null;
    const account = await getAccountById(accountId);
    return account ?? null;
  } catch {
    return null;
  }
}

function parseCookies(header: string): Record<string, string> {
  const out: Record<string, string> = {};
  for (const part of header.split(";")) {
    const idx = part.indexOf("=");
    if (idx === -1) continue;
    const key = part.slice(0, idx).trim();
    const value = part.slice(idx + 1).trim();
    if (key) out[key] = decodeURIComponent(value);
  }
  return out;
}
