// AI 밑그림 API (/api/ai/sketch): 글로 적은 내용을 OpenAI 이미지 API로 보내 따라 그릴 밑그림(PNG)을 받아 온다.
// 도감 밑그림(src/assets/creatures)과 같은 형식으로 나오게, 도감 그림 몇 장을 "그림체 참고" 이미지로 함께 보낸다 (이미지 편집 API).
//   형식: 밝은 회색 바탕(밝기 182) + 굵기가 일정한 흰 선, 색·명암·글씨 없음. 흰 선이 색칠 구역의 경계가 된다 (src/lib/drawing/regions.ts).
//   받은 그림의 바탕·선 밝기는 화면에서 한 번 더 도감과 똑같이 맞춘다 (src/lib/drawing/aiGuide.ts).
// 키는 서버에만 둔다 (.env 의 OPENAI_API_KEY). 브라우저로는 그림(data URL)만 돌려준다.
// 한 장 만들 때마다 셀(users.cells)을 낸다 (AI_SKETCH_CELLS, 기본 50). 요청 글이 막히면 내지 않고, 그림을 못 만들면 돌려준다.
//   GET/POST /api/ai/sketch  AI 밑그림 (캐릭터 그리기): 가격·내 셀 / 만들기 → { image, cells(남은 셀), cost }
//   GET/POST /api/ai/image   AI 그림 연습실 (#/ai-studio): 칸마다 쓴 설명으로 그림 (AI_IMAGE_CELLS, 기본 50) → { image, imageId, … }
//   POST /api/ai/image/:imageId/myroom  만든 그림을 마이룸 작품으로 추가 (DB user_ai_artworks, migrations/026)
//   OPENAI_API_KEY        필수. https://platform.openai.com/api-keys 에서 만든 키
//   OPENAI_IMAGE_MODEL    선택. 기본 gpt-image-2
//   OPENAI_IMAGE_QUALITY  선택. low / medium / high (기본 low: 밑그림은 선만 있으면 돼서 싸고 빠르게)
import { randomUUID } from "node:crypto";
import { readFile } from "node:fs/promises";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { Router } from "express";
import { requireUser } from "../auth.js";
import { pool } from "../db.js";
import { BadRequest } from "../errors.js";
import { aiArtworkKey, aiTempDir, listFiles, loadFile, removeFile, saveFile } from "../storage.js";
import { AI_ARTWORK_BASE } from "../../shared/myroom.js";

export const aiRoutes = Router();

const MAX_PROMPT = 200;
/** 사용자 한 명이 1분에 만들 수 있는 그림 수 (요금 폭탄 방지, AI 밑그림과 AI 그림 연습실이 함께 센다).
 *  실제로 그림을 받은 경우만 센다: 내용 검사에 막히거나 셀이 모자라거나 그리다 실패하면 그 횟수는 돌려준다. */
const PER_MINUTE = 3;
const recent = new Map();

/** 그림체 참고로 보내는 도감 밑그림 (동물 하나, 식물 하나). 내용은 따라 하지 않고 선·바탕 형식만 따르게 한다 */
const creaturesDir = join(dirname(fileURLToPath(import.meta.url)), "..", "..", "src", "assets", "creatures");
const REFERENCES = ["cat.png", "rose.png"];
let referenceFiles = null;
const loadReferences = async () =>
  (referenceFiles ??= await Promise.all(
    REFERENCES.map(async (name) => ({ name, blob: new Blob([await readFile(join(creaturesDir, name))], { type: "image/png" }) })),
  ));

