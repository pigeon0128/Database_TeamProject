# DOROLAND Story Drawing — Database

## 1. Overview

DOROLAND 스토리 드로잉 콘텐츠의 사용자 정보, 챕터별 원본 그림, 플레이 기록 및 사용자 작품을 관리하기 위한 PostgreSQL 데이터베이스입니다.

### 주요 기능
- 닉네임 기반 사용자 관리
- 챕터 및 원본 그림 관리
- 사용자별 플레이 기록 저장
- 일치율과 소요 시간 기반 리더보드
- 사용자 작품 메타데이터 저장
- 사용자별 그리기 설정 보존 (브러쉬 굵기, 밑그림 보이기·진하기, 손떨림 보정, 선 끝 얇게)
- 그리던 그림 보관 (이어서 그리기)
- 사용자가 완성한 그림을 모아 보는 도감

## 2. Environment

| 항목 | 기술 |
|---|---|
| DBMS | PostgreSQL 18 |
| Development Database | doroland_drawing |
| Management Tool | DBeaver |
| Schema | public |

## 3. Entity Relationship Diagram

![Database ERD](docs/erd.png)

## 4. Database Schema

| 테이블 | 설명 |
|---|---|
| users | 사용자 ID 및 닉네임 |
| chapters | 스토리 챕터 |
| drawings | 챕터별 원본 그림 — 밑그림 이미지의 경로(`reference_image_key`)를 보관하고, 이미지 파일은 앱(`src/assets/<경로>`)에 있음 |
| play_records | 사용자별 그림 플레이 기록 |
| user_artworks | 사용자가 완성한 작품 — 그림 자체(PNG, `image_data`) 또는 다른 저장소의 경로(`image_key`) (`migrations/005_artwork_images.sql`) |
| user_settings | 사용자가 마지막으로 바꾼 그리기 설정과 단축키 (`migrations/003_user_settings.sql`, 단축키 `006_shortcut_settings.sql`) |
| drawing_drafts | 다 그리기 전의 그림(획 목록, JSONB) — 이어서 그리기용 (`migrations/004_drawing_drafts.sql`) |
| creature_profiles | 도감 생물 정보 — 그림(`drawings`) 하나에 분류·한 줄 소개를 붙임 (`migrations/007_creature_profiles.sql`) |
| creature_facts | 도감 정보 항목 (분류, 사는 곳, 먹이 등 이름·내용) |
| creature_tips | 그릴 때 살펴볼 점 |
| schema_migrations | 실행한 마이그레이션 파일 목록 (`pnpm db:migrate` 가 만들고 관리) |

### Relationships

- users (1) → (N) play_records
- chapters (1) → (N) drawings
- drawings (1) → (N) play_records
- play_records (1) → (0..1) user_artworks
- users (1) → (0..1) user_settings
- users (1) → (N) drawing_drafts (그림 하나당 한 행: 키 `(user_id, draft_key)`)
- drawings (1) → (0..1) creature_profiles (1) → (N) creature_facts, creature_tips

## 5. Design Decisions

### Data Normalization
사용자, 콘텐츠, 플레이 기록을 별도 테이블로 분리하여 중복 데이터를 최소화하고 외래키를 통해 참조 무결성을 유지합니다.

### Image Storage
처음에는 이미지 파일을 다른 저장소에 두고 경로(`image_key`)만 보관하는 설계였지만, 따로 파일 저장소를 두지 않도록
`005_artwork_images.sql` 에서 그림 자체를 `image_data`(BYTEA)에 저장하도록 바꿨습니다. 경로만 있는 기존 행도 그대로 쓸 수 있도록
"경로 또는 이미지 중 하나는 있어야 한다"는 CHECK 제약조건을 둡니다.

