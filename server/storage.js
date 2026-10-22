// 완성 그림 파일 저장소 (서버 폴더). DB에는 이 폴더 안의 경로(user_artworks.image_key)만 저장한다
// (database/migrations/001_initial.sql 의 원래 설계). 폴더는 .env 의 UPLOAD_DIR, 없으면 프로젝트의 uploads/.
// 서버(routes/records.js)와 pnpm db:migrate(예전에 DB에 넣었던 그림을 파일로 옮길 때)가 같이 쓴다.
import { mkdir, rm, writeFile } from "node:fs/promises";
import { dirname, join, resolve, sep } from "node:path";
import { fileURLToPath } from "node:url";

const projectRoot = join(dirname(fileURLToPath(import.meta.url)), "..");

/** 그림 파일을 두는 폴더 (절대 경로). 브라우저에는 /uploads/<image_key> 로 열린다 */
export const UPLOAD_DIR = resolve(process.env.UPLOAD_DIR || join(projectRoot, "uploads"));

/** 기록 하나의 완성 그림 경로: artworks/<사용자 번호>/<기록 번호>.png (기록마다 하나라 겹치지 않는다) */
export const artworkKey = (userId, recordId) => `artworks/${userId}/${recordId}.png`;

/** 경로를 폴더 안의 실제 파일 위치로. 폴더 밖을 가리키는 경로(../ 등)는 거부한다 */
function fileFor(key) {
  const file = resolve(UPLOAD_DIR, key);
  if (!file.startsWith(UPLOAD_DIR + sep)) throw new Error(`잘못된 그림 경로: ${key}`);
  return file;
}

export async function saveFile(key, bytes) {
  const file = fileFor(key);
  await mkdir(dirname(file), { recursive: true });
  await writeFile(file, bytes);
}

/** 파일이 없어도 오류로 보지 않는다 (이미 지워졌거나, 예시 데이터처럼 처음부터 파일이 없는 경로) */
export async function removeFile(key) {
  try {
    await rm(fileFor(key), { force: true });
  } catch (err) {
    console.warn(`[storage] 그림 파일을 지우지 못했어요 (${key}): ${err.message}`);
  }
}
