# DOROLAND 데이터베이스 정규화 검토

기준은 `origin/main`의 `3ba4a30ffbced6d636bdf3af4bf4454cb9d43c6c`(023)이며, 적용 상태는 024·025까지 포함한다. PostgreSQL 18.6에서 마이그레이션을 실제 실행한 뒤 `pg_dump --schema-only --schema=public`로 컬럼, 키, 제약 및 인덱스를 확인했다. 애플리케이션 테이블 15개가 대상이다. 배포 관리 테이블 `schema_migrations`와 파생 VIEW는 별도 항목이다.

## AS-IS · 함수 종속성과 정규형

- `K → 나머지`에서 K는 DDL로 보장되는 최소 후보키 하나다. 대체 후보키는 모두 `UNIQUE`와 `NOT NULL`을 함께 충족한다. FK는 부모의 존재를 보장한다. 부모의 속성에 대한 종속은 자식 릴레이션의 내부 FD와 구별한다.
- 1NF는 애플리케이션이 정의한 값의 단위에서 판단했다. JSONB 전체가 저장·복원 단위인 경우를 포함한다. JSON 내부 요소를 독립적으로 조작하려는 요구는 별도로 평가했다.
- 2NF는 모든 후보키를 기준으로 검사했다. 비주요 속성이 후보키의 진부분집합에 종속되는지 확인하며, 엄격한 판정에는 공집합을 포함한다. 3NF는 비자명 FD에서 결정자가 슈퍼키이거나 우변이 주요 속성이어야 한다. BCNF는 결정자가 슈퍼키여야 한다.
- 기준은 확인된 DDL과 현재 업무 규칙이다. 통계적 추정은 사용하지 않았다. 표에서 `—`는 해당 부분/이행 종속이 확인되지 않았음을 뜻한다. 3NF 및 BCNF 표기는 확인된 FD 집합에 대한 평가다.