- 저장하는 그림은 밑그림 없이 사용자가 그린 선만 담은 투명 배경 PNG입니다 (원본 크기, 한 장에 약 60KB). 리더보드에서 밑그림 위에 겹쳐 보여 줍니다.
- 기록(`play_records`)과 그림(`user_artworks`)은 API 서버가 한 트랜잭션으로 함께 넣습니다. 하나가 실패하면 둘 다 저장되지 않습니다.
- 그림은 리더보드에서 그 사람의 최고 기록에 붙은 것을 보여 줍니다 (`GET /api/artworks/:recordId`).
- 밑그림(원본 그림)은 처음 설계대로 경로(`reference_image_key`)만 DB에 두고, 이미지 파일은 앱의 `src/assets/<경로>` 에 둡니다.
  (잠깐 이미지를 DB에 저장했던 `008` 은 지웠고, 그 칸은 `009_remove_drawing_images.sql` 이 정리합니다.)
- 그림이 많아지면 DB 크기가 커지므로, 서비스로 키울 때는 파일 저장소(S3 등)로 옮기고 `image_key` 만 남기는 방식을 다시 검토합니다.

### Data Integrity
일치율은 0~100 범위로 제한하고, 소요 시간에는 음수가 들어가지 않도록 CHECK 제약조건을 적용합니다.

### User Settings
그림을 새로 고를 때마다 설정이 기본값으로 초기화되지 않도록 사용자당 한 행으로 마지막 설정을 저장합니다.
행이 없으면 앱의 기본값(굵기 6, 밑그림 보이기, 진하기 80%, 손떨림 보정 50%, 선 끝 얇게 끔)을 씁니다. 저장은 `ON CONFLICT ... DO UPDATE`(UPSERT)로 처리하고,
값의 범위는 앱의 조절 범위와 같은 CHECK 제약조건으로 제한합니다. 조회·저장 SQL: `queries/user_settings.sql`
앱은 로그인한 사용자의 설정을 API(`GET`/`PUT /api/settings`, `server/routes/settings.js`)로 불러오고 저장하며, 브라우저에는 저장하지 않습니다.
불러오기에 실패한 동안에는 DB에 저장하지 않아서, 기본값이 DB의 설정을 덮어쓰지 않습니다.

단축키(`shortcuts`, `006_shortcut_settings.sql`)는 사용자가 바꾼 동작만 JSONB 객체로 저장합니다 (예: `{"brush": "KeyP"}`).
동작이 몇 개 안 되고 항상 통째로 읽고 쓰므로 표를 따로 나누지 않았습니다. 없는 동작은 앱의 기본 키를 쓰므로, 앱에 동작이 늘어나도 DB를 바꿀 필요가 없습니다.
DB는 JSON 객체인지만 확인하고, 동작 이름과 키 형식은 API 서버가 검사합니다.

### Drawing Drafts
그림을 다 그리기 전에 화면을 나가거나 다른 기기에서 로그인해도 이어서 그릴 수 있도록, 그리던 획 목록을 사용자·그림마다 한 행으로 보관합니다.
획 목록은 구조가 깊은 배열이라 정규화하지 않고 JSONB 한 칸에 저장합니다 (항상 통째로 읽고 쓰며, 내용으로 검색하지 않음).
그림 이름(`draft_key`)은 `story:<장면 id>` 또는 `character` 입니다. 캐릭터 그리기처럼 `drawings` 표에 없는 그림도 있어서 `drawing_id` 대신 씁니다.
완료(기록 저장)하거나 새로 그리기를 고르면 행을 지웁니다. 조회·저장·삭제 SQL: `queries/drawing_drafts.sql`

### Content
앱의 장면 목록(챕터·그림)과 도감 생물 15개(챕터 `생물 도감`, 그림 2~16번)와 그 도감 정보는 `seeds/content.sql` 에 있고, `pnpm db:migrate` 가 매번 넣습니다 (이미 있으면 건너뜀).
앱(`src/data/scenes.ts`)의 `drawingId` 와 번호를 맞추므로 장면을 추가할 때 두 곳을 함께 고칩니다.

## 6. Leaderboard

각 사용자에 대해 그림별 최고 기록 한 건을 선택합니다.

정렬 우선순위:
1. 일치율 내림차순
2. 소요 시간 오름차순
3. 완료 시각 오름차순
4. 기록 ID 오름차순

