# DOROLAND 데이터베이스

PostgreSQL의 `public` 스키마가 사용자, 그림, 플레이 기록, 도감, 상점과 마이룸 상태를 보관한다. 애플리케이션 테이블 15개, 마이그레이션 관리 테이블 1개, 학년별 리더보드 VIEW 1개가 있다. 이 문서와 ERD는 마이그레이션 025까지 적용한 상태를 설명한다.

## 구조와 실행

| 경로 | 내용 |
|---|---|
| `migrations/` | 번호 순으로 적용하는 스키마 및 기존 콘텐츠 갱신 |
| `seeds/content.sql` | 앱의 챕터·장면, 도감 및 49개 브러시 카탈로그. 실행기가 매번 멱등 적용 |
| `seeds/dev_seed.sql` | 개발용 예시. 비어 있는 DB에서 `--seed`로 선택 |
| `queries/` | 전체·학년별 리더보드, 도감, 설정, 초안 조회 예시 |
| `tests/grade_leaderboard.sql` | 학년 제약 및 VIEW의 실 PostgreSQL SQL 테스트 |
| `tests/upgrade-and-queries.mjs` | 023→025 업그레이드, 학년 조회 매개변수 및 도감 SQL/API 통합 테스트 |
| `docs/` | ERD, 적용 설계, 정규화 및 개선 계획 |

PostgreSQL 18과 프로젝트의 Node/pnpm 환경을 준비한다. 리포지터리 루트에서 테스트 DB를 가리키는 `DATABASE_URL`을 설정하고 `pnpm install --frozen-lockfile`, `pnpm db:migrate`를 실행한다. 로컬 .env 설정은 [루트 README](../README.md)를 참고한다. 완성 그림을 쓰는 테스트는 격리된 `UPLOAD_DIR`을 함께 사용한다. 재현 환경과 실행 결과는 [DB 프로젝트 상태](PROJECT_STATE.md)에 있다.

실행기 `scripts/db-migrate.js`는 DB를 준비하고 파일명 정렬 순서로 미적용 SQL을 실행한 뒤 `schema_migrations`에 완료 파일을 기록한다. 각 신규 파일은 `BEGIN … COMMIT`을 사용한다. 새 변경은 다음 번호의 파일로 관리한다.

학년 마이그레이션의 세션 잠금 대기 제한과 중단 복구는 [배포·복구 절차](docs/grade-migration-runbook.md)에 있다.

## 학년·도감 회귀 테스트

리포지터리 루트에서 실행한다. SQL 테스트에는 마이그레이션 025가 적용된 테스트 DB를 지정한다. 테스트 행은 롤백되며 시퀀스는 진행될 수 있다.

```powershell
psql $env:DATABASE_URL -X -v ON_ERROR_STOP=1 -f database/tests/grade_leaderboard.sql
```

통합 테스트에는 DB 생성 권한이 있는 별도 루프백 테스트 클러스터의 `postgres` 연결 URL을 `DOROLAND_TEST_ADMIN_URL`로 설정한다. 테스트가 접두어 `doro_grade_test_`의 새 DB와 임시 업로드 폴더를 만들고, 그 실행에서 생성한 두 자원만 종료 시 정리한다. 테스트 DB에 001–023 SQL과 콘텐츠 시드를 먼저 적용한 다음, 기존 API로 계정과 기록을 만들고 기존 실행기로 024·025를 적용한다.

```powershell
node --test database/tests/upgrade-and-queries.mjs
```

## ERD

![DOROLAND PostgreSQL ERD](docs/erd.png)

[확대용 SVG](docs/db_structure.svg) · [정규화 검토 및 별도 승인 설계안](docs/normalization-review.md)

각 FK는 자식 행에서 부모 1개를 요구한다. 부모의 참여는 모두 선택적이다. 사용자의 설정·방, 그림의 도감 프로필, 기록의 작품은 각각 0..1이다. 그 외 물리 FK는 각각 0..N이다. 사용자와 브러시는 `user_brushes`를 통한 N:M이다. 사용자와 그림은 여러 시도를 허용하는 `play_records`를 통해 연결된다.

## 테이블과 애플리케이션 경로

