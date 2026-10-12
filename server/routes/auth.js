// 로그인 API (/api/auth): 가입, 로그인, 로그아웃, 지금 로그인한 사용자, 비밀번호 바꾸기. 아이디는 users.nickname 을 그대로 쓴다.
// 비밀번호 해시와 세션 쿠키는 ../auth.js 가 맡는다.
import { Router } from "express";
import { clearSessionCookie, hashPassword, sessionUserId, setSessionCookie, verifyPassword } from "../auth.js";
import { pool } from "../db.js";
import { BadRequest } from "../errors.js";

const LOGIN_ID_RULE = /^[\p{L}\p{N}_-]{2,20}$/u;
const MIN_PASSWORD = 4;
const MAX_PASSWORD = 72;

function checkPasswordLength(password, name = "비밀번호") {
  if (password.length < MIN_PASSWORD || password.length > MAX_PASSWORD)
    throw new BadRequest(`${name}는 ${MIN_PASSWORD}~${MAX_PASSWORD}자로 입력해 주세요.`);
}

function readCredentials(body) {
  const loginId = String(body?.loginId ?? "").trim();
  const password = String(body?.password ?? "");
  if (!LOGIN_ID_RULE.test(loginId)) throw new BadRequest("아이디는 2~20자의 한글·영문·숫자·_·- 만 쓸 수 있어요.");
  checkPasswordLength(password);
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

// 비밀번호 바꾸기 (로그인 화면): 아이디와 지금 비밀번호가 맞아야 바꾼다. 로그인은 하지 않는다.
// 아이디가 없을 때와 비밀번호가 틀렸을 때 같은 안내를 보내서, 어떤 아이디가 있는지 알 수 없게 한다.
authRoutes.post("/password", async (req, res) => {
  const loginId = String(req.body?.loginId ?? "").trim();
  const currentPassword = String(req.body?.currentPassword ?? "");
  const newPassword = String(req.body?.newPassword ?? "");
  if (!loginId || !currentPassword) throw new BadRequest("아이디와 지금 비밀번호를 입력해 주세요.");
  checkPasswordLength(newPassword, "새 비밀번호");
  if (newPassword === currentPassword) throw new BadRequest("새 비밀번호가 지금 비밀번호와 같아요.");

  const { rows } = await pool.query("SELECT user_id, password_hash FROM users WHERE nickname = $1", [loginId]);
  if (!rows.length || !(await verifyPassword(currentPassword, rows[0].password_hash))) {
    return res.status(401).json({ error: "아이디 또는 지금 비밀번호가 맞지 않아요." });
  }
  await pool.query("UPDATE users SET password_hash = $1 WHERE user_id = $2", [await hashPassword(newPassword), rows[0].user_id]);
  res.json({ ok: true });
});