| 릴레이션 스키마 | PK / 추가 후보키 / FK | 완전 FD | 부분 FD | 이행 FD | 1NF / 2NF / 3NF / BCNF |
|---|---|---|---|---|---|
| `users(user_id, nickname, created_at, password_hash, cells, grade)` | PK `user_id`, 후보 `nickname` | 각 K → 가입시각·해시·셀·학년 및 다른 K | — | — | 충족 / 충족 / 충족 / 충족 |
| `user_settings(user_id, brush_size, guide_visible, guide_opacity, smoothing, fade, updated_at, shortcuts)` | PK·FK `user_id → users` | `user_id` → 설정 전체·갱신시각 | — | — | 충족 / 충족 / 충족 / 충족 |
| `drawing_drafts(user_id, draft_key, strokes, name, saved_at)` | PK `(user_id, draft_key)`, FK `user_id → users` | 키 쌍 → 획·이름·저장시각 | — | — | 충족 / 충족 / 충족 / 충족 |
| `chapters(chapter_id, title, chapter_order)` | PK `chapter_id`, 후보 `chapter_order` | 각 K → 제목 및 다른 K | — | — | 충족 / 충족 / 충족 / 충족 |
| `drawings(drawing_id, chapter_id, title, reference_image_key, drawing_order)` | PK `drawing_id`, 후보 `(chapter_id, drawing_order)`, FK `chapter_id → chapters` | 각 K → 제목·원본 키 및 다른 K에 속한 컬럼 | — | — | 충족 / 충족 / 충족 / 충족 |
| `play_records(record_id, user_id, drawing_id, similarity_score, duration_ms, played_at)` | PK `record_id`, FK `user_id → users`, `drawing_id → drawings` | `record_id` → 사용자·그림·점수·시간·시각 | — | — | 충족 / 충족 / 충족 / 충족 |
| `user_artworks(artwork_id, record_id, image_key, created_at)` | PK `artwork_id`, 후보·FK `record_id → play_records` | 각 K → 파일 키·생성시각 및 다른 K | — | — | 충족 / 충족 / 충족 / 충족 |
| `creature_profiles(drawing_id, slug, category, summary)` | PK·FK `drawing_id → drawings`, 후보 `slug` | 각 K → 분류·요약 및 다른 K | — | — | 충족 / 충족 / 충족 / 충족 |
| `creature_facts(drawing_id, fact_order, label, content)` | PK `(drawing_id, fact_order)`, FK `drawing_id → creature_profiles` | 키 쌍 → 표시 항목명·내용 | — | — | 충족 / 충족 / 충족 / 충족 |
| `creature_tips(drawing_id, tip_order, content)` | PK `(drawing_id, tip_order)`, FK `drawing_id → creature_profiles` | 키 쌍 → 도움말 | — | — | 충족 / 충족 / 충족 / 충족 |
| `creature_sources(drawing_id, source_order, citation, url)` | PK `(drawing_id, source_order)`, FK `drawing_id → creature_profiles` | 키 쌍 → 출처 표기·URL. 전역 `url → citation`은 별도 정책 가정 | — | 후보 업무 FD 채택 시 `K → url → citation` | 충족 / 충족 / 충족 / 충족. 전역 인용 정책 채택 시 3NF·BCNF 재판정 |
| `special_brushes(brush_id, slug, name, price, brush_order, category)` | PK `brush_id`, 후보 `slug`, `brush_order` | 각 K → 이름·가격·카테고리 및 다른 K | — | — | 충족 / 충족 / 충족 / 충족 |
| `user_brushes(user_id, brush_id, purchased_at)` | PK `(user_id, brush_id)`, FK `user_id → users`, `brush_id → special_brushes` | 키 쌍 → 구매시각 | — | — | 충족 / 충족 / 충족 / 충족 |
| `user_myrooms(user_id, schema_version, revision, layout, updated_at)` | PK·FK `user_id → users` | `user_id` → revision·배치·갱신시각 | `∅ → schema_version` (항상 1) | — | 충족 / 공집합을 포함하는 정의에서 위반 / 위반 / 위반 |
| `user_stored_objects(object_id, user_id, name, source_model, thumbnail, spec, created_at)` | PK `object_id`, FK `user_id → users` | `object_id` → 소유자·이름·모델·썸네일·스펙·생성시각 | — | — | 충족 / 충족 / 충족 / 충족 |

`user_myrooms.schema_version`에는 `∅ → schema_version`이 성립한다. 임의의 두 행은 속성의 공집합에서 항상 일치하고, `NOT NULL`과 `CHECK (schema_version = 1)`가 두 행의 버전을 모두 1로 제한한다. `DEFAULT 1`은 생략한 값을 채운다.

- **2NF**　`∅`는 후보키 `{user_id}`의 진부분집합이다. 비주요 속성 `schema_version`이 여기에 종속되므로 공집합을 포함하는 정의에서 2NF를 위반한다. 공집합을 생략하는 교육용 단축 규칙에서는 단일 열 후보키를 2NF로 분류할 수 있다.
- **3NF**　`∅ → schema_version`은 비자명하다. `∅`는 슈퍼키가 아니고 우변은 비주요 속성이어서 두 허용 조건을 모두 충족하지 못한다.
- **BCNF**　같은 비자명 종속에서 결정자 `∅`가 슈퍼키 조건을 충족하지 못한다.

