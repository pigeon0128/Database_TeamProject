// 로그인 API (/api/auth): 가입, 로그인, 로그아웃, 지금 로그인한 사용자. 아이디는 users.nickname 을 그대로 쓴다.
// 비밀번호 해시와 세션 쿠키는 ../auth.js 가 맡는다.
import { Router } from "express";
import { clearSessionCookie, hashPassword, sessionUserId, setSessionCookie, verifyPassword } from "../auth.js";
import { pool } from "../db.js";
import { BadRequest } from "../errors.js";

const LOGIN_ID_RULE = /^[\p{L}\p{N}_-]{2,20}$/u;
const MIN_PASSWORD = 4;
const MAX_PASSWORD = 72;

function readCredentials(body) {
  const loginId = String(body?.loginId ?? "").trim();
  const password = String(body?.password ?? "");
  if (!LOGIN_ID_RULE.test(loginId)) throw new BadRequest("아이디는 2~20자의 한글·영문·숫자·_·- 만 쓸 수 있어요.");
  if (password.length < MIN_PASSWORD || password.length > MAX_PASSWORD)
    throw new BadRequest(`비밀번호는 ${MIN_PASSWORD}~${MAX_PASSWORD}자로 입력해 주세요.`);
  return { loginId, password };
}

const toUser = (row) => ({ id: Number(row.user_id), loginId: row.nickname });

export const authRoutes = Router();

authRoutes.post("/register", async (req, res) => {
  const { loginId, password } = readCredentials(req.body);
  const passwordHash = await hashPassword(password);
  const { rows } = await pool.query(
    `INSERT INTO users (nickname, password_hash) VALUES ($1, $2)
     ON CONFLICT (nickname) DO NOTHING
     RETURNING user_id, nickname`,
    [loginId, passwordHash],
  );
  if (!rows.length) return res.status(409).json({ error: "이미 사용 중인 아이디예요." });
  setSessionCookie(res, rows[0].user_id);
  res.status(201).json({ user: toUser(rows[0]) });
});

authRoutes.post("/login", async (req, res) => {
  const { loginId, password } = readCredentials(req.body);
  const { rows } = await pool.query("SELECT user_id, nickname, password_hash FROM users WHERE nickname = $1", [loginId]);
  const row = rows[0];
  if (!row || !(await verifyPassword(password, row.password_hash))) {
    return res.status(401).json({ error: "아이디 또는 비밀번호가 맞지 않아요." });
  }
  setSessionCookie(res, row.user_id);
  res.json({ user: toUser(row) });
});

authRoutes.post("/logout", (_req, res) => {
  clearSessionCookie(res);
  res.json({ ok: true });
});

authRoutes.get("/me", async (req, res) => {
  const uid = sessionUserId(req);
  if (!uid) return res.json({ user: null });
  const { rows } = await pool.query("SELECT user_id, nickname FROM users WHERE user_id = $1", [uid]);
  if (!rows.length) {
    clearSessionCookie(res);
    return res.json({ user: null });
  }
  res.json({ user: toUser(rows[0]) });
});