/**
 * 요청 글 검사 기준 (OpenAI Moderation API 의 항목별 점수, 0~1). 하나라도 기준 이상이면 그림을 만들지 않는다.
 * OpenAI 기본 판정(flagged)은 쓰지 않는다: 시험해 보니 "공룡이 싸우는 모습", "칼로 사과를 자르는 곰", "사냥하는 사자" 같은
 * 아이들 요청을 막고, "벌거벗은 여자", "손목을 긋는 아이"는 통과시켰다.
 * 기준값은 정상 문장 20개 / 막아야 할 문장 10개의 점수로 정했다 (2026-11-26, omni-moderation-latest).
 *   - 폭력(violence)은 정상 문장도 0.42 까지 나와서 느슨하게. 피·상처·시체 같은 잔인한 묘사(violence/graphic)로 막는다
 *     (정상 최대 0.05, 막을 문장 0.11~0.27)
 *   - 성적 내용은 정상 최대 0.21("닌자 강아지"), 막을 문장 0.37 이상
 *   - 자해는 정상 최대 0.04, 막을 문장 0.06~0.16. 아동 성적 내용·혐오·위협은 아주 엄격하게 (시험 문장 없음)
 * 막힌 요청은 점수와 함께 서버 로그에 남기므로, 엉뚱하게 막히면 로그를 보고 조정한다.
 */
const MODERATION_LIMITS = {
  sexual: 0.3,
  "sexual/minors": 0.01,
  violence: 0.6,
  "violence/graphic": 0.08,
  "self-harm": 0.05,
  "self-harm/intent": 0.03,
  "self-harm/instructions": 0.01,
  harassment: 0.3,
  "harassment/threatening": 0.1,
  hate: 0.2,
  "hate/threatening": 0.05,
  illicit: 0.3,
  "illicit/violent": 0.07,
};

/** 기준을 넘은 항목 목록 (빈 배열이면 통과). 검사를 못 하면 예외를 던진다 (아이용이라 검사 없이 만들지 않는다) */
export async function moderate(key, text) {
  const response = await fetch("https://api.openai.com/v1/moderations", {
    method: "POST",
    headers: { Authorization: `Bearer ${key}`, "Content-Type": "application/json" },
    body: JSON.stringify({ model: "omni-moderation-latest", input: text }),
    signal: AbortSignal.timeout(20_000),
  });
  const data = await response.json().catch(() => null);
  const scores = data?.results?.[0]?.category_scores;
  if (!response.ok || !scores) throw new Error(data?.error?.message ?? `moderation ${response.status}`);
  const over = Object.entries(MODERATION_LIMITS).filter(([category, limit]) => (scores[category] ?? 0) >= limit);
  return over.map(([category]) => `${category}=${scores[category].toFixed(3)}`);
}

/**
 * 1분 횟수에 한 칸을 잡아 둔다 (동시에 여러 번 눌러도 넘치지 않게 먼저 잡는다).
 * 자리가 없으면 null, 있으면 실패했을 때 그 칸을 돌려주는 함수.
 */
function takeRate(userId) {
  const now = Date.now();
  const times = (recent.get(userId) ?? []).filter((t) => now - t < 60_000);
  if (times.length >= PER_MINUTE) return null;
  times.push(now);
  recent.set(userId, times);
  return () => {
    const list = recent.get(userId);
    const i = list?.indexOf(now) ?? -1;
    if (i >= 0) list.splice(i, 1);
  };
}

/**
 * 아이가 적은 글을 "도감 밑그림과 같은 형식의 선화" 요청으로 감싼다.
 * 결과는 그림만 나와야 한다: 글자·숫자·말풍선·간판·로고 같은 글씨는 어떤 경우에도 넣지 않게 한다.
 * 아이가 "OO라고 써 줘"처럼 적어도 글씨는 그리지 않고 대상만 그리게 한다.
 */
const sketchPrompt = (subject) =>
  [
    "The attached images are STYLE REFERENCES ONLY. Do not copy their subjects (no cat, no rose unless asked).",
    `Draw a NEW tracing guide of this subject: ${subject}.`,
    "Match the reference format exactly: flat solid light gray background (#B6B6B6) filling the whole square,",
    "and the drawing made only of thin, smooth, uniform-width pure white outlines (about 0.4% of the image width), like the references.",
    "Outlines must form closed shapes so each part (head, body, legs, clothes, objects) can be colored separately.",
    "No fills, no color, no shading, no gradients, no shadows, no black lines, no texture, no border, no background scenery.",
    "One main subject, simple and friendly for young children, centered, fully inside the frame with margin on all sides.",
    "STRICTLY NO TEXT anywhere in the image: no letters, no words, no numbers, no Korean or any other writing, no captions, no titles,",
    "no speech bubbles, no signs, no labels, no logos, no watermarks, no signatures.",
    "If the description asks for words or writing, ignore that part and draw only the picture.",
    "Family-friendly.",
  ].join(" ");

