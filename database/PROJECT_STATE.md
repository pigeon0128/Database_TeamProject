# PROJECT_STATE · DOROLAND 데이터베이스

- 실험 ID `DORO-DB-20261126-01`
- 실행일 2026-11-26 KST
- 브랜치 `feature/database` · 시작 `f8387c9514079a6e1eae1ef9bf34a566934924f0` · 기준 `origin/main`의 `3ba4a30ffbced6d636bdf3af4bf4454cb9d43c6c`
- 원격을 가져온 직후 브랜치 전용 커밋 0개, main 전용 커밋 118개를 확인하고 기존 브랜치를 fast-forward했다.

## 완료한 작업과 근거

| 확인 | 관찰 결과 | 재현 근거 |
|---|---|---|
| 신규 DB | 실제 실행기가 24개 SQL 파일(001~025, 008 공백)과 현행 시드를 적용했다. 재실행 시 새 마이그레이션은 0개였다. | `scripts/db-migrate.js`, `migrations/`, `seeds/content.sql`, `schema_migrations` |
| 023 DB 업그레이드 | 023에서 합성 사용자와 85점 기록을 먼저 저장했다. 실행기는 024·025만 실행했다. 계정 학년은 NULL, 이전 기록은 85점 그대로이고 학년 VIEW는 0행이었다. | 기준 커밋의 마이그레이션과 현재 실행기의 적용 내역 |
| 학년·VIEW | 두 경로 모두 통과. 1~9, 범위 위반(0·-1·10·32767), 명시적/생략 NULL, 동점 기준 네 단계, 학년과 그림별 분리, 닉네임·학년 변경, 신규 기록, 선택적 이미지 결합을 검증했다. | [학년 SQL 검증](tests/grade_leaderboard.sql) |
| 스키마·ERD | 15개 앱 테이블·1개 관리 테이블·1개 VIEW, 물리 FK 14개, 비제약 인덱스 3개를 확인했다. 학년은 기본값 없는 nullable SMALLINT였다. | `pg_dump --schema-only --schema=public`, [ERD](docs/db_structure.svg), [DB 구조](README.md) |
| 기존 회귀 | 실제 로컬 API 연결을 사용한 기존 테스트 63개가 통과했다. 실패·건너뜀은 0개. 회원가입/로그인, 작품과 기록, 브러시, 초안, 3D 수납, 마이룸 소유권·복원·revision 경합, Undo/Redo·격자·검증을 포함한다. | 원본 `tests/*.test.js`, 로컬 로그 `doroland-node-tests-final.log` |
| 조회 일관성과 추가 API 확인 | 회원가입·로그인 응답, 설정 UPSERT/GET, 실제 PNG 요청, 도감 SQL 3종과 API, 전체 순위 JSON, 브러시 구매·중복 차감 차단 통과. | 로컬 재현 스크립트 `doroland-regression.mjs`, 로그 `doroland-regression-final.log` |
| 실행계획 | 합성 100,000건에서 기존 그림 순위 인덱스를 사용했다. 첫 윈도우 입력이 검토안 18,000건에서 최종안 2,000건으로 줄었다. 최종 1회 실행 17.488ms. | [VIEW 실행계획 조건](docs/grade-leaderboard.md#실행계획과-배포), 로컬 스크립트 `doroland-explain.mjs`와 로그 `doroland-explain-final.log` |

정규화 판정과 TO-BE는 [정규화 검토](docs/normalization-review.md)에 있다. 마이룸 v1의 고정 버전 상수 종속을 확인했다. 배치 내 참조의 관계화, 버전 필드의 정책 변경 및 API·UI 연동은 후속 팀 승인 범위다.

## 재현 방법과 데이터 출처

PostgreSQL 18.6, Node 22.21.0, pnpm 11.25.0, Windows에서 프로젝트 잠금 파일의 의존성을 사용했다. 입력은 현행 `seeds/content.sql`, SQL 테스트가 생성하는 명시적 테스트 행, 실제 로컬 API에 넣은 합성 계정·1×1 PNG 및 결정적인 조회용 합성 데이터다. 순위 성능 실행에 난수는 사용하지 않았다. 테스트 계정 이름의 충돌을 막는 임의 접미사는 결과 계산에 관여하지 않는다.

- 새 DB에서 `pnpm db:migrate`를 두 번 실행한다. 두 번째 실행에서 신규 적용이 0개인지 확인한다. 업그레이드는 기준 커밋의 파일로 먼저 별도 DB를 023까지 준비한 후 위 표의 사용자·기록을 넣고 현재 작업의 실행기를 호출한다.
- 두 DB 각각에서 `psql -X -v ON_ERROR_STOP=1 -f database/tests/grade_leaderboard.sql`을 실행한다. 기본 접속 설정은 해당 테스트 DB를 가리킨다. 스크립트는 테스트 행을 롤백하며 시퀀스는 진행될 수 있다.
- 테스트 DB와 별도 업로드 폴더, 테스트 세션 비밀 값을 환경으로 제공해 `node server/index.js`를 실행한다. `MYROOM_TEST_URL`에 해당하는 루프백 주소를 지정하고 `node --experimental-strip-types --test 'tests/*.test.js'`를 실행한다.
- 새 계정에 이미지가 있는 79.99·80.00·80.01점 도감 기록, 이미지 없는 96점, 기록 없는 그림, 같은 장면의 이미지 있는 82점과 이미지 없는 95점, 91점 스토리 작품을 준비한다. SQL 3번과 도감 API의 모든 행을 비교한다. SQL 1번의 개별 불리언/대표와 2번 합계 및 요약 API의 완성 4건·도감 3건·스토리 1건을 확인한다. 기준 그림에서 회원 학년을 3으로 바꾸기 전후로 기존 전체 보드의 순위·응답 전체를 비교한다.
- 실행계획은 `ANALYZE` 후 그림 2·학년 3·상위 10명에 실행한다. 합성 데이터는 `generate_series(1,10000)` 사용자, ID순 첫 5개 그림, 그림당 시도 2건을 곱해 만들고 트랜잭션을 롤백한다. 점수는 `(user_id * attempt % 10001) / 100.0`, 시간은 `300 + (user_id * 71 + attempt) % 12000`이다. 시험 DB의 한 그림에는 기존 85점 기록 한 건이 추가로 있다.
- 위 로컬 실행 스크립트와 로그는 작업 사본의 상위 `work/` 디렉터리에 있다. 학년 회귀 테스트, 스키마 및 설계 문서는 Git 작업 사본의 `database/`에 보관한다.

## 한계와 후속 작업

데이터는 격리된 신규·업그레이드용 테스트 DB에서 수집했다. 운영 데이터 규모, 실제 파일 저장소, 클라이언트 실기기로의 학년 노출은 이번 측정 범위 밖이다. 합성 집단의 실행계획은 추가 인덱스 보류 근거로 사용했다. 학년을 설정할 화면이나 API, 학년별 API 응답과 전체 조회의 분기는 별도 연동 작업이다. [연동 가이드](docs/grade-leaderboard.md#추후-api와-프론트엔드-연동)

검토 산출물은 로컬 `feature/database`에 보관한다.