조회 SQL: `queries/leaderboard.sql`

## 7. Collection

사용자가 완성한 그림을 수집하고 조회하는 도감 기능입니다.

### Collection Rules
- `user_artworks`에 작품이 저장되면 수집 완료로 판단합니다.
- 동일 그림의 여러 완성 작품을 보관할 수 있습니다.
- 대표 작품은 일치율 내림차순, 소요시간 오름차순, 기록 ID 내림차순으로 선정합니다.
- 미수집 그림도 도감 목록에 포함됩니다.

### Queries
`queries/collection.sql`

- 사용자별 도감 전체 조회
- 대표 작품 및 최고 기록 조회
- 챕터별 전체 그림 수와 수집된 그림 수 집계

별도의 수집 테이블을 생성하지 않고 기존 테이블 간 JOIN으로 구현합니다.

### 생물 도감
도감 생물도 그림(`drawings` 한 행)으로 넣어서, 그리기 기록·완성 그림·리더보드·수집 판단을 스토리 장면과 같은 표로 처리합니다.
생물마다 붙는 도감 설명만 `creature_profiles`(분류, 한 줄 소개), `creature_facts`(정보 항목), `creature_tips`(그릴 때 살펴볼 점)에 둡니다.
정보 항목은 생물마다 달라서(동물은 먹이, 무생물은 생기는 곳 등) 칸을 고정하지 않고 (이름, 내용) 행으로 저장합니다.
앱은 `GET /api/collection`(`server/routes/collection.js`, `queries/collection.sql` 3번)으로 도감 정보와 내 수집 현황을 한 번에 받습니다.
생물을 다 그리고 완료하면 `play_records`·`user_artworks` 에 저장되어 수집 완료가 됩니다.

`005_artwork_images.sql` 이후 앱이 저장하는 그림은 `image_data` 에 들어가고 `image_key` 는 비어 있을 수 있습니다.
이때 대표 작품 그림은 그 기록의 ID로 `GET /api/artworks/:recordId` 에서 불러옵니다.

## 8. Local Setup

1. PostgreSQL 서버를 준비하고, 프로젝트 폴더의 `.env` 에 `DATABASE_URL` 을 적습니다 (루트 README 4단계).
2. `pnpm db:migrate` 를 실행합니다. DB가 없으면 만들고, `migrations/` 의 SQL 중 아직 실행하지 않은 것만 번호 순서대로 실행해
   `schema_migrations` 표에 기록한 뒤, 장면 목록(`seeds/content.sql`)을 넣습니다.
3. 개발용 예시 데이터가 필요하면 빈 DB에서 `pnpm db:migrate --seed` 로 실행합니다 (`seeds/dev_seed.sql`).
4. `queries/leaderboard.sql`로 리더보드 결과를 확인합니다.
5. `queries/collection.sql`로 도감 조회 결과를 확인합니다.

새 마이그레이션은 다음 번호(`007_...sql`)로 `migrations/` 에 추가하고, 파일 안에서 `BEGIN; ... COMMIT;` 으로 감쌉니다.
이미 실행한 마이그레이션 파일은 고치지 않습니다 (다른 사람 DB에는 다시 실행되지 않으므로 새 파일로 고칩니다).

## 9. Verification

현재 확인한 항목:
- 5개 테이블 생성
- 테스트 데이터 INSERT 및 SELECT
- 사용자별 최고 기록 선택
- 동점 시 소요 시간 기준 정렬
- 일치율 CHECK 제약조건 위반 차단
- 도감 전체 조회 및 챕터별 수집 현황 쿼리 실행

## 10. Current Limitations

- 닉네임만으로는 사용자 소유권이나 인증을 보장하지 않습니다.
- 공용 PostgreSQL 배포는 별도 작업이 필요합니다.
- `docs/erd.png`에는 아직 `user_settings`, `drawing_drafts` 테이블이 없습니다.
- 외부 이미지 파일 삭제는 DB의 ON DELETE CASCADE만으로 처리되지 않습니다.