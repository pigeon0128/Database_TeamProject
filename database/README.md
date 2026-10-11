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
| drawings | 챕터별 원본 그림 |
| play_records | 사용자별 그림 플레이 기록 |
| user_artworks | 사용자가 완성한 작품 — 그림 자체(PNG, `image_data`) 또는 다른 저장소의 경로(`image_key`) (`migrations/005_artwork_images.sql`) |
| user_settings | 사용자가 마지막으로 바꾼 그리기 설정 (`migrations/003_user_settings.sql`) |
| drawing_drafts | 다 그리기 전의 그림(획 목록, JSONB) — 이어서 그리기용 (`migrations/004_drawing_drafts.sql`) |
| schema_migrations | 실행한 마이그레이션 파일 목록 (`pnpm db:migrate` 가 만들고 관리) |

### Relationships

- users (1) → (N) play_records
- chapters (1) → (N) drawings
- drawings (1) → (N) play_records
- play_records (1) → (0..1) user_artworks
- users (1) → (0..1) user_settings
- users (1) → (N) drawing_drafts (그림 하나당 한 행: 키 `(user_id, draft_key)`)

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
- 그림이 많아지면 DB 크기가 커지므로, 서비스로 키울 때는 파일 저장소(S3 등)로 옮기고 `image_key` 만 남기는 방식을 다시 검토합니다.

### Data Integrity
일치율은 0~100 범위로 제한하고, 소요 시간에는 음수가 들어가지 않도록 CHECK 제약조건을 적용합니다.

### User Settings
그림을 새로 고를 때마다 설정이 기본값으로 초기화되지 않도록 사용자당 한 행으로 마지막 설정을 저장합니다.
행이 없으면 앱의 기본값(굵기 6, 밑그림 보이기, 진하기 80%, 손떨림 보정 50%, 선 끝 얇게 끔)을 씁니다. 저장은 `ON CONFLICT ... DO UPDATE`(UPSERT)로 처리하고,
값의 범위는 앱의 조절 범위와 같은 CHECK 제약조건으로 제한합니다. 조회·저장 SQL: `queries/user_settings.sql`
앱은 로그인한 사용자의 설정을 API(`GET`/`PUT /api/settings`, `server/index.js`)로 불러오고 저장하며, 브라우저에는 저장하지 않습니다.
불러오기에 실패한 동안에는 DB에 저장하지 않아서, 기본값이 DB의 설정을 덮어쓰지 않습니다.

### Drawing Drafts
그림을 다 그리기 전에 화면을 나가거나 다른 기기에서 로그인해도 이어서 그릴 수 있도록, 그리던 획 목록을 사용자·그림마다 한 행으로 보관합니다.
획 목록은 구조가 깊은 배열이라 정규화하지 않고 JSONB 한 칸에 저장합니다 (항상 통째로 읽고 쓰며, 내용으로 검색하지 않음).
그림 이름(`draft_key`)은 `story:<장면 id>` 또는 `character` 입니다. 캐릭터 그리기처럼 `drawings` 표에 없는 그림도 있어서 `drawing_id` 대신 씁니다.
완료(기록 저장)하거나 새로 그리기를 고르면 행을 지웁니다. 조회·저장·삭제 SQL: `queries/drawing_drafts.sql`

### Content
앱의 장면 목록(챕터·그림)은 `seeds/content.sql` 에 있고, `pnpm db:migrate` 가 매번 넣습니다 (이미 있으면 건너뜀).
앱(`src/data/scenes.ts`)의 `drawingId` 와 번호를 맞추므로 장면을 추가할 때 두 곳을 함께 고칩니다.

## 6. Leaderboard

각 사용자에 대해 그림별 최고 기록 한 건을 선택합니다.

정렬 우선순위:
1. 일치율 내림차순
2. 소요 시간 오름차순
3. 완료 시각 오름차순
4. 기록 ID 오름차순

조회 SQL: `queries/leaderboard.sql`

## 7. Local Setup

1. PostgreSQL 서버를 준비하고, 프로젝트 폴더의 `.env` 에 `DATABASE_URL` 을 적습니다 (루트 README 4단계).
2. `pnpm db:migrate` 를 실행합니다. DB가 없으면 만들고, `migrations/` 의 SQL 중 아직 실행하지 않은 것만 번호 순서대로 실행해
   `schema_migrations` 표에 기록한 뒤, 장면 목록(`seeds/content.sql`)을 넣습니다.
3. 개발용 예시 데이터가 필요하면 빈 DB에서 `pnpm db:migrate --seed` 로 실행합니다 (`seeds/dev_seed.sql`).
4. `queries/leaderboard.sql`로 리더보드 결과를 확인합니다.

새 마이그레이션은 다음 번호(`005_...sql`)로 `migrations/` 에 추가하고, 파일 안에서 `BEGIN; ... COMMIT;` 으로 감쌉니다.
이미 실행한 마이그레이션 파일은 고치지 않습니다 (다른 사람 DB에는 다시 실행되지 않으므로 새 파일로 고칩니다).

## 8. Verification

현재 확인한 항목:
- 5개 테이블 생성
- 테스트 데이터 INSERT 및 SELECT
- 사용자별 최고 기록 선택
- 동점 시 소요 시간 기준 정렬
- 일치율 CHECK 제약조건 위반 차단

## 9. Current Limitations

- 닉네임만으로는 사용자 소유권이나 인증을 보장하지 않습니다.
- 공용 PostgreSQL 배포는 별도 작업이 필요합니다.
- `docs/erd.png`에는 아직 `user_settings`, `drawing_drafts` 테이블이 없습니다.
- 외부 이미지 파일 삭제는 DB의 ON DELETE CASCADE만으로 처리되지 않습니다.