/** 그림 한 장에 드는 셀 (.env 의 envName, 기본 50셀. 특수 브러쉬 하나가 100셀) */
function cellCost(envName) {
  const n = Number(process.env[envName]);
  return Number.isInteger(n) && n >= 0 ? n : 50;
}
const sketchCost = () => cellCost("AI_SKETCH_CELLS");
const imageCost = () => cellCost("AI_IMAGE_CELLS");

/** 가격과 내 셀을 돌려주는 GET (화면이 만들기 버튼에 가격·내 셀을 보여 준다) */
const walletRoute = (cost) => async (req, res) => {
  const { rows } = await pool.query("SELECT cells FROM users WHERE user_id = $1", [req.userId]);
  res.json({ cost: cost(), cells: rows[0]?.cells ?? 0 });
};

/**
 * 셀을 내고 그림 한 장 만들기 (밑그림·연습실 공용).
 *   1. 요청 글 검사 (무료). 막히면 셀을 내지 않는다
 *   2. 셀 내기: 모자라면 만들지 않는다. 조건(cells >= 가격)을 건 UPDATE 한 번이라 동시에 눌러도 두 번 빠지지 않는다
 *   3. 만들기 (run). 실패하면(예상 못 한 오류 포함) 낸 셀을 돌려준다
 * 응답: 성공 { image, cells(남은 셀), cost } / 실패 { error, cells? }
 */
async function paidGeneration(req, res, { checkText, cost, run, extra }) {
  const key = process.env.OPENAI_API_KEY;
  if (!key) return res.status(503).json({ error: "AI 그림을 쓰려면 서버 .env 에 OPENAI_API_KEY 를 넣어 주세요." });
  const releaseRate = takeRate(req.userId);
  if (!releaseRate) return res.status(429).json({ error: `잠시 뒤에 다시 만들어 주세요. (1분에 ${PER_MINUTE}번까지)` });

  let blocked;
  try {
    blocked = await moderate(key, checkText);
  } catch (err) {
    console.error("[ai] 요청 글 검사 실패:", err.message);
    releaseRate();
    return res.status(502).json({ error: "지금은 그림을 만들 수 없어요. 잠시 뒤 다시 해 주세요." });
  }
  if (blocked.length) {
    console.warn(`[ai] 요청 글 차단 (사용자 ${req.userId}): "${checkText}" ${blocked.join(" ")}`);
    releaseRate();
    return res.status(400).json({ error: "이 내용으로는 그림을 만들 수 없어요. 다른 말로 적어 주세요." });
  }

  let paid;
  try {
    paid = await pool.query("UPDATE users SET cells = cells - $2 WHERE user_id = $1 AND cells >= $2 RETURNING cells", [req.userId, cost]);
  } catch (err) {
    releaseRate();
    throw err;
  }
  if (!paid.rows.length) {
    releaseRate();
    const { rows } = await pool.query("SELECT cells FROM users WHERE user_id = $1", [req.userId]);
    return res.status(400).json({ error: `셀이 부족해요. (필요 ${cost}셀, 가진 셀 ${rows[0]?.cells ?? 0}셀)` });
  }

  let result;
  try {
    result = await run(key);
  } catch (err) {
    console.error("[ai] 그림 만들기 오류:", err);
    result = { status: 500, error: "그림을 만들지 못했어요. 잠시 뒤 다시 해 주세요." };
  }
  if (result.error) {
    releaseRate();
    const refund = await pool.query("UPDATE users SET cells = cells + $2 WHERE user_id = $1 RETURNING cells", [req.userId, cost]);
    return res.status(result.status).json({ error: `${result.error} (셀은 돌려드렸어요)`, cells: refund.rows[0]?.cells });
  }
  // 덧붙일 값을 못 만들어도(보관 실패 등) 그림은 돌려준다 (셀은 이미 그림 값으로 냈다)
  const more = await Promise.resolve(extra?.(result)).catch((err) => {
    console.error("[ai] 그림 보관 실패:", err.message);
    return {};
  });
  res.json({ image: result.image, cells: paid.rows[0].cells, cost, ...(more ?? {}) });
}

