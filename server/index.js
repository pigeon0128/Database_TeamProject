// DOROLAND 그림 그리기 API 서버: 앱 설정과 API 경로 연결만 한다. 각 기능은 routes/ 에 있다.
// 실행: pnpm dev:server  (기본 포트 3001, 개발 중에는 Vite가 /api 요청을 이 서버로 넘긴다)
//   routes/auth.js      /api/auth/*      가입·로그인·로그아웃·내 정보·비밀번호 바꾸기
//   routes/drawings.js  /api/drawings    장면 목록
//   routes/brushes.js   /api/brushes     색칠하기 특수 브러쉬 목록
//   routes/records.js   /api/play-records, /api/leaderboard   기록·리더보드
//   /uploads/*          완성 그림 파일 (서버 폴더, ./storage.js). DB에는 경로(user_artworks.image_key)만 있다
//   routes/settings.js  /api/settings    그리기 설정·단축키
//   routes/drafts.js    /api/drafts/*    그리던 그림 (이어서 그리기)
//   routes/collection.js /api/collection 생물 도감과 내 수집 현황
import express from "express";
import { pool } from "./db.js";
import { UPLOAD_DIR } from "./storage.js";
import { errorHandler, notFound } from "./errors.js";
import { authRoutes } from "./routes/auth.js";
import { brushRoutes } from "./routes/brushes.js";
import { collectionRoutes } from "./routes/collection.js";
import { draftRoutes } from "./routes/drafts.js";
import { drawingRoutes } from "./routes/drawings.js";
import { recordRoutes } from "./routes/records.js";
import { settingsRoutes } from "./routes/settings.js";
import { myroomRoutes } from "./routes/myroom.js";

const app = express();

// 요청 본문(JSON) 크기 제한. 그림이 들어가는 요청(그리던 그림, 완성 그림이 붙은 기록)만 크게 받는다.
const smallJson = express.json({ limit: "100kb" });
const largeJson = express.json({ limit: "5mb" });
// 색칠 오브젝트(수납하기)는 부위별 색 샘플이 들어가 가장 크다.
const hugeJson = express.json({ limit: "8mb" });
const carriesImage = (path) => path.startsWith("/api/drafts/") || path === "/api/play-records";
app.use((req, res, next) =>
  (req.path === "/api/myroom/storage" ? hugeJson : carriesImage(req.path) ? largeJson : smallJson)(req, res, next),
);

// 상태 확인 (DB 연결까지)
app.get("/api/health", async (_req, res) => {
  await pool.query("SELECT 1");
  res.json({ ok: true });
});

// 완성 그림 파일. 경로에 기록 번호가 들어가 한 번 저장된 파일은 바뀌지 않으므로 브라우저가 오래 보관해도 된다
app.use("/uploads", express.static(UPLOAD_DIR, { immutable: true, maxAge: "365d", index: false, fallthrough: false }));

app.use("/api/auth", authRoutes);
app.use("/api/drawings", drawingRoutes);
app.use("/api/brushes", brushRoutes);
app.use("/api", recordRoutes);
app.use("/api/settings", settingsRoutes);
app.use("/api/drafts", draftRoutes);
app.use("/api/collection", collectionRoutes);
app.use("/api/myroom", myroomRoutes);

app.use("/api", notFound);
app.use(errorHandler);

const port = Number(process.env.API_PORT) || 3001;
app.listen(port, () => console.log(`[api] http://localhost:${port} 에서 실행 중`));
