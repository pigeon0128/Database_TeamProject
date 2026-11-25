# 학년 마이그레이션 배포와 복구

## 잠금 범위와 실행

024는 기본값 없는 nullable `SMALLINT` 열과 검증된 CHECK를 한 트랜잭션에서 추가한다. 기존 행을 다시 쓰는 작업은 없지만 CHECK 검증은 `users`를 스캔하며, `ACCESS EXCLUSIVE` 잠금이 커밋까지 읽기와 쓰기를 막는다. 025는 일반 VIEW의 정의를 등록하고 순위 결과를 저장하지 않는다. 현재 규모에는 별도의 검증 마이그레이션을 추가할 근거가 부족해 024·025를 그대로 사용한다. [PostgreSQL 18 ALTER TABLE](https://www.postgresql.org/docs/18/sql-altertable.html)

배포 전에 `users` 크기와 오래 열린 트랜잭션을 확인하고, 쓰기·읽기 부하가 낮은 시간에 실행기 한 개만 시작한다. 최초 잠금 대기 상한은 **3초**로 둔다. 서비스의 허용 잠금 대기와 실측에 맞춰 조정할 수 있다. `lock_timeout`은 개별 잠금을 얻기까지의 대기 시간에 적용된다. 잠금을 얻은 뒤 CHECK 스캔에 걸리는 시간은 별도로 평가한다. [PostgreSQL 18 클라이언트 세션 설정](https://www.postgresql.org/docs/18/runtime-config-client.html)

대상 DB 연결이 설정된 리포지터리 루트에서 실행한다. 아래 PowerShell 예시는 실행기 프로세스의 연결에만 설정을 전달하고 기존 셸 환경을 복원한다. 마이그레이션 연결 문자열에 별도의 `options`가 지정되어 있다면 우선순위를 확인하고 `SHOW lock_timeout`으로 실제 설정이 3초인지 확인한다.

```powershell
$savedMigrationOptions = $env:PGOPTIONS
try {
    $env:PGOPTIONS = "$savedMigrationOptions -c lock_timeout=3s".Trim()
    pnpm db:migrate
    if ($LASTEXITCODE -ne 0) { throw "Migration failed ($LASTEXITCODE)" }
} finally {
    $env:PGOPTIONS = $savedMigrationOptions
}
```

POSIX 셸에서는 해당 명령에만 같은 값을 전달한다.

```sh
PGOPTIONS="${PGOPTIONS:+$PGOPTIONS }-c lock_timeout=3s" pnpm db:migrate
```

잠금 대기 시간 초과(`55P03`) 후에는 블로커가 끝났는지 확인한다. 024 본문에서 실패하면 해당 트랜잭션은 롤백되지만, 재시도 전에는 아래 적용 이력과 객체를 확인한다. 스캔 시간이 허용 중단 범위를 넘는 것으로 측정되면 그때 `CHECK ... NOT VALID`와 별도 트랜잭션의 `VALIDATE CONSTRAINT`를 검토한다.

## 중단 후 적용 이력 확인

기존 실행기는 파일의 DDL이 커밋된 뒤 별도 문장으로 `schema_migrations`에 기록한다. 그 사이에 연결이 끊기거나 프로세스가 종료되면 객체만 남고, 실행기를 바로 재시도하면 중복 객체 오류가 발생한다.

1. **대상을 확인한다.** 배포 실행기를 중지하고, 다른 배포가 시작되지 않도록 조율한다. DB 이름·호스트·포트와 배포 대상 커밋을 확인하고 필요한 백업을 확보한다. 같은 PostgreSQL 메이저 버전의 별도 기준 DB에 배포 대상 커밋의 마이그레이션을 정상 적용한다.
2. **기준과 대상의 정의를 비교한다.** 아래 조회를 공통 `search_path`에서 실행한다. 001~023 이력이 예상 목록과 일치하는지 확인한다. 024는 `public.users.grade`의 자료형·NULL·기본값·생성 여부와 CHECK의 정의·검증·강제 여부가 일치해야 한다. 025는 `public.v_grade_leaderboard`가 일반 VIEW이며 옵션, 출력 컬럼 순서·자료형, `pg_get_viewdef`의 **전체 SQL**이 일치해야 한다. 객체 이름이나 순위의 일부 샘플만으로 적용을 판단하면 정의 차이를 놓칠 수 있다.
3. **판정에 맞춰 처리한다.** 이력이 없고 해당 객체가 모두 없으면 앞선 단계와 일치함을 확인한 뒤 정상 실행기로 적용한다. 정의와 이력이 모두 일치하면 완료 상태다. 해당 객체의 정의가 기준과 정확히 일치하고 적용 이력 한 건만 누락됐다면 아래 절차로 이력을 복구한다. 이력은 있는데 객체가 없거나, 024가 부분적으로만 적용됐거나, 정의가 다르거나, 이력이 순서상 비어 있는 상태에서 후속 파일이 이미 기록됐다면 중지하고 별도 복구를 검토한다.

PostgreSQL 18 카탈로그 조회다. `psql -X -v ON_ERROR_STOP=1`로 연결한다. 임시 VIEW는 현재 세션에서만 카탈로그를 읽고, 기준과 대상의 정의를 동일한 형식으로 보여 준다. 기준 DB에서 정상 적용된 정의와 SHA-256을 확보한 뒤 `ROLLBACK`한다. 대상에서는 배포를 중지한 상태에서 이 트랜잭션을 유지한다.

```sql
BEGIN;
SET LOCAL lock_timeout = '3s';
SET LOCAL search_path = pg_catalog;

SELECT current_database(), current_user, current_setting('server_version_num');
SELECT filename FROM public.schema_migrations ORDER BY filename;

CREATE OR REPLACE TEMP VIEW grade_recovery_definitions AS
WITH grade_column AS (
    SELECT format_type(a.atttypid, a.atttypmod) AS data_type,
           a.attnotnull, a.atthasdef, a.attidentity, a.attgenerated,
           pg_get_expr(d.adbin, d.adrelid) AS default_expression
    FROM pg_attribute a
    LEFT JOIN pg_attrdef d ON d.adrelid = a.attrelid AND d.adnum = a.attnum
    WHERE a.attrelid = to_regclass('public.users') AND a.attname = 'grade'
      AND a.attnum > 0 AND NOT a.attisdropped
), grade_check AS (
    SELECT contype, convalidated, conenforced, connoinherit,
           pg_get_constraintdef(oid, false) AS definition
    FROM pg_constraint
    WHERE conrelid = to_regclass('public.users') AND conname = 'chk_users_grade'
), ranking_view AS (
    SELECT relkind, reloptions, pg_get_viewdef(oid, false) AS definition
    FROM pg_class WHERE oid = to_regclass('public.v_grade_leaderboard')
), ranking_columns AS (
    SELECT attnum, attname, format_type(atttypid, atttypmod) AS data_type
    FROM pg_attribute
    WHERE attrelid = to_regclass('public.v_grade_leaderboard')
      AND attnum > 0 AND NOT attisdropped
)
SELECT '024_user_grade.sql' AS filename,
       jsonb_build_object('column', (SELECT to_jsonb(c) FROM grade_column c),
                          'check', (SELECT to_jsonb(c) FROM grade_check c)) AS definition
UNION ALL
SELECT '025_grade_leaderboard_view.sql',
       jsonb_build_object('view', (SELECT to_jsonb(v) FROM ranking_view v),
                          'columns', (SELECT jsonb_agg(c ORDER BY c.attnum) FROM ranking_columns c));

SELECT filename, jsonb_pretty(definition),
       encode(sha256(convert_to(definition::text, 'UTF8')), 'hex') AS signature
FROM pg_temp.grade_recovery_definitions
ORDER BY filename;
```

### 확인된 누락 이력만 기록

대상과 기준 정의를 대조한 뒤 같은 트랜잭션에서 아래를 실행한다. `psql`에서 복구할 **한 파일**을 선택하고 해당 파일의 서명을 **정상 기준 DB**의 결과에서 복사한다. SQL은 현재 대상 정의의 서명 일치, 선행 이력 존재, 해당 파일 및 후행 이력 부재를 모두 확인한다.

```sql
\set filename 024_user_grade.sql
\set reference_signature PASTE_VERIFIED_REFERENCE_SHA256
LOCK TABLE public.schema_migrations IN SHARE ROW EXCLUSIVE MODE;
WITH allowed(filename, predecessor) AS (
    VALUES ('024_user_grade.sql', '023_brush_price_100.sql'),
           ('025_grade_leaderboard_view.sql', '024_user_grade.sql')
)
INSERT INTO public.schema_migrations (filename)
SELECT a.filename
FROM allowed a
JOIN pg_temp.grade_recovery_definitions d ON d.filename = a.filename
WHERE a.filename = :'filename'
  AND encode(sha256(convert_to(d.definition::text, 'UTF8')), 'hex') = :'reference_signature'
  AND EXISTS (SELECT 1 FROM public.schema_migrations m WHERE m.filename = a.predecessor)
  AND NOT EXISTS (SELECT 1 FROM public.schema_migrations m WHERE m.filename >= a.filename)
RETURNING filename, applied_at;
```

의도한 파일 한 행이 반환되면 같은 세션에서 이력을 다시 조회하고 `COMMIT`한다. 입력이 다르거나 0행 또는 오류가 나오면 `ROLLBACK`한다. 025만 복구하는 경우 `\set filename 025_grade_leaderboard_view.sql`을 사용한다. 두 이력을 복구해야 한다면 각 정의를 확인하고 024, 025 순서로 진행한다. 이력의 시각은 실제 DDL 커밋 시각과 다를 수 있으므로 장애 기록에 대조 결과와 복구 시각을 남긴다.

이후 정상 실행기로 남은 파일을 실행하고 `schema_migrations`와 학년 조회를 확인한다. 이 절차의 쓰기는 검증된 누락 이력 등록에 한정된다. VIEW를 비활성화하거나 학년 열을 제거하는 변경은 별도 마이그레이션과 데이터 보존 검토가 필요하다.