ERD에 전체 컬럼·타입 및 후보키가 있다. 아래 제약은 PK/FK와 함께 쓰기 경로를 설명한다. 기본키·대체 후보키와 ERD의 모든 물리 FK 컬럼은 `NOT NULL`이다. 애플리케이션 테이블에서 NULL을 허용하는 컬럼은 `users.password_hash`, `users.grade`, `drawing_drafts.name`이다.

| 테이블 | 목적, 주요 제약 및 기본값 | 서버에서 읽거나 쓰는 코드 |
|---|---|---|
| `users` | `BIGINT` ID, 고유·비공백 닉네임, 선택적 해시, 셀 기본 10000·0 이상, 선택적 학년 1~9, 가입 시각 기본 현재 | `routes/auth.js`, `routes/records.js`, `routes/brushes.js`, `routes/summary.js`, `routes/myroom.js` |
| `user_settings` | 사용자당 0..1, 굵기 2~48, 진하기 10~100, 보정·fade 0~100, 단축키 JSON 객체. 기본 6/true/80/50/0/`{}` | `routes/settings.js` |
| `drawing_drafts` | 사용자·비공백 draft_key의 복합 키. 획은 JSON 배열. 이름 선택적 | `routes/drafts.js` |
| `chapters` | 고유하고 양수인 챕터 순서 | `routes/drawings.js`, `routes/collection.js` |
| `drawings` | 챕터 내 양수 순서 유일, 원본 키 비공백 | `routes/drawings.js`, `routes/collection.js`, `routes/myroom.js`, `routes/records.js`(FK) |
| `play_records` | 사용자·그림 FK, 점수 `NUMERIC(5,2)` 0~100, 시간 ms 0 이상, 완료 시각 기본 현재 | `routes/records.js`, `routes/collection.js`, `routes/summary.js`, `routes/myroom.js` |
| `user_artworks` | 기록당 최대 한 행, 비공백 파일 키, 생성 시각 기본 현재 | 위 네 라우트와 `storage.js`, `scripts/db-migrate.js`의 레거시 파일 이전 |
| `creature_profiles` | 그림당 0..1, 고유 slug(소문자·숫자·하이픈), `animal/plant/dinosaur/object` | `routes/collection.js`, `routes/drawings.js`, `routes/summary.js`, `routes/myroom.js` |
| `creature_facts` | 도감별 양수 순서로 라벨·설명 | `routes/collection.js` |
| `creature_tips` | 도감별 양수 순서로 그리기 도움말 | `routes/collection.js` |
| `creature_sources` | 도감별 양수 순서, 주소 접두사 `https://` | `routes/collection.js` |
| `special_brushes` | `SMALLINT` ID, 고유 slug와 양수 표시 순서, 비공백 이름, 비음수 가격, 4개 카테고리 CHECK | `routes/brushes.js` |
| `user_brushes` | 사용자·브러시 복합 키, 구매 시각 기본 현재 | `routes/brushes.js` |
| `user_myrooms` | 사용자당 0..1, 버전 1, revision 0 이상(기본 0), `layout.objects` 배열 최대 40개(기본 빈 배열), 갱신 시각 | `routes/myroom.js`, `shared/myroom.js` |
| `user_stored_objects` | 사용자별 3D 저장물, 이름 길이 1~20, 모델 코드 패턴, 썸네일 최대 80,000자, 스펙 JSONB | `routes/myroom.js`, `routes/summary.js`, `shared/colored.js` |
| `schema_migrations` | 파일명 PK 및 실행 시각, 애플리케이션 스키마와 별도로 관리 | `scripts/db-migrate.js` |

라우트 경로는 `server/`를 기준으로 표시했다. `schema_migrations`는 실행기가 생성한다. 실제 컬럼 선언과 이름 있는 CHECK는 해당 마이그레이션 및 `pg_dump --schema-only --schema=public`으로 확인할 수 있다.

외래키의 `ON DELETE RESTRICT`는 `drawings → chapters`, `play_records → users/drawings`, `user_brushes → special_brushes`다. 나머지 FK는 `ON DELETE CASCADE`다. 원본·완성 이미지 파일, 초안 토큰 및 배치 JSON 내부 참조의 수명주기는 별도로 관리한다.

