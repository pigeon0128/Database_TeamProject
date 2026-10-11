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
| user_artworks | 사용자가 완성한 작품의 저장 경로 |
| user_settings | 사용자가 마지막으로 바꾼 그리기 설정 (`migrations/002_user_settings.sql`) |

### Relationships

- users (1) → (N) play_records
- chapters (1) → (N) drawings
- drawings (1) → (N) play_records
- play_records (1) → (0..1) user_artworks
- users (1) → (0..1) user_settings

## 5. Design Decisions

### Data Normalization
사용자, 콘텐츠, 플레이 기록을 별도 테이블로 분리하여 중복 데이터를 최소화하고 외래키를 통해 참조 무결성을 유지합니다.

### Image Storage
이미지 파일 자체가 아니라 저장소의 파일 경로 또는 객체 키를 데이터베이스에 보관합니다. 실제 이미지 저장소 연동은 별도 구현이 필요합니다.

### Data Integrity
일치율은 0~100 범위로 제한하고, 소요 시간에는 음수가 들어가지 않도록 CHECK 제약조건을 적용합니다.

### User Settings
그림을 새로 고를 때마다 설정이 기본값으로 초기화되지 않도록 사용자당 한 행으로 마지막 설정을 저장합니다.
행이 없으면 앱의 기본값(굵기 6, 밑그림 보이기, 진하기 80%, 손떨림 보정 50%, 선 끝 얇게 끔)을 씁니다. 저장은 `ON CONFLICT ... DO UPDATE`(UPSERT)로 처리하고,
값의 범위는 앱의 조절 범위와 같은 CHECK 제약조건으로 제한합니다. 조회·저장 SQL: `queries/user_settings.sql`

## 6. Leaderboard

각 사용자에 대해 그림별 최고 기록 한 건을 선택합니다.

정렬 우선순위:
1. 일치율 내림차순
2. 소요 시간 오름차순
3. 완료 시각 오름차순
4. 기록 ID 오름차순

조회 SQL: `queries/leaderboard.sql`

## 7. Local Setup

1. PostgreSQL 서버를 준비합니다.
2. `doroland_drawing` 데이터베이스를 생성합니다.
3. 해당 DB에서 `migrations/001_initial.sql`, `migrations/002_user_settings.sql`을 차례로 실행합니다.
4. 개발용 데이터가 필요하면 `seeds/dev_seed.sql`을 실행합니다.
5. `queries/leaderboard.sql`로 리더보드 결과를 확인합니다.

초기 마이그레이션 및 시드 파일은 빈 개발 DB에서 각각 한 번씩 실행하는 용도입니다.

## 8. Verification

현재 확인한 항목:
- 5개 테이블 생성
- 테스트 데이터 INSERT 및 SELECT
- 사용자별 최고 기록 선택
- 동점 시 소요 시간 기준 정렬
- 일치율 CHECK 제약조건 위반 차단

## 9. Current Limitations

- 닉네임만으로는 사용자 소유권이나 인증을 보장하지 않습니다.
- 사용자 이미지 파일 업로드는 아직 연동하지 않았습니다.
- REST API 및 공용 PostgreSQL 배포는 별도 작업이 필요합니다.
  그래서 앱은 지금 그리기 설정을 브라우저(localStorage)에 저장하고, API가 생기면 `src/lib/userSettings.ts`의 저장·불러오기를 `user_settings` 테이블로 바꿉니다.
- `docs/erd.png`에는 아직 `user_settings` 테이블이 없습니다.
- 외부 이미지 파일 삭제는 DB의 ON DELETE CASCADE만으로 처리되지 않습니다.