const readText = (value, max, emptyMessage) => {
  const text = typeof value === "string" ? value.trim() : "";
  if (!text && emptyMessage) throw new BadRequest(emptyMessage);
  if (text.length > max) throw new BadRequest(`${max}자 안으로 적어 주세요.`);
  return text;
};

// ── AI 밑그림 (캐릭터 그리기): 도감 형식 선화 ─────────────────────────
aiRoutes.get("/sketch", requireUser, walletRoute(sketchCost));

aiRoutes.post("/sketch", requireUser, async (req, res) => {
  const subject = readText(req.body?.prompt, MAX_PROMPT, "무엇을 그릴지 적어 주세요.");
  await paidGeneration(req, res, {
    checkText: subject,
    cost: sketchCost(),
    run: async (key) => {
      const form = new FormData();
      form.append("model", process.env.OPENAI_IMAGE_MODEL || "gpt-image-2");
      form.append("prompt", sketchPrompt(subject));
      form.append("size", "1024x1024");
      form.append("quality", process.env.OPENAI_IMAGE_QUALITY || "low");
      form.append("n", "1");
      for (const ref of await loadReferences()) form.append("image[]", ref.blob, ref.name);
      return callOpenAI(key, "edits", { body: form });
    },
  });
});

// ── AI 그림 연습실 (#/ai-studio): 아이가 칸마다 직접 쓴 설명으로 그림 만들기 ─────────────
// 칸: 배경 설명, 캐릭터(켜면 머리·얼굴·상반신·하반신), 빼고 싶은 것(선택). 칸 내용을 그대로 이어 붙여 프롬프트를 만든다.
// 그림체는 아이가 적은 대로 두고, 아이용·글씨 없음만 덧붙인다.
// OpenAI 이미지 API 에는 네거티브 칸이 없어서, "빼고 싶은 것"은 "Avoid: …" 문장으로 붙인다 (확실하게 빠지지는 않는다).
const MAX_FIELD = 150;
const MAX_AVOID = 120;
/** 캐릭터 칸 (화면 AiStudioPage 의 순서와 같다) */
const CHARACTER_PARTS = [
  ["head", "Head and hair"],
  ["face", "Face"],
  ["upper", "Upper body (top, arms, hands)"],
  ["lower", "Lower body (bottom, legs, shoes)"],
];

function practicePrompt({ background, character, avoid }) {
  const lines = [];
  if (character) {
    lines.push("Draw one main character, full body, clearly visible.");
    for (const [key, label] of CHARACTER_PARTS) if (character[key]) lines.push(`- ${label}: ${character[key]}`);
  } else {
    lines.push("Draw a scene with no characters or people in it.");
  }
  if (background) lines.push(`Background: ${background}`);
  if (avoid) lines.push(`Avoid these in the picture: ${avoid}.`);
  lines.push(
    "Make it a family-friendly picture suitable for young children.",
    "STRICTLY NO TEXT anywhere in the image: no letters, no words, no numbers, no Korean or any other writing, no captions,",
    "no speech bubbles, no signs, no labels, no logos, no watermarks, no signatures. If the description asks for writing, draw only the picture.",
  );
  return lines.join("\n");
}

aiRoutes.get("/image", requireUser, walletRoute(imageCost));

