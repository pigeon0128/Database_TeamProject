# 학년별 리더보드 설계와 연동

## 적용된 DB 계약

`024_user_grade.sql`은 `users.grade SMALLINT NULL`과 `chk_users_grade CHECK (grade BETWEEN 1 AND 9)`를 추가한다. 기본값은 없다. 1~6은 초등학교 해당 학년, 7~9는 중학교 1~3학년이다. 0은 조회 UI의 전체 옵션이다. 기존 계정 및 기존 등록 API로 생성한 계정은 학년 미설정(`NULL`)이다.

`025_grade_leaderboard_view.sql`의 `v_grade_leaderboard`는 다음을 수행한다.

1. 학년 설정 사용자의 모든 플레이를 현재 `users` 행과 결합해 사용자·그림별 최고 기록을 고른다. 첫 윈도우의 `grade`는 사용자에게 종속되며 그룹 경계를 바꾸지 않는다. 학년으로 조회할 때 필터를 앞단으로 내릴 수 있게 한다.
2. 그림·학년별로 `ROW_NUMBER()`를 매긴다. 두 단계 모두 `similarity_score DESC, duration_ms ASC, played_at ASC, record_id ASC` 순이다. 같은 점수라도 순위는 1부터 연속된다.
3. 선택된 기록의 `user_artworks`를 `LEFT JOIN`한다. 해당 기록에 저장된 작품이 없으면 `image_key`는 NULL이다. 작품 존재나 80% 수집 기준은 리더보드 자격에 영향을 주지 않는다.

VIEW의 컬럼은 `record_id BIGINT`, `user_id BIGINT`, `drawing_id BIGINT`, `grade SMALLINT`, `nickname VARCHAR(50)`, `similarity_score NUMERIC(5,2)`, `duration_ms INTEGER`, `played_at TIMESTAMPTZ`, `image_key TEXT`, `grade_ranking BIGINT` 순이다. 학년과 닉네임은 현재 사용자 행을 표시한다. 학년을 바꾸면 기존 플레이가 새 학년 순위에 반영되고, 학년을 지우면 학년별 순위에서 빠진다. 기존 전체 리더보드는 학년과 무관하게 같은 기록을 반환한다.

## 조회 예시

그림 ID 2의 초등학교 3학년 상위 10명이다. 조회 SQL은 순서가 필요한 호출자를 위해 `ORDER BY`를 지정한다.

```sql
SELECT record_id, user_id, drawing_id, grade, nickname,
       similarity_score, duration_ms, played_at, image_key, grade_ranking
FROM v_grade_leaderboard
WHERE drawing_id = 2 AND grade = 3
ORDER BY grade_ranking
LIMIT 10;
```

[`queries/grade_leaderboard.sql`](../queries/grade_leaderboard.sql)은 같은 조회의 매개변수 버전이다. `$1`은 그림 ID, `$2`는 학년, `$3`은 결과 상한이다. PostgreSQL이 `$2`를 `SMALLINT`로 추론한다. 그림 ID 또는 학년이 NULL이거나 일치하는 학년이 없으면 빈 결과가 반환된다. 학년 0을 처리하는 호출자는 기존 전체 조회 경로로 분기한다.

상한은 NULL이면 10, 50을 넘기면 50이다. 명시적 0이면 빈 결과를 반환하고 음수는 PostgreSQL이 거부한다. 이 계약은 독립 학년 조회에 적용된다.

## 실행계획과 배포

PostgreSQL 18.6의 별도 테스트 DB에서 10,000명, 그림 5개, 사용자·그림별 시도 2건으로 합성 기록 100,000건을 생성했다. 학년은 사용자 번호를 10으로 나눈 나머지 1~9로 정하고 나머지 0은 NULL로 두었다. 그림 2, 학년 3, 상위 10명을 `EXPLAIN (ANALYZE, BUFFERS)`로 조회했다. 기존 `idx_play_records_drawing_ranking`이 그림의 약 20,001개 기록을 골랐고 학년 조인 뒤 2,000건이 첫 윈도우에 들어갔다. 이 필터를 앞단으로 밀기 전 검토안의 첫 윈도우 입력은 18,000건이었다. 최종 계획의 1회 실행 시간은 17.488ms이며 운영 성능을 추정할 근거로 사용하기에는 데이터 분포와 캐시 조건이 제한적이다. 유사 인덱스를 추가하지 않았다.

