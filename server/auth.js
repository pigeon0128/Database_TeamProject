// 비밀번호 해시와 로그인 세션 쿠키 (외부 라이브러리 없이 Node 내장 crypto 사용)
import { createHmac, randomBytes, scrypt, timingSafeEqual } from "node:crypto";
import { promisify } from "node:util";

const scryptAsync = promisify(scrypt);

const COOKIE_NAME = "doro_session";
const SESSION_DAYS = 7;

let secret = process.env.SESSION_SECRET;
if (!secret) {
  secret = randomBytes(32).toString("hex");
  console.warn("[auth] SESSION_SECRET 이 없어 임시 값을 사용합니다. 서버를 다시 켜면 모두 로그아웃됩니다.");
}

/** "scrypt$소금$해시" 형식으로 저장한다. */
export async function hashPassword(password) {
  const salt = randomBytes(16);
  const hash = await scryptAsync(password, salt, 64);
  return `scrypt$${salt.toString("hex")}$${hash.toString("hex")}`;
}

export async function verifyPassword(password, stored) {
  const [scheme, saltHex, hashHex] = String(stored ?? "").split("$");
  if (scheme !== "scrypt" || !saltHex || !hashHex) return false;
  const expected = Buffer.from(hashHex, "hex");
  const actual = await scryptAsync(password, Buffer.from(saltHex, "hex"), expected.length);
  return timingSafeEqual(expected, actual);
}

const sign = (payload) => createHmac("sha256", secret).update(payload).digest("base64url");

/** 사용자 ID와 만료 시각을 서명한 토큰 */
function createToken(userId) {
  const payload = Buffer.from(JSON.stringify({ uid: String(userId), exp: Date.now() + SESSION_DAYS * 864e5 })).toString("base64url");
  return `${payload}.${sign(payload)}`;
}

function readToken(token) {
  const [payload, signature] = String(token ?? "").split(".");
  if (!payload || !signature) return null;
  const expected = Buffer.from(sign(payload));
  const actual = Buffer.from(signature);
  if (expected.length !== actual.length || !timingSafeEqual(expected, actual)) return null;
  try {
    const { uid, exp } = JSON.parse(Buffer.from(payload, "base64url").toString());
    return typeof exp === "number" && exp > Date.now() ? uid : null;
  } catch {
    return null;
  }
}

function readCookie(req, name) {
  for (const part of (req.headers.cookie ?? "").split(";")) {
    const [k, ...v] = part.trim().split("=");
    if (k === name) return decodeURIComponent(v.join("="));
  }
  return null;
}

export function setSessionCookie(res, userId) {
  res.cookie(COOKIE_NAME, createToken(userId), {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    maxAge: SESSION_DAYS * 864e5,
    path: "/",
  });
}

export function clearSessionCookie(res) {
  res.clearCookie(COOKIE_NAME, { path: "/" });
}

/** 로그인한 사용자 ID (문자열) 또는 null */
export const sessionUserId = (req) => readToken(readCookie(req, COOKIE_NAME));

/** 로그인이 필요한 API 앞에 붙인다. */
export function requireUser(req, res, next) {
  const uid = sessionUserId(req);
  if (!uid) return res.status(401).json({ error: "로그인이 필요합니다." });
  req.userId = uid;
  next();
}
