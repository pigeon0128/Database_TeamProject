// AI 밑그림 API (/api/ai/sketch): 글로 적은 내용을 OpenAI 이미지 API로 보내 따라 그릴 밑그림(PNG)을 받아 온다.
// 도감 밑그림(src/assets/creatures)과 같은 형식으로 나오게, 도감 그림 몇 장을 "그림체 참고" 이미지로 함께 보낸다 (이미지 편집 API).
//   형식: 밝은 회색 바탕(밝기 182) + 굵기가 일정한 흰 선, 색·명암·글씨 없음. 흰 선이 색칠 구역의 경계가 된다 (src/lib/drawing/regions.ts).
//   받은 그림의 바탕·선 밝기는 화면에서 한 번 더 도감과 똑같이 맞춘다 (src/lib/drawing/aiGuide.ts).
// 키는 서버에만 둔다 (.env 의 OPENAI_API_KEY). 브라우저로는 그림(data URL)만 돌려준다.
// 한 장 만들 때마다 셀(users.cells)을 낸다 (AI_SKETCH_CELLS, 기본 50). 요청 글이 막히면 내지 않고, 그림을 못 만들면 돌려준다.
//   GET/POST /api/ai/sketch  AI 밑그림 (캐릭터 그리기): 가격·내 셀 / 만들기 → { image, cells(남은 셀), cost }
//   GET/POST /api/ai/image   AI 그림 연습실 (#/ai-studio): 칸마다 쓴 설명으로 그림 (AI_IMAGE_CELLS, 기본 50) → { image, imageId, … }
//   POST /api/ai/image/:imageId/myroom  만든 그림을 마이룸 작품으로 추가 (DB user_ai_artworks, migrations/026)
//     (칸 대신 { prompt } 만 보내면 "프롬프트 직접 쓰기": 그대로 쓰고 아이용·글자 없음 규칙만 붙인다)
//   GET  /api/ai/artworks   마이룸에 넣은 AI 그림 목록 (연습실의 "마이룸 수납함" 창)
//   DELETE /api/ai/artworks/:drawingId  마이룸에 넣은 AI 그림 지우기 (마이룸의 "그린 그림 보기"). 액자에 걸려 있으면 409
//   PATCH  /api/ai/artworks/:drawingId  AI 그림 이름 바꾸기 { title } (1~40자)
//   GET/POST /api/ai/advice  AI 조언 (캐릭터 그리기의 "AI 조언"): 아이가 그린 그림을 보고 짧은 조언 (AI_ADVICE_CELLS, 기본 10) → { advice, cells, cost }
//   OPENAI_ADVICE_MODEL   선택. 그림을 보고 조언하는 모델 (기본 gpt-5.4-mini)
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
function cellCost(envName, fallback = 50) {
  const raw = process.env[envName];
  const n = Number(raw);
  return raw !== undefined && raw !== "" && Number.isInteger(n) && n >= 0 ? n : fallback;
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
async function paidGeneration(req, res, { checkText, check, blockedMessage, rateKey, cost, run, extra }) {
  const key = process.env.OPENAI_API_KEY;
  if (!key) return res.status(503).json({ error: "AI 그림을 쓰려면 서버 .env 에 OPENAI_API_KEY 를 넣어 주세요." });
  // 1분 횟수: 그림 만들기(밑그림·연습실)는 함께, 조언은 따로 센다 (rateKey)
  const releaseRate = takeRate(rateKey ? `${rateKey}:${req.userId}` : req.userId);
  if (!releaseRate) return res.status(429).json({ error: `잠시 뒤에 다시 만들어 주세요. (1분에 ${PER_MINUTE}번까지)` });

  let blocked;
  try {
    // check: 글 대신 다른 것(그림)을 검사할 때
    blocked = check ? await check(key) : await moderate(key, checkText);
  } catch (err) {
    console.error("[ai] 요청 글 검사 실패:", err.message);
    releaseRate();
    return res.status(502).json({ error: "지금은 그림을 만들 수 없어요. 잠시 뒤 다시 해 주세요." });
  }
  if (blocked.length) {
    console.warn(`[ai] 요청 차단 (사용자 ${req.userId}): "${checkText ?? "(그림)"}" ${blocked.join(" ")}`);
    releaseRate();
    return res.status(400).json({ error: blockedMessage ?? "이 내용으로는 그림을 만들 수 없어요. 다른 말로 적어 주세요.", code: "blocked" });
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
    // plain: 안내 문구를 그대로 보여 준다 (예: 조언 모델이 부적절한 그림이라고 판단했을 때)
    const error = result.plain ? result.error : `${result.error} (셀은 돌려드렸어요)`;
    return res.status(result.status).json({ error, code: result.code, cells: refund.rows[0]?.cells });
  }
  // 덧붙일 값을 못 만들어도(보관 실패 등) 그림은 돌려준다 (셀은 이미 그림 값으로 냈다)
  const more = await Promise.resolve(extra?.(result)).catch((err) => {
    console.error("[ai] 그림 보관 실패:", err.message);
    return {};
  });
  res.json({ ...result, cells: paid.rows[0].cells, cost, ...(more ?? {}) });
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
/** "프롬프트 직접 쓰기"의 글자 수 상한 (다른 곳에서 복사해 붙여 넣는 긴 프롬프트도 받게) */
const MAX_FREE_PROMPT = 1000;
/** 캐릭터 칸 (화면 AiStudioPage 의 순서와 같다) */
const CHARACTER_PARTS = [
  ["head", "Head and hair"],
  ["face", "Face"],
  ["upper", "Upper body (top, arms, hands)"],
  ["lower", "Lower body (bottom, legs, shoes)"],
];

/**
 * 화풍: 화면은 이름(키)만 보내고, 서버가 정한 영어 설명으로 바꾼다 (아무 글이나 화풍 칸에 넣지 못하게).
 * 실제 작가·회사 이름은 쓰지 않는다. "" = 기본 (아이용 그림책)
 */
const ART_STYLES = {
  "": "soft, colorful children's picture-book illustration",
  watercolor: "gentle watercolor painting with soft edges and light paper texture",
  crayon: "children's crayon drawing with bold, waxy strokes",
  pencil: "colored pencil drawing with visible hatching",
  cartoon: "clean cartoon style with bold outlines and flat bright colors",
  clay: "cute 3D clay figure style with soft lighting",
  pixel: "retro pixel art with a limited color palette",
  anime: "Japanese anime style with clean line art, cel shading and expressive eyes",
  realistic: "photorealistic, like a real photograph with natural lighting and real-world textures",
};
/** 성별: 상관없음(any) / 여자(female) / 남자(male) */
const GENDERS = { any: "", female: "female", male: "male" };
const MAX_CHARACTERS = 3;

function practicePrompt({ background, style, character, avoid }) {
  const lines = [];
  lines.push(`Art style: ${ART_STYLES[style] ?? ART_STYLES[""]}.`);
  if (character) {
    const { count, gender } = character;
    lines.push(
      count === 1
        ? "Draw one main character, full body, clearly visible."
        : `Draw exactly ${count} main characters together, full body, all clearly visible. The descriptions below apply to all of them.`,
    );
    if (GENDERS[gender]) lines.push(`- ${count === 1 ? "The character is" : "All characters are"} ${GENDERS[gender]}.`);
    for (const [key, label] of CHARACTER_PARTS) if (character[key]) lines.push(`- ${label}: ${character[key]}`);
    if (character.pose) lines.push(`- Pose and action: ${character.pose}`);
  } else {
    lines.push("Draw a scene with no characters or people in it.");
  }
  if (background) lines.push(`Background: ${background}`);
  if (avoid) lines.push(`Avoid these in the picture: ${avoid}.`);
  lines.push(...SAFE_RULES);
  return lines.join("\n");
}

/** 어느 방식이든 마지막에 붙는 규칙: 아이용 그림, 글자 없음 */
const SAFE_RULES = [
  "Make it a family-friendly picture suitable for young children.",
  "STRICTLY NO TEXT anywhere in the image: no letters, no words, no numbers, no Korean or any other writing, no captions,",
  "no speech bubbles, no signs, no labels, no logos, no watermarks, no signatures. If the description asks for writing, draw only the picture.",
];

/** "프롬프트 직접 쓰기": 아이가 쓴(붙여 넣은) 프롬프트를 그대로 쓰고, 끝에 같은 규칙만 붙인다 */
const freePrompt = (prompt) => [prompt, "", ...SAFE_RULES].join("\n");

aiRoutes.get("/image", requireUser, walletRoute(imageCost));

aiRoutes.post("/image", requireUser, async (req, res) => {
  // 프롬프트 직접 쓰기: 칸별 입력 대신 프롬프트 한 덩어리 (다른 칸은 쓰지 않는다)
  const prompt = readText(req.body?.prompt, MAX_FREE_PROMPT);
  if (prompt) {
    await paidGeneration(req, res, {
      checkText: prompt,
      cost: imageCost(),
      extra: async (result) => ({ imageId: await keepImage(req.userId, result.image, artworkTitle(prompt, null)) }),
      run: (key) =>
        callOpenAI(key, "generations", {
          json: {
            model: process.env.OPENAI_IMAGE_MODEL || "gpt-image-2",
            prompt: freePrompt(prompt),
            size: "1024x1024",
            quality: process.env.OPENAI_IMAGE_QUALITY || "low",
            n: 1,
          },
        }),
    });
    return;
  }
  const background = readText(req.body?.background, MAX_FIELD);
  const avoid = readText(req.body?.avoid, MAX_AVOID);
  const style = typeof req.body?.style === "string" && req.body.style in ART_STYLES ? req.body.style : "";
  let character = null;
  if (req.body?.character) {
    const body = req.body.character;
    character = {};
    for (const [key] of CHARACTER_PARTS) character[key] = readText(body[key], MAX_FIELD);
    character.pose = readText(body.pose, MAX_FIELD);
    character.gender = typeof body.gender === "string" && body.gender in GENDERS ? body.gender : "any";
    const count = Number(body.count);
    character.count = Number.isInteger(count) && count >= 1 && count <= MAX_CHARACTERS ? count : 1;
    if (!CHARACTER_PARTS.some(([key]) => character[key]) && !character.pose) {
      throw new BadRequest("캐릭터의 머리·얼굴·상반신·하반신·자세 중 하나는 적어 주세요.");
    }
  }
  if (!background && !character) throw new BadRequest("배경 설명을 적거나 캐릭터를 켜고 적어 주세요.");

  // 아이가 쓴 칸을 모두 검사한다 ("빼고 싶은 것"은 "피 없이"처럼 좋은 뜻으로 적어도 막히기 쉬워 빼고 검사한다)
  const written = [background, ...(character ? [...CHARACTER_PARTS.map(([key]) => character[key]), character.pose] : [])].filter(Boolean).join("\n");
  await paidGeneration(req, res, {
    checkText: written,
    cost: imageCost(),
    // 마이룸에 추가할 수 있게 만든 그림을 잠시 보관하고 그 번호를 준다
    extra: async (result) => ({ imageId: await keepImage(req.userId, result.image, artworkTitle(background, character)) }),
    run: (key) =>
      callOpenAI(key, "generations", {
        json: {
          model: process.env.OPENAI_IMAGE_MODEL || "gpt-image-2",
          prompt: practicePrompt({ background, style, character, avoid }),
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

// ── AI 조언 (캐릭터 그리기의 "AI 조언") ─────────────────────────────
// 아이가 그린 그림을 보고 잘한 점·더 해 볼 것·색 팁을 짧게 돌려준다. 고친 그림을 그려 주지는 않는다 (아이 그림을 대신 그리지 않게).
// 음란하거나 잔인한 그림은 세 겹으로 거른다. 걸리면 조언 대신 UNSAFE_MESSAGE 만 보여 주고, 셀과 1분 횟수는 쓰지 않은 것으로 한다.
//   1. 그림 검사 (omni-moderation, 무료): 조언 모델에 보내기 전에. IMAGE_LIMITS 이상이면 막는다
//   2. 조언 모델의 판단: 부적절한 그림이면 조언 대신 safe=false 로 답하게 한다 (1단계가 아이 그림의 거친 선을 놓칠 때를 대비)
//   3. 조언 글 검사: 받은 조언 글을 다시 검사해서 이상하면 버리고 기본 문구를 준다
// 서버에는 그림을 저장하지 않는다 (걸린 항목과 점수만 로그에 남긴다).
const adviceCost = () => cellCost("AI_ADVICE_CELLS", 10);
const adviceModel = () => process.env.OPENAI_ADVICE_MODEL || "gpt-5.4-mini";
const UNSAFE_MESSAGE = "좀 더 건전한 내용으로 그려보아요. 🌈";
const FALLBACK_ADVICE = { praise: "멋지게 그리고 있어요!", tip: "생각나는 걸 하나 더 그려 넣어 볼까요?", color: "좋아하는 색으로 칠해 봐요." };
/** 받는 그림 크기 상한 (data URL 글자 수). 화면이 512px JPEG 로 줄여 보내므로 보통 100KB 안쪽 */
const MAX_ADVICE_IMAGE = 1_500_000;

/**
 * 그림 검사 기준 (그림에서 점수가 나오는 항목만: 음란·폭력·자해). 처음에는 엄격하게 두고 로그를 보며 푼다.
 * 일반 폭력(violence)은 거의 막지 않는다: 시험해 보니 "칼 든 용사와 용" 그림이 0.77 이 나왔다 (2026-11-27).
 * 싸우는 그림은 아이들이 자주 그리므로 조언 모델의 판단(2단계)에 맡기고,
 * 피·훼손 같은 잔인한 묘사(violence/graphic, "칼에 찔려 피 흘리는 사람" 0.20)와 음란(sexual)을 엄격하게 막는다.
 */
const IMAGE_LIMITS = {
  sexual: 0.2,
  violence: 0.95,
  "violence/graphic": 0.15,
  "self-harm": 0.1,
  "self-harm/intent": 0.1,
  "self-harm/instructions": 0.05,
};

/** 그림 검사: 기준을 넘은 항목 목록 (빈 배열이면 통과). 검사를 못 하면 예외 (검사 없이 조언하지 않는다) */
async function moderateImage(key, image) {
  const response = await fetch("https://api.openai.com/v1/moderations", {
    method: "POST",
    headers: { Authorization: `Bearer ${key}`, "Content-Type": "application/json" },
    body: JSON.stringify({ model: "omni-moderation-latest", input: [{ type: "image_url", image_url: { url: image } }] }),
    signal: AbortSignal.timeout(20_000),
  });
  const data = await response.json().catch(() => null);
  const scores = data?.results?.[0]?.category_scores;
  if (!response.ok || !scores) throw new Error(data?.error?.message ?? `moderation ${response.status}`);
  const over = Object.entries(IMAGE_LIMITS).filter(([category, limit]) => (scores[category] ?? 0) >= limit);
  return over.map(([category]) => `${category}=${scores[category].toFixed(3)}`);
}

const ADVICE_SCHEMA = {
  type: "object",
  additionalProperties: false,
  required: ["safe", "praise", "tip", "color"],
  properties: {
    safe: { type: "boolean" },
    praise: { type: "string" },
    tip: { type: "string" },
    color: { type: "string" },
  },
};

const adviceInstructions = (title) =>
  [
    "You are CODEX, a warm drawing coach for children aged 6-12 in a Korean drawing app.",
    "Look at the child's drawing and reply ONLY in Korean, in friendly 해요체, with short sentences a child can read.",
    title ? `The child named this character "${title}". Use the name only as a hint about what they tried to draw.` : "",
    "Return JSON with:",
    "- praise: one specific thing they did well (one sentence, under 40 Korean characters).",
    "- tip: ONE gentle idea to add or try next, phrased as a suggestion like '~해 볼까요?' (one sentence, under 50 characters).",
    "- color: one coloring or background tip (one sentence, under 40 characters).",
    "Never criticize harshly, never give scores, never compare with other children, never mention that you are an AI.",
    "Do not tell them to erase or redo their work. Respect their own idea.",
    "If the drawing is almost empty, encourage them to start with one big shape.",
    "- safe: false ONLY if the drawing shows sexual content, nudity, or gory, bloody or cruel violence, or self-harm.",
    "  Normal kid themes such as knights with swords, monsters, dinosaurs fighting or superheroes are safe=true.",
    "  When safe is false, leave praise, tip and color as empty strings.",
  ]
    .filter(Boolean)
    .join("\n");

/** 2·3단계: 조언 모델에 묻고, 받은 조언 글을 검사한다 → { advice } 또는 { status, error, plain?, code? } */
async function askAdvice(key, image, title) {
  let response;
  try {
    response = await fetch("https://api.openai.com/v1/chat/completions", {
      method: "POST",
      headers: { Authorization: `Bearer ${key}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        model: adviceModel(),
        messages: [
          { role: "system", content: adviceInstructions(title) },
          { role: "user", content: [{ type: "image_url", image_url: { url: image, detail: "low" } }] },
        ],
        response_format: { type: "json_schema", json_schema: { name: "drawing_advice", strict: true, schema: ADVICE_SCHEMA } },
        reasoning_effort: "low",
        max_completion_tokens: 2000,
      }),
      signal: AbortSignal.timeout(60_000),
    });
  } catch (err) {
    console.error("[ai] 조언 연결 실패:", err.message);
    return { status: 502, error: "AI 서버에 연결하지 못했어요. 잠시 뒤 다시 해 주세요." };
  }
  const data = await response.json().catch(() => null);
  if (!response.ok) {
    console.error(`[ai] 조언 오류 ${response.status}:`, data?.error?.message ?? response.statusText);
    if (response.status === 429) return { status: 429, error: "AI 사용량이 많거나 크레딧이 부족해요. 잠시 뒤 다시 해 주세요." };
    return { status: 502, error: "AI가 조언을 주지 못했어요. 잠시 뒤 다시 해 주세요." };
  }
  let parsed;
  try {
    parsed = JSON.parse(data?.choices?.[0]?.message?.content ?? "");
  } catch {
    return { status: 502, error: "AI가 조언을 주지 못했어요. 잠시 뒤 다시 해 주세요." };
  }
  if (!parsed.safe) {
    console.warn("[ai] 조언 모델이 부적절한 그림으로 판단");
    return { status: 400, error: UNSAFE_MESSAGE, plain: true, code: "blocked" };
  }
  const clip = (text, max) => String(text ?? "").replace(/\s+/g, " ").trim().slice(0, max);
  const advice = { praise: clip(parsed.praise, 80), tip: clip(parsed.tip, 100), color: clip(parsed.color, 80) };
  if (!advice.praise || !advice.tip) return { advice: FALLBACK_ADVICE };
  // 3. 조언 글 검사: 이상하면 버리고 기본 문구 (셀은 조언 값으로 이미 냈으므로 기본 문구라도 준다)
  try {
    const bad = await moderate(key, [advice.praise, advice.tip, advice.color].join("\n"));
    if (bad.length) {
      console.warn("[ai] 조언 글 차단:", bad.join(" "));
      return { advice: FALLBACK_ADVICE };
    }
  } catch (err) {
    console.error("[ai] 조언 글 검사 실패:", err.message);
    return { advice: FALLBACK_ADVICE };
  }
  return { advice };
}

aiRoutes.get("/advice", requireUser, walletRoute(adviceCost));

aiRoutes.post("/advice", requireUser, async (req, res) => {
  const image = typeof req.body?.image === "string" ? req.body.image : "";
  if (image.length > MAX_ADVICE_IMAGE || !/^data:image\/(png|jpeg|webp);base64,[A-Za-z0-9+/=]+$/.test(image)) {
    throw new BadRequest("그림을 읽지 못했어요.");
  }
  const title = readText(req.body?.title, 20);
  await paidGeneration(req, res, {
    rateKey: "advice",
    check: (key) => moderateImage(key, image),
    blockedMessage: UNSAFE_MESSAGE,
    cost: adviceCost(),
    run: (key) => askAdvice(key, image, title),
  });
});

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
  const text = (character ? [...CHARACTER_PARTS.map(([key]) => character[key]), character.pose].filter(Boolean).join(" ") : background) || background || "AI 그림";
  const flat = text.replace(/\s+/g, " ").trim();
  return flat.length > 24 ? `${flat.slice(0, 23)}…` : flat;
}

/** 마이룸에 넣은 AI 그림 목록 (최신이 앞, 최대 60장). 연습실에서 화면을 바꾸지 않고 창으로 보여 준다 */
aiRoutes.get("/artworks", requireUser, async (req, res) => {
  let rows = [];
  try {
    ({ rows } = await pool.query(
      `SELECT ai_artwork_id, title, image_key, created_at FROM user_ai_artworks
        WHERE user_id = $1 AND image_key <> '' ORDER BY ai_artwork_id DESC LIMIT 60`,
      [req.userId],
    ));
  } catch (err) {
    // 표가 아직 없으면(마이그레이션 전) 빈 목록
    if (err.code !== "42P01") throw err;
  }
  res.json({
    artworks: rows.map((r) => ({
      drawingId: AI_ARTWORK_BASE + Number(r.ai_artwork_id),
      title: r.title,
      imageKey: r.image_key,
      createdAt: r.created_at,
    })),
  });
});

/**
 * 마이룸에 넣은 AI 그림 지우기. drawingId 는 마이룸 작품 번호 (AI_ARTWORK_BASE + ai_artwork_id).
 * 저장된 방의 액자에 걸려 있으면 지우지 않는다: 지우면 그 방을 다시 저장할 때 "없는 그림" 오류가 나기 때문.
 * 방 저장(PUT /api/myroom)과 같은 사용자 행 잠금을 걸어, 지우는 사이에 그 그림을 건 방이 저장되지 않게 한다.
 */
/** AI 그림 이름 바꾸기 (처음 이름은 쓴 설명의 앞부분이라 알아보기 어려워서). 이름은 1~40자 (DB 제약과 같다) */
const MAX_ARTWORK_TITLE = 40;
aiRoutes.patch("/artworks/:drawingId", requireUser, async (req, res) => {
  const drawingId = Number(req.params.drawingId);
  const aiArtworkId = drawingId - AI_ARTWORK_BASE;
  if (!Number.isSafeInteger(drawingId) || aiArtworkId <= 0) throw new BadRequest("그림 번호가 올바르지 않아요.");
  const title = readText(req.body?.title, MAX_ARTWORK_TITLE, "이름을 적어 주세요.").replace(/\s+/g, " ");
  const { rows } = await pool.query("UPDATE user_ai_artworks SET title = $3 WHERE ai_artwork_id = $1 AND user_id = $2 RETURNING title", [
    aiArtworkId,
    req.userId,
    title,
  ]);
  if (!rows.length) return res.status(404).json({ error: "이미 지워진 그림이에요." });
  res.json({ title: rows[0].title });
});

aiRoutes.delete("/artworks/:drawingId", requireUser, async (req, res) => {
  const drawingId = Number(req.params.drawingId);
  const aiArtworkId = drawingId - AI_ARTWORK_BASE;
  if (!Number.isSafeInteger(drawingId) || aiArtworkId <= 0) throw new BadRequest("지울 그림 번호가 올바르지 않아요.");

  const client = await pool.connect();
  let imageKey;
  try {
    await client.query("BEGIN");
    await client.query("SELECT 1 FROM users WHERE user_id = $1 FOR UPDATE", [req.userId]);
    const room = await client.query("SELECT layout FROM user_myrooms WHERE user_id = $1", [req.userId]);
    const hung = (room.rows[0]?.layout?.objects ?? []).some((o) => o?.artworkDrawingId === drawingId);
    if (hung) {
      await client.query("ROLLBACK");
      return res.status(409).json({ error: "저장된 방의 액자에 걸려 있어요. 액자의 그림을 바꾸고 저장한 뒤 지워 주세요." });
    }
    const { rows } = await client.query("DELETE FROM user_ai_artworks WHERE ai_artwork_id = $1 AND user_id = $2 RETURNING image_key", [
      aiArtworkId,
      req.userId,
    ]);
    await client.query("COMMIT");
    if (!rows.length) return res.status(404).json({ error: "이미 지워진 그림이에요." });
    imageKey = rows[0].image_key;
  } catch (err) {
    await client.query("ROLLBACK").catch(() => {});
    throw err;
  } finally {
    client.release();
  }
  // 파일은 DB 에서 지운 뒤에 지운다 (파일을 못 지워도 목록에서는 사라진다)
  if (imageKey) await removeFile(imageKey).catch((err) => console.error("[ai] AI 그림 파일 삭제 실패:", err.message));
  res.json({ ok: true });
});

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