독립 검수에서는 합성 사용자 20,000명의 기록 520,000건 중 500,000건을 인기 그림 한 곳에 집중시켰다. 소수 학년은 300명, 다수 학년은 19,700명이었다. PostgreSQL 18.6, `work_mem=4MB`, `shared_buffers=32MB`에서 각 조건의 상위 10명을 조회했다.

| 조회 조건 | 로컬 단일 실행 | 계획에서 관찰한 내용 |
|---|---:|---|
| 일반 그림 20,000건 · 소수 학년 | 약 10ms | 기존 그림별 인덱스, 첫 윈도우 입력 300건 |
| 인기 그림 500,000건 · 소수 학년 | 약 119ms | 플레이 기록 병렬 순차 스캔, 첫 윈도우 입력 7,500건 |
| 인기 그림 500,000건 · 다수 학년 | 약 545ms | 사용자별 기록 인덱스 스캔, 첫 윈도우 입력 492,500건 |

합성 데이터의 1회 실행값은 운영 지연 예측이나 서비스 목표가 아니다. 학년 필터는 첫 윈도우에 들어가는 행을 줄이지만, 상위 10명에 대한 최종 LIMIT 앞에서 최고 시도 선정과 학년 순위를 계산한다.

API 연동 전에는 실제 그림별 기록 수·사용자별 재시도 수·학년 분포를 반영한 데이터로 상위 조회와 내 순위 조회를 따로 검증한다. 캐시 상태와 동시 요청 수를 나눠 p50/p95, 읽은 버퍼, 임시 파일 사용, CPU와 쓰기 지연을 측정하고 팀이 정한 API 지연·DB 부하 예산과 비교한다. 예산을 넘기는 경우에만 `(drawing_id, user_id, similarity_score DESC, duration_ms, played_at, record_id)` 순서의 후보 인덱스, 학년 선택도에 따른 사용자별 최고 1건 탐색, 기존 인덱스의 중복 및 갱신 비용을 함께 비교한다. 결과의 즉시성이 필요한 현재 계약에서는 캐시나 별도 순위 저장을 검토할 때 학년·기록 변경 후 반영 지연과 무효화 비용도 측정한다. 현재 적용 구조는 일반 VIEW와 기존 인덱스다.

024·025는 기존 실행기로 적용한다. 잠금 대기 상한과 장애 시 이력 복구는 [배포·복구 절차](grade-migration-runbook.md)를 따른다.

## 추후 API와 프론트엔드 연동

팀 승인 후의 작업 순서다.

1. **학년 저장**　동의된 프로필/관리 절차에서 현재 로그인한 사용자의 학년을 지정한다. 요청 값은 정수 1~9와 미설정 NULL로 검증하고 기존 회원가입 계약과 보존 정책을 협의한다. 권한은 서버 세션의 사용자 ID로 결정한다.
2. **API 분기**　`server/routes/records.js`에서 누락 또는 0은 기존 전체 순위를 사용한다. 1~9는 VIEW에서 같은 그림·학년을 필터링한다. 응답을 기존 `{ top, me }`와 맞추려면 아래 예처럼 상위 N명 또는 세션 사용자 자신의 행을 반환한다. 나는 해당 학년의 순위가 없으면 `null`이다. 상한·그림 ID는 기존 범위와 서버 정수 검증을 적용한다. JS 숫자 변환은 기존 계약과 실제 `BIGINT` 범위를 확인한다.
3. **UI 연동**　`src/lib/api.ts`와 `src/pages/LeaderboardPage.tsx`의 학년 쿼리 매개변수, 목록(현재 0~6), 학년 라벨, 학년 변경 때 재조회, 로딩·빈 결과, 내 순위를 구현한다. 7~9는 중학교 1~3학년으로 표기한다. 공개 순위에서 사용자 학년을 어떻게 노출할지 팀이 확인한 뒤 기존 준비 중 화면을 전환한다.

```sql
-- $4는 세션의 사용자 ID 또는 NULL
SELECT *
FROM v_grade_leaderboard
WHERE drawing_id = $1 AND grade = $2
  AND (grade_ranking <= $3 OR user_id = $4)
ORDER BY grade_ranking;
```

학년 변경, 학년 미설정, 미인증, 전체(0), 두 그림과 두 학년의 독립 순위, 작품 없는 최고 기록, 상위 N위 밖 내 순위를 회귀 케이스로 사용한다. DB SQL 테스트와 이번 실행 결과는 [DB 프로젝트 상태](../PROJECT_STATE.md)에 있다.