aiRoutes.post("/image", requireUser, async (req, res) => {
  const background = readText(req.body?.background, MAX_FIELD);
  const avoid = readText(req.body?.avoid, MAX_AVOID);
  let character = null;
  if (req.body?.character) {
    character = {};
    for (const [key] of CHARACTER_PARTS) character[key] = readText(req.body.character[key], MAX_FIELD);
    if (!CHARACTER_PARTS.some(([key]) => character[key])) throw new BadRequest("캐릭터의 머리·얼굴·상반신·하반신 중 하나는 적어 주세요.");
  }
  if (!background && !character) throw new BadRequest("배경 설명을 적거나 캐릭터를 켜고 적어 주세요.");

  // 아이가 쓴 칸을 모두 검사한다 ("빼고 싶은 것"은 "피 없이"처럼 좋은 뜻으로 적어도 막히기 쉬워 빼고 검사한다)
  const written = [background, ...(character ? CHARACTER_PARTS.map(([key]) => character[key]) : [])].filter(Boolean).join("\n");
  await paidGeneration(req, res, {
    checkText: written,
    cost: imageCost(),
    // 마이룸에 추가할 수 있게 만든 그림을 잠시 보관하고 그 번호를 준다
    extra: async (result) => ({ imageId: await keepImage(req.userId, result.image, artworkTitle(background, character)) }),
    run: (key) =>
      callOpenAI(key, "generations", {
        json: {
          model: process.env.OPENAI_IMAGE_MODEL || "gpt-image-2",
          prompt: practicePrompt({ background, character, avoid }),
          size: "1024x1024",
          quality: process.env.OPENAI_IMAGE_QUALITY || "low",
          n: 1,
        },
      }),
  });
});

/** OpenAI 이미지 API 호출. 성공하면 { image }, 실패하면 { status, error } (화면에 보여 줄 한국어) */
async function callOpenAI(key, endpoint, { body, json }) {
  let response;
  try {
    response = await fetch(`https://api.openai.com/v1/images/${endpoint}`, {
      method: "POST",
      headers: json ? { Authorization: `Bearer ${key}`, "Content-Type": "application/json" } : { Authorization: `Bearer ${key}` },
      body: json ? JSON.stringify(json) : body,
      signal: AbortSignal.timeout(180_000),
    });
  } catch (err) {
    console.error("[ai] OpenAI 연결 실패:", err.message);
    return { status: 502, error: "AI 서버에 연결하지 못했어요. 잠시 뒤 다시 해 주세요." };
  }

  const data = await response.json().catch(() => null);
  if (!response.ok) {
    const message = data?.error?.message ?? response.statusText;
    console.error(`[ai] OpenAI 오류 ${response.status}:`, message);
    if (data?.error?.code === "moderation_blocked" || /safety|moderation/i.test(message)) {
      return { status: 400, error: "이 내용으로는 그림을 만들 수 없어요. 다른 말로 적어 주세요." };
    }
    if (response.status === 401) return { status: 503, error: "OpenAI 키가 올바르지 않아요. 서버 .env 의 OPENAI_API_KEY 를 확인해 주세요." };
    if (response.status === 429) return { status: 429, error: "AI 사용량이 많거나 크레딧이 부족해요. 잠시 뒤 다시 해 주세요." };
    return { status: 502, error: "AI가 그림을 만들지 못했어요. 잠시 뒤 다시 해 주세요." };
  }

  const b64 = data?.data?.[0]?.b64_json;
  if (!b64) return { status: 502, error: "AI가 그림을 돌려주지 않았어요." };
  return { image: `data:image/png;base64,${b64}` };
}

// ── 만든 그림을 마이룸에 추가 ────────────────────────────────────────
// 브라우저가 보낸 그림을 그대로 받으면 아무 그림이나 마이룸에 올릴 수 있으므로, 서버가 만든 그림을 서버 폴더에 잠시(KEEP_MS) 두고
// "마이룸에 추가"는 그 번호(imageId)만 받는다. 파일로 두므로 서버를 다시 켜도 남는다.
//   uploads/ai-temp/<사용자>/<imageId>.png  그림,  <imageId>.json  마이룸 이름 { title }
const KEEP_MS = 2 * 60 * 60 * 1000;
/** 사용자 한 명이 보관할 수 있는 그림 수 (오래된 것부터 지운다) */
const KEEP_PER_USER = 12;
const IMAGE_ID = /^[0-9a-f-]{36}$/;