PK·UNIQUE의 자동 B-tree 외에 아래 세 인덱스가 있다.

| 인덱스 | 컬럼 |
|---|---|
| `idx_play_records_user_date` | `play_records(user_id, played_at DESC)` |
| `idx_play_records_drawing_ranking` | `play_records(drawing_id, similarity_score DESC, duration_ms)` |
| `idx_user_stored_objects_user` | `user_stored_objects(user_id, object_id DESC)` |

## 기존 업무 규칙

- **플레이 기록과 파일**　`POST /api/play-records`는 모든 유효 시도를 저장한다. 현재 최고 시도에 이미지가 첨부된 경우 새 파일을 쓰고 DB 완료 후 이전 이미지 파일을 정리한다. 더 높은 기록을 이미지 없이 저장하면 이전 작품이 남을 수 있다. 원본은 앱의 에셋, 완성 이미지는 `UPLOAD_DIR`의 `artworks/<user_id>/<record_id>.png`다. DB와 업로드 폴더는 한 쌍으로 백업한다.
- **순위**　전체는 `GET /api/leaderboard`와 `queries/leaderboard.sql`의 기존 경로다. 학년은 `queries/grade_leaderboard.sql`로 조회한다. 두 경로의 최고 기록과 정렬 기준은 점수 내림차순, 시간·완료 시각·기록 ID 오름차순이다. [학년별 계약 및 조회 예시](docs/grade-leaderboard.md)
- **도감과 요약**　이미지가 저장된 기록 중 대표를 골라 저장 점수가 80 이상이면 수집 완료로 표시한다. 80 미만도 대표 정보는 반환한다. 독립 SQL은 `queries/collection.sql`에 있으며 전체 장면별·챕터별·도감 생물별 결과를 제공한다. 출처 운영은 [도감 출처](creature-sources.md)를 참고한다.
- **설정·초안**　변경된 단축키만 JSONB에 남긴다. 설정 행이 없으면 앱 기본값을 적용한다. 초안 키는 `story:<장면 토큰>` 또는 `character`이며, API가 전체 획 스냅샷을 저장·복원한다.
- **특수 브러시**　시드의 `pattern` 21개, `glitter` 15개, `cyber` 3개, `tricolor` 10개는 현재 각 100셀이다. `price >= 0`이 DB 범위다. 구매 시 사용자 행 잠금 아래 잔액 차감과 소유권 기록을 함께 처리한다. 과거 결제 단가는 현 스키마에 저장되지 않는다. 클라이언트는 카탈로그 `slug`로 무늬 코드 또는 에셋을 찾는다.
- **마이룸과 3D**　방 상태는 `layout` 스냅샷과 revision을 함께 저장한다. 배치 배열의 `artworkDrawingId`는 저장된 전시 그림의 대표 파일을, `storedObjectId`는 소유한 3D 저장물을 찾는다. 공간·충돌·소유권·동시 저장을 API가 검증한다. [마이룸 문서](../docs/myroom-architecture.md)

## 마이그레이션 이력

| 번호 | 변경 |
|---|---|
| 001 | 사용자, 챕터, 그림, 플레이 기록, 작품 및 순위 인덱스 |
| 002–004 | 인증 해시, 사용자 설정, 초안 |
| 005–007 | 과거 작품/원본 이미지 DB 저장, 단축키, 도감 프로필·정보·팁 |
| 009–010 | 원본 이미지는 앱 에셋, 완성 이미지는 파일 키로 복귀. 010 실행 전 레거시 작품 파일 추출 |
| 011–017 | 도감 출처, 대관람차를 놀이터로 교체, 분류·해바라기·놀이터 문구 |
| 018–020 | 셀과 특수 브러시 구매, 마이룸, 3D 수납 |
| 021–023 | 공룡 도감 카테고리, 브러시 카테고리, 기존 브러시 가격 100셀 반영 |
| 024–025 | NULL 허용 학년 제약, 학년별 리더보드 VIEW |

현행 파일 목록에는 008이 없다. 012의 대관람차 정리와 외부 파일 처리는 기존 실행기에 포함된다. 그림 16번은 콘텐츠 교체로 남겨 둔 공백이고, 후속 장면 ID는 앱의 카탈로그와 맞춘다.
