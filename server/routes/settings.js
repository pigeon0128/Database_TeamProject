// 그리기 설정 API (/api/settings): 사용자당 한 행(user_settings)을 불러오고 저장한다.
// 값 범위는 세 곳이 같아야 한다: 여기 readSettings, 앱 src/lib/userSettings.ts 의 sanitize,
// DB database/migrations/003_user_settings.sql 의 CHECK 제약. 하나를 바꾸면 나머지도 바꾼다.
import { Router } from "express";
import { requireUser } from "../auth.js";
import { pool } from "../db.js";
import { BadRequest } from "../errors.js";

function readSettings(body) {
  const int = (value, min, max, name) => {
    const n = Number(value);
    if (!Number.isInteger(n) || n < min || n > max) throw new BadRequest(`${name} 값은 ${min}~${max} 사이여야 해요.`);
    return n;
  };
  if (typeof body?.guideVisible !== "boolean") throw new BadRequest("밑그림 보이기 값이 올바르지 않아요.");
  return {
    brushSize: int(body.brushSize, 2, 48, "굵기"),
    guideVisible: body.guideVisible,
    guideOpacity: int(body.guideOpacity, 10, 100, "밑그림 진하기"),
    smoothing: int(body.smoothing, 0, 100, "손떨림 보정"),
    fade: int(body.fade, 0, 100, "선 끝 얇게"),
  };
}

const toSettings = (r) => ({
  brushSize: r.brush_size,
  guideVisible: r.guide_visible,
  guideOpacity: r.guide_opacity,
  smoothing: r.smoothing,
  fade: r.fade,
  updatedAt: r.updated_at,
});

export const settingsRoutes = Router();

// 저장된 설정이 없으면 settings: null (앱이 기본값을 쓰고, 처음 로그인이면 그 값을 올린다)
settingsRoutes.get("/", requireUser, async (req, res) => {
  const { rows } = await pool.query(
    "SELECT brush_size, guide_visible, guide_opacity, smoothing, fade, updated_at FROM user_settings WHERE user_id = $1",
    [req.userId],
  );
  res.json({ settings: rows.length ? toSettings(rows[0]) : null });
});

// 처음이면 INSERT, 이미 있으면 UPDATE (database/queries/user_settings.sql 의 UPSERT와 같다)
settingsRoutes.put("/", requireUser, async (req, res) => {
  const s = readSettings(req.body);
  const { rows } = await pool.query(
    `INSERT INTO user_settings (user_id, brush_size, guide_visible, guide_opacity, smoothing, fade)
     VALUES ($1, $2, $3, $4, $5, $6)
     ON CONFLICT (user_id) DO UPDATE
     SET brush_size = EXCLUDED.brush_size,
         guide_visible = EXCLUDED.guide_visible,
         guide_opacity = EXCLUDED.guide_opacity,
         smoothing = EXCLUDED.smoothing,
         fade = EXCLUDED.fade,
         updated_at = NOW()
     RETURNING brush_size, guide_visible, guide_opacity, smoothing, fade, updated_at`,
    [req.userId, s.brushSize, s.guideVisible, s.guideOpacity, s.smoothing, s.fade],
  );
  res.json({ settings: toSettings(rows[0]) });
});
