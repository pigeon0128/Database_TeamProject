// 특수 브러쉬 API (/api/brushes): 색칠하기 화면의 무늬 브러쉬 목록과 구매 (migrations/018).
// 표: special_brushes (브러쉬·가격), user_brushes (산 브러쉬), users.cells (가진 셀)
import { Router } from "express";
import { requireUser } from "../auth.js";
import { pool } from "../db.js";
import { BadRequest } from "../errors.js";

export const brushRoutes = Router();

/** 내 셀과 특수 브러쉬 목록 (산 것인지 owned 로 표시) */
async function brushState(db, userId) {
  const [brushes, user] = await Promise.all([
    db.query(
      `SELECT b.brush_id, b.slug, b.name, b.price, (ub.user_id IS NOT NULL) AS owned
         FROM special_brushes b
         LEFT JOIN user_brushes ub ON ub.brush_id = b.brush_id AND ub.user_id = $1
        ORDER BY b.brush_order`,
      [userId],
    ),
    db.query("SELECT cells FROM users WHERE user_id = $1", [userId]),
  ]);
  return {
    cells: user.rows[0]?.cells ?? 0,
    brushes: brushes.rows.map((r) => ({ id: r.brush_id, slug: r.slug, name: r.name, price: r.price, owned: r.owned })),
  };
}

brushRoutes.get("/", requireUser, async (req, res) => {
  res.json(await brushState(pool, req.userId));
});

// 구매: 셀을 가격만큼 빼고 산 브러쉬에 넣는다. 둘 중 하나만 되는 일이 없도록 한 트랜잭션으로 묶는다.
brushRoutes.post("/:slug/purchase", requireUser, async (req, res) => {
  const slug = String(req.params.slug ?? "");
  const client = await pool.connect();
  try {
    await client.query("BEGIN");
    // 같은 사용자가 동시에 여러 번 사도 셀이 두 번 빠지지 않게 사용자 행을 잠근다
    const user = await client.query("SELECT cells FROM users WHERE user_id = $1 FOR UPDATE", [req.userId]);
    const brush = await client.query("SELECT brush_id, price FROM special_brushes WHERE slug = $1", [slug]);
    if (!brush.rows.length) throw new BadRequest("없는 브러쉬예요.");
    const { brush_id: brushId, price } = brush.rows[0];
    const owned = await client.query("SELECT 1 FROM user_brushes WHERE user_id = $1 AND brush_id = $2", [req.userId, brushId]);
    if (owned.rows.length) throw new BadRequest("이미 산 브러쉬예요.");
    if (user.rows[0].cells < price) throw new BadRequest(`셀이 부족해요. (필요 ${price}, 가진 셀 ${user.rows[0].cells})`);
    await client.query("UPDATE users SET cells = cells - $2 WHERE user_id = $1", [req.userId, price]);
    await client.query("INSERT INTO user_brushes (user_id, brush_id) VALUES ($1, $2)", [req.userId, brushId]);
    await client.query("COMMIT");
  } catch (err) {
    await client.query("ROLLBACK").catch(() => {});
    throw err;
  } finally {
    client.release();
  }
  res.status(201).json(await brushState(pool, req.userId));
});