async function keepImage(userId, image, title) {
  const dir = aiTempDir(userId);
  // 오래됐거나 너무 많은 그림부터 지운다
  const files = (await listFiles(dir)).filter((f) => f.name.endsWith(".png")).sort((a, b) => b.mtime - a.mtime);
  const now = Date.now();
  for (const [i, f] of files.entries()) {
    if (i >= KEEP_PER_USER - 1 || now - f.mtime > KEEP_MS) {
      const id = f.name.slice(0, -4);
      await removeFile(`${dir}/${id}.png`);
      await removeFile(`${dir}/${id}.json`);
    }
  }
  const id = randomUUID();
  await saveFile(`${dir}/${id}.png`, Buffer.from(image.slice(image.indexOf(",") + 1), "base64"));
  await saveFile(`${dir}/${id}.json`, JSON.stringify({ title }));
  return id;
}

/** 마이룸 작품 목록에 보일 이름: 캐릭터 설명(머리·얼굴…) 또는 배경 설명의 앞부분 */
function artworkTitle(background, character) {
  const text = (character ? CHARACTER_PARTS.map(([key]) => character[key]).filter(Boolean).join(" ") : background) || background || "AI 그림";
  const flat = text.replace(/\s+/g, " ").trim();
  return flat.length > 24 ? `${flat.slice(0, 23)}…` : flat;
}

aiRoutes.post("/image/:imageId/myroom", requireUser, async (req, res) => {
  const id = String(req.params.imageId ?? "");
  const dir = aiTempDir(req.userId);
  const [bytes, meta, info] = IMAGE_ID.test(id)
    ? await Promise.all([loadFile(`${dir}/${id}.png`), loadFile(`${dir}/${id}.json`), listFiles(dir)])
    : [null, null, []];
  const kept = info.find((f) => f.name === `${id}.png`);
  if (!bytes || !kept || Date.now() - kept.mtime > KEEP_MS) {
    throw new BadRequest("이 그림은 마이룸에 추가할 수 있는 시간이 지났어요. 💾 PNG 저장으로 내려받아 주세요.");
  }
  let title = "AI 그림";
  try {
    title = JSON.parse(String(meta)).title || title;
  } catch {
    // 이름 파일이 없으면 기본 이름
  }

  const client = await pool.connect();
  let artwork;
  try {
    await client.query("BEGIN");
    // 번호를 먼저 받아 파일 경로를 정하고, 파일을 쓴 뒤 경로를 채운다 (파일을 못 쓰면 행도 남기지 않는다)
    const { rows } = await client.query("INSERT INTO user_ai_artworks (user_id, title, image_key) VALUES ($1, $2, '') RETURNING ai_artwork_id", [req.userId, title]);
    const aiArtworkId = rows[0].ai_artwork_id;
    const key = aiArtworkKey(req.userId, aiArtworkId);
    await saveFile(key, bytes);
    await client.query("UPDATE user_ai_artworks SET image_key = $2 WHERE ai_artwork_id = $1", [aiArtworkId, key]);
    await client.query("COMMIT");
    artwork = { drawingId: AI_ARTWORK_BASE + Number(aiArtworkId), name: title, kind: "ai", slug: null, imageKey: key };
  } catch (err) {
    await client.query("ROLLBACK").catch(() => {});
    throw err;
  } finally {
    client.release();
  }
  // 한 번 추가한 그림은 보관함에서 지워 두 번 들어가지 않게 한다
  await removeFile(`${dir}/${id}.png`);
  await removeFile(`${dir}/${id}.json`);
  res.status(201).json({ artwork });
});
