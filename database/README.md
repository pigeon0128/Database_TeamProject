# DOROLAND Story Drawing — Database

## 1. Overview

DOROLAND 스토리 드로잉 콘텐츠의 사용자 정보, 챕터별 원본 그림, 플레이 기록 및 사용자 작품을 관리하기 위한 PostgreSQL 데이터베이스입니다.

### 주요 기능
- 닉네임 기반 사용자 관리
- 챕터 및 원본 그림 관리
- 사용자별 플레이 기록 저장
- 일치율과 소요 시간 기반 리더보드
- 사용자 작품 메타데이터 저장

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

### Relationships

- users (1) → (N) play_records
- chapters (1) → (N) drawings
- drawings (1) → (N) play_records
- play_records (1) → (0..1) user_artworks

## 5. Design Decisions

### Data Normalization
사용자, 콘텐츠, 플레이 기록을 별도 테이블로 분리하여 중복 데이터를 최소화하고 외래키를 통해 참조 무결성을 유지합니다.

### Image Storage
이미지 파일 자체가 아니라 저장소의 파일 경로 또는 객체 키를 데이터베이스에 보관합니다. 실제 이미지 저장소 연동은 별도 구현이 필요합니다.

### Data Integrity
일치율은 0~100 범위로 제한하고, 소요 시간에는 음수가 들어가지 않도록 CHECK 제약조건을 적용합니다.

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

별도의 도감 테이블을 생성하지 않고 기존 테이블 간 JOIN으로 구현합니다.

## 8. Local Setup

1. PostgreSQL 서버를 준비합니다.
2. `doroland_drawing` 데이터베이스를 생성합니다.
3. 해당 DB에서 `migrations/001_initial.sql`을 실행합니다.
4. 개발용 데이터가 필요하면 `seeds/dev_seed.sql`을 실행합니다.
5. `queries/leaderboard.sql`로 리더보드 결과를 확인합니다.
6. `queries/collection.sql`로 도감 조회 결과를 확인합니다.

초기 마이그레이션 및 시드 파일은 빈 개발 DB에서 각각 한 번씩 실행하는 용도입니다.

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
- 사용자 이미지 파일 업로드는 아직 연동하지 않았습니다.
- REST API 및 공용 PostgreSQL 배포는 별도 작업이 필요합니다.
- 외부 이미지 파일 삭제는 DB의 ON DELETE CASCADE만으로 처리되지 않습니다.