일반적인 이행 종속은 키에 종속된 별도 속성 집합이 다른 비주요 속성을 결정하는 경우다. 후보키의 부분집합을 제외하는 정의에서 `∅`는 이행 종속의 중간 결정자가 될 수 없다. 이 사례의 위반 근거는 상수 FD 자체다. [Elmasri·Navathe, Fundamentals of Database Systems 7판 §14.2–14.5](https://eecs.csuohio.edu/~sschung/cis430/Fundamentals-of-Database-Systems-Pearson-2015-Ramez-Elmasri-Shamkant-B.-Navathe.pdf)

현행 열은 저장된 배치를 해석하는 버전을 행에 표시한다. 마이룸 API는 버전 1을 검증하고 저장 행의 버전을 응답으로 반환한다. CHECK가 값의 불일치를 막는 동안에는 이 계약과 데이터의 해석 정보를 유지하는 편이 실용적이다. 버전 2 도입 때 방별로 버전이 다른 전환 기간이 필요하면 방별 버전의 의미가 생겨 상수 FD가 사라진다. 서비스 전체가 단일 버전이면 응답에서 버전을 파생할 수 있다. 변경은 버전 정책과 호환성 합의 후 검토한다.

업무 규칙으로 확인하거나 검토할 FD는 다음과 같다.

- 학년으로부터 학교급을 매핑할 수 있다. 예를 들어 `grade = 7 → 중학교`다. 학교급을 `users`에 추가하면 비키 학년을 거치는 이행 종속이 생기므로 조회 쪽에서 매핑한다.
- `play_records(user_id, drawing_id)`는 여러 시도를 허용한다. 같은 사용자·그림·점수·소요 시간·완료 시각도 가능해 `record_id`가 최종 동점 기준이다.
- 보통의 작품 쓰기 경로는 `artworks/{user_id}/{record_id}.png`를 생성한다. `record_id`는 이미 후보키이며 DB는 `image_key`의 유일성과 파일 존재를 보장하는 제약을 두지 않는다. 레거시 경로를 고려하면 경로를 후보키로 가정할 근거가 없다.
- 정보 항목의 `label`은 여러 생물에서 재사용된다. 같은 `먹이`라도 내용은 생물별로 달라진다. 출처 `citation`도 카드의 문맥을 허용한다. 예를 들어 두 카드가 같은 URL을 각각 “성체 서식지”, “유체 서식지”로 인용해도 현재 스키마와 양립한다. 전역 정식 출처명이 필요해지면 아래 대안을 검토한다.
- `special_brushes`의 카테고리는 네 값으로 고정된 분류 코드다. 023의 갱신과 시드는 가격 100을 제공하지만, DDL은 0 이상 가격을 허용한다. 따라서 DDL상 `category → price` 또는 `∅ → price`는 성립하지 않는다. 예컨대 같은 카테고리에 100·150셀을 저장할 수 있다.
- `user_stored_objects.source_model`이 같아도 작업마다 색, 사본 이름, 썸네일이 달라질 수 있다. 원본 모델 코드로 `spec`을 결정할 수 없다.

### 삽입·삭제·갱신 이상과 제약의 경계

아래 표는 정규형 위반에 따른 이상과 의도된 참조·운영 제약을 구별한다.

| 릴레이션 | 삽입 | 삭제 | 갱신 |
|---|---|---|---|
| `users` | 사용자만 독립 등록. 비어 있지 않은 고유 닉네임 필요 | 플레이 기록이 있으면 RESTRICT, 설정·구매·초안·방·수납함은 CASCADE | 닉네임·학년 한 행 갱신. 과거 기록의 등급별 소속은 현재 학년으로 파생 |
| `user_settings` | 사용자 존재 필요, 설정은 선택적 | 설정만 지우면 앱 기본값으로 복귀 | 설정 한 행 UPSERT. 단축키 전체 교체의 동시 편집은 별도 정책 |
| `drawing_drafts` | 사용자 존재와 키 쌍 유일성. 장면 토큰의 존재 검사는 DB FK로 보장되지 않음 | 초안 삭제가 원본 및 계정에 영향을 주지 않음 | 같은 초안의 스냅샷 전체 갱신. 충돌 병합은 API 정책 |
| `chapters` | 그림 없이 생성 가능. 순서는 유일 | 그림이 존재하면 삭제 거부 | 순서 변경 시 유일성 보장, 챕터 제목은 한 행 |
| `drawings` | 챕터 FK, 챕터 내 순서, 비어 있지 않은 원본 파일 키 필요 | 기록은 RESTRICT. 도감 연결은 CASCADE. 초안/배치의 문자열·JSON 참조는 물리 FK 범위 밖 | 원본 파일 키는 한 행에 저장. 시드 번호와 프론트 카탈로그의 동기화는 운영 규칙 |
| `play_records` | 사용자·그림과 점수/시간 범위 필요. 같은 시도 값도 별도 기록으로 허용 | 작품 행 CASCADE. 외부 파일과 배치 참조의 수명주기 별도 | 순위·수집은 조회에서 재계산. 직접 점수 수정 시 API의 작품 교체 정책은 실행되지 않음 |
| `user_artworks` | 기록당 최대 한 행. 사용자·그림마다 저장 작품 최대 한 건은 일반 API 쓰기 경로의 규칙 | 행 삭제로 외부 파일 삭제까지 보장되지는 않음 | 파일 키를 직접 갱신하면 존재 여부/정합성을 따로 확인해야 함 |
| `creature_profiles` | 그림이 있어야 추가. slug 유일 | 정보·팁·출처 CASCADE, 그림과 기록 유지 | 분류·요약 한 행 갱신 |
| `creature_facts` | 프로필 필요. 순서별 한 항목 | 개별 항목 삭제가 프로필에 영향 없음 | 항목별 갱신. 같은 라벨 반복 허용 |
| `creature_tips` | 프로필 필요. 순서별 한 팁 | 개별 팁 삭제가 프로필에 영향 없음 | 팁별 갱신 |
| `creature_sources` | 프로필 필요. 전역 출처 공유 계약이 생기면 같은 URL의 정식 인용문 중복 입력 가능 | 카드별 인용 삭제. 전역 카탈로그 필요 시 마지막 인용이 사라질 때 공용 메타데이터도 소실 | 전역 정식 표기가 필요해지면 여러 카드의 인용문이 어긋날 수 있음 |
| `special_brushes` | 카테고리 CHECK, slug·순서 유일, 가격 범위 | 구매가 있으면 RESTRICT | 가격은 브러시별 한 번 갱신. 과거 구매 금액의 재현은 별도 요구 |
| `user_brushes` | 사용자·브러시 존재, 쌍 유일. 차감과 소유권 기록은 API 트랜잭션에서 묶음 | 소유권 행과 구매시각 제거. 잔액 환급은 업무 정책 | 카테고리·현 가격은 브러시 JOIN 결과를 사용 |
| `user_myrooms` | 방마다 버전 1을 저장. DB 기본값·CHECK가 단일 값을 보장 | 방을 지우면 해당 배치는 함께 사라짐. 마지막 방 제거와 서비스 버전 개념은 별개 | 형식 전환 시 스키마와 방 행의 버전 관리 필요. API는 revision·배치 원자 갱신과 충돌 검사를 수행 |
| `user_stored_objects` | 사용자 필요. 앱은 모델·스펙·썸네일 검증 및 사용자당 상한 적용 | API는 배치 중인 오브젝트 삭제를 막음. 직접 SQL 삭제는 JSON의 내장 참조를 깨뜨릴 수 있음 | 객체 스펙과 썸네일 정합성은 한 행을 쓰는 앱 책임. 모델별 공용 속성의 반복 저장은 확인되지 않음 |

관리 테이블은 `schema_migrations(filename TEXT PK, applied_at TIMESTAMPTZ NOT NULL DEFAULT now())`다. `filename → applied_at`으로 1NF·2NF·3NF·BCNF를 충족한다. 기본키의 인덱스는 동일 파일의 중복 등록을 차단한다. VIEW의 `(drawing_id, user_id)`와 `(drawing_id, grade, grade_ranking)`는 쿼리가 보장하는 논리적 식별자다. `record_id`도 논리적으로 유일하다. VIEW에는 물리 PK/인덱스가 없으며 `user_id → grade, nickname`을 저장 행 복제 없이 JOIN으로 표시한다.

## AS-IS · JSONB와 참조 무결성

| 컬럼 | 읽기·쓰기와 내부 요소 | 중복·무결성 | 분리 비용과 결론 |
|---|---|---|---|
| `user_settings.shortcuts` | `GET/PUT /api/settings`의 작은 설정 맵. 변경된 키 조합만 저장하고 화면에서 기본값과 합친다. 원소별 서버 쓰기·검색 수요는 현재 확인되지 않았다. | JSON 객체 키는 문서에서 한 번 나타난다. DB는 객체 여부, API는 동작 허용 목록과 조합 패턴을 검사한다. 같은 키 조합의 재사용이 금지된다는 계약은 없다. | 별도 `(user_id, action)` 행은 원소별 조회가 필요해질 때 검토. 현재는 쓰기 행 수·조립 비용 증가를 고려해 유지. |
| `drawing_drafts.strokes` | 저장·복원은 순서 있는 획 스냅샷, 목록은 `jsonb_array_length`로 집계한다. 획마다 여러 점을 가진다. | DB는 최상위 배열, API는 각 원소의 점 배열을 확인한다. 같은 좌표가 나타나도 입력 이력이다. 별도 장면 참조 문제는 `draft_key`에 있다. | 획/점마다 행으로 만들면 저장량과 트랜잭션 부담이 늘어날 수 있다. 그리기 이벤트 동기화 요구가 생기기 전에는 문서 단위 유지. |
| `user_myrooms.layout` | 최대 40개 배치의 스냅샷. 방 GET/PUT은 전체를 다룬다. 수납 삭제는 JSON 포함 연산으로 `storedObjectId`를 검사한다. | 앱은 방 내 ID 유일성, 벽/바닥 배치·회전·충돌, 작품과 수납 오브젝트 소유권을 검증한다. DB는 객체·배열·개수만 확인한다. 같은 수납품을 여러 위치에 참조하는 것은 배치의 반복이며 스펙은 수납 테이블에 한 번 저장된다. `artworkDrawingId`는 파일 키를 복제하지 않는다. | 참조 무결성을 DB에서 강화할 필요가 생기면 아래 TO-BE를 검토. 전체 스냅샷과 revision을 그대로 전달해야 Undo/Redo 및 복원이 유지된다. |
| `user_stored_objects.spec` | `GET /storage/:id`로 3D 모델 재구성을 위해 일괄 읽고, 목록에서는 선택하지 않는다. `v/bounds/group/parts`는 색·형상·변환을 담는 스냅샷이다. | `shared/colored.js`가 문서 형식과 리소스 제한을 검사한다. 부위 반복은 객체별 모델 데이터다. DB의 `spec` 제약은 현재 `NOT NULL`이며 내부 참조는 없다. | 부위 검색·독립 수정이나 공용 불변 모델의 식별 규칙이 생기면 분리 비용을 다시 평가. 현 API에서 행 수를 늘리고 문서 조립을 추가할 근거는 부족하다. |

### 80% 완료 정책과 경계값

`server/completion.js`의 `COMPLETE_SCORE = 80`을 기준으로 `GET /api/summary`는 작품 행이 존재하고 점수가 80 이상인 그림을 중복 제거하여 센다. `GET /api/collection`은 작품이 있는 기록 중 대표를 선정한 후 수집 불리언에만 기준을 적용한다. 수정한 독립 SQL 1·3번은 같은 불리언과 대표 메타데이터를 반환하며, 2번은 80 이상인 작품을 그림당 한 번 센다.

현재 임계값은 서버 상수와 `queries/collection.sql`의 세 SELECT에 각각 정의되어 있다. 정책이 바뀌면 두 위치와 경계값 회귀 테스트를 한 변경으로 갱신한다. 독립 조회에 관리되는 호출자가 생기면 그 호출자가 공통 정책값을 각 SQL의 바인딩 매개변수로 전달하는 방식도 검토한다. [반복 검증](../tests/upgrade-and-queries.mjs)

같은 그림에서 이미지 없는 95점 기록과 이미지가 남은 82점 기록이 있으면 기존 API는 82점을 도감 대표로 반환한다. 학년·전체 리더보드는 95점 최고 기록을 반환하며 그 기록의 이미지 키는 `NULL`이다. 마이룸은 실제 파일이 있는 소유 작품을 전시할 수 있고, 80 미만의 작품도 전시 대상이 될 수 있다. 이는 `server/routes/myroom.js`의 기존 전시 규칙이다. 완료 점수는 DB에 소수 둘째 자리로 저장된 값을 기준으로 한다.

### 브러시 카테고리

현재 카테고리와 브러시 사이에 별도 이름·아이콘·정렬·다국어 같은 DB 관리 속성이 없다. 기존 `CHECK`와 구매 교차 테이블을 유지한다. 카테고리별 편집 가능한 속성이나 배포 외 카테고리 추가가 필요해지는 시점에만 `brush_categories(category_code PK, label, display_order, ...)`와 FK를 다시 설계한다. 구매 당시 가격을 감사해야 한다면 현재 가격과 구매 사실을 분리해 구매 시점 가격 또는 원장으로 기록한다. 구매 시점 가격은 `(user_id, brush_id)`에 종속되는 별도 사실이다.

## TO-BE · 마이룸 배치 관계형 설계안

이 설계는 DB 차원의 소유권·참조 제약이 필요할 때 적용할 후보안이다. 상태 문서와 API 변경을 포함한 팀 승인이 필요하다.

| 관계 | 키와 컬럼 | 제약 및 읽기 |
|---|---|---|
| `user_myrooms` | 기존 `user_id` PK/FK, `revision`, `updated_at`. 전환 중 `layout`과 `schema_version` 보존 | 방당 0..40 배치. 서비스 단일 버전 정책을 합의하면 응답의 버전 값은 서비스에서 파생. |
| `user_myroom_placements` | `(user_id, placement_id)` PK. `position_order SMALLINT`, `object_type TEXT`, `x/y/z/rotation/scale DOUBLE PRECISION`, `wall TEXT NULL`, `artwork_drawing_id BIGINT NULL`, `stored_object_id BIGINT NULL` | `UNIQUE(user_id, position_order)`, `CHECK(position_order BETWEEN 1 AND 40)`. 방 FK CASCADE. 타입별 필수값과 허용값 제약. 작품은 그림 존재 FK와 API 소유·파일 확인을 함께 검토. |
| 수납 참조 | `(user_id, stored_object_id) → user_stored_objects(user_id, object_id)` | `user_stored_objects`에 FK 대상 `UNIQUE(user_id, object_id)`가 필요하다. `object_id`가 PK여서 그 조합은 슈퍼키다. NULL은 기본 `MATCH SIMPLE`로 선택적 참여. 사용자 삭제 시 이중 CASCADE와 수납품 직접 삭제 제한을 함께 테스트하고, 트랜잭션 종료 시점의 `NO ACTION`을 우선 검토한다. |

**무손실 재구성.** API로 정상 저장된 v1 방을 한 행의 부모와 배열 원소별 자식으로 모델링한다. 공유 키 `user_id`가 부모 전체를 결정해, 원소가 있는 방은 부모·자식 자연 조인에서 가짜 배치가 생기지 않는다. 빈 방은 부모를 기준으로 `LEFT JOIN`하고 필터링한 `jsonb_agg(... ORDER BY position_order)`를 `[]`로 치환해 복원한다. 좌표는 JS 숫자 범위와 왕복을 검증한다. 선택적 키는 NULL이면 JSON에서 생략하며 `scale`은 저장 API의 정규화된 값을 사용한다. 동등성 기준은 JSONB 값과 배열 순서다. DB에 직접 기록한 비정규 v1 문서에서 임의 키 또는 누락값이 확인되면 원본을 남기고 자동 변환 대상에서 보류한다.

**종속성 보존.** `user_id → revision, updated_at`은 부모에서, `(user_id, placement_id) → position_order, object_type, 좌표, 회전, 크기, 참조` 및 대체키의 FD는 자식에서 보존된다. 상수 `schema_version` 정책은 서비스 계약 또는 실제 방별 버전 컬럼에서 표현한다. 여러 배치 간 충돌, 벽·격자 규칙, 사용자의 실제 전시 작품 여부는 단일 행 FD가 아니며 API 검증을 유지한다. `artworkDrawingId`는 현재 대표를 추적하므로 특정 `record_id`에 FK를 걸면 교체 정책이 달라진다. 그림 삭제를 막을지 배치를 제거할지는 별도 제품 결정이다.

**전환과 복구.**

1. 원본 DB와 이미지 폴더를 함께 백업한다. `jsonb_array_elements(layout->'objects') WITH ORDINALITY`로 백필 후보를 읽는다. 중복 ID, 잘못된 좌표·타입, 잘못된 소유자, 없는 그림·파일, 비정규 문서를 집계하고 원본 방별로 검토한다.
2. `validateLayout`가 반환하는 정규화된 v1 모양을 기준으로 백필한다. 부적합 행에 대해 누락·삭제 없이 별도 보고한다. 정렬된 JSON 왕복·빈 방·revision을 트랜잭션 내 대조한다.
3. 전환 중 기존 GET 모양과 PUT의 `expectedRevision`·`schemaVersion`을 유지한다. 사용자 행 잠금, revision 비교, 전체 충돌 검증, 자식 배치 교체, 부모 revision 1회 증가를 한 트랜잭션으로 처리한다. 저장·수납 삭제가 같은 잠금 순서를 사용하게 한다.
4. 검증 기간에는 같은 트랜잭션에서 JSON과 배치 행을 함께 쓰고 읽기 결과를 대조한다. 플래그로 읽기 전환 후 실패하면 JSON 읽기로 복귀한다. 원본 JSON 저장을 걷어내는 별도 승인 시점까지 복구 사본과 마이그레이션 전후 대조 기록을 유지한다.
5. `server/routes/myroom.js`의 GET/PUT, 수납 삭제 조회 및 `shared/myroom.js`의 유효성 검사를 검증한다. 프론트에서 사용하는 `layout.objects` 순서·ID·필드, revision, 409, Undo/Redo, 격자 스냅, 회전, 충돌, 액자·이젤 교체, 수납 소유권을 기존 테스트 유형으로 대조한다. 배열 순서와 ID가 바뀌면 복원·이력 처리에 영향이 있다.

### 별도 승인 항목과 우선순위

| 개선 후보 | 유형 | 소스/API 영향 및 롤백 |
|---|---|---|
| 마이룸 버전 상수의 저장 제거 또는 방별 버전 정책 | 형식적 정규화·버전 관리 | `user_myrooms` 변경과 `server/routes/myroom.js` 직렬화 검토. v1 필드를 계속 반환하며 별도 전환 승인. 롤백 시 보존 컬럼과 응답 사용. |
| 마이룸 배치 관계 분리 | 참조 무결성·관계형 설계 | 위 계획에 따라 스키마와 API 변경. 기존 배치·수납 동작, Undo/Redo·격자·검증 회귀 확인 필요. |
| 전역 인용 메타데이터 정책 합의 후 출처 분리 | 조건부 정규화 | 예를 들어 `source_catalog(url PK, canonical_citation)`와 `creature_sources(drawing_id, source_order, url FK, context_caption)`. 동일 URL의 인용 정책을 계약으로 삼을 때 URL이 카탈로그를 결정하므로 조인이 무손실이고 두 FD도 보존된다. 기존 문맥 인용은 `context_caption`에 보존한다. 시드와 도감 SQL/API 집계를 조정하고 구 구조를 남겨 읽기 전환을 되돌린다. 현재 분리 보류. |
| 장면 초안 키, 파일 무결성, 구매·잔액 감사 | 참조·운영·제품 범위 | 기존 토큰 및 통화 정책 실사 후 별도 계획. 쓰기 규칙을 바로 강화하면 레거시 행과 정상 저장이 막힐 수 있다. |
| 추가 랭킹 인덱스 | 성능 | 기존 인덱스 사용을 실제 실행계획에서 확인했다. 운영과 유사한 데이터 및 지연 목표로 재평가한다. |

적용한 구조와 쿼리는 [DB README](../README.md), 학년 뷰 계약은 [학년별 리더보드](grade-leaderboard.md), 실행 결과는 [DB 프로젝트 상태](../PROJECT_STATE.md)에 있다.
