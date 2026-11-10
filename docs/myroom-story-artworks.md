# 스토리 완성작의 마이룸 전시 (Issue #16, 2-1)

실험 ID: `DORO-MYROOM-STORY-20261031-01` · 검증일: 2026-10-31 KST.
기준 main: `37eb911de60c23ed7727ca0ea1d7636556e2f047`.
작업 브랜치: `feature/myroom-story-artworks`.

## 동작과 범위

액자와 목재 이젤의 기존 작품 선택창에서 도감·스토리 완성작을 함께 고른다. 카드에 종류를 표시하고, 저장 후 새로고침하면 같은 drawing ID의 작품 연결을 복원한다. `creatureGuide`는 `kind === "creature"`인 경우에만 썸네일 및 공통 DynamicTexture에 합성한다. 스토리는 실제 저장된 작품 이미지만 표시한다. 이 실험의 브라우저 그림은 기능 검증용 짧은 획이며 완성된 일러스트를 의미하지 않는다.

벽·바닥 격자 꾸미기, 플레이어·배치·이젤 형상 변경은 포함하지 않는다. 기존 `feature/myroom` 브랜치는 변경하지 않는다.

## API와 데이터 관계

인증이 필요한 `GET /api/myroom/artworks`를 추가했다. 응답 예:

```json
{"artworks":[{"drawingId":1,"name":"숲속의 노래","kind":"story","slug":null,"imageKey":"artworks/<user>/<record>.png"}]}
```

`play_records.user_id = 현재 사용자`인 완료 기록을 `user_artworks.record_id`로 연결해 이미지가 저장된 기록만 후보로 삼는다. `drawings`에서 제목을 읽고 `creature_profiles`를 LEFT JOIN해 `creature`/`story`를 구분한다. 이는 기존 `/api/drawings`의 생물 프로필 유무에 따른 분류를 따른다. 완료는 기존 `POST /api/play-records`로 기록된 상태를 의미하며 별도의 점수 하한을 새로 도입하지 않는다.

대표 작품은 기존 `/api/collection`과 같이 **이미지 행이 있는 기록 중 점수 내림차순 → 소요 시간 오름차순 → 완료 시각 오름차순 → record ID 오름차순**으로 한 개를 선택한다. 작품마다 한 카드이며, 새 대표 기록이 생기면 같은 drawing ID의 전시 이미지도 다음 로딩에서 갱신된다. 이미지 없는 더 높은 점수 기록이 이미지 있는 기존 기록을 가리지 않는 정책도 기존 도감과 같다.

선택한 대표 이미지가 UPLOAD_DIR 안의 0바이트가 아닌 실제 파일인지 확인한다. 파일이 없거나 비어 있으면 목록에서 제외하고 새 저장을 거부한다. 대표 파일이 유실된 경우 하위 기록으로 자동 대체하지 않는다. 파일의 실제 PNG 디코딩 여부를별도로 검사하지는 않으며 기존 업로드 검증을 따른다.

`PUT /api/myroom`도 같은 함수로 작품 자격을 검사한다. 타 사용자만 완료한 ID, 이미지 없는 완료 기록, 존재하지 않는 ID는 400이다. 세션 인증, 사용자 행 잠금, revision 충돌 409, colored 수납품 소유권 검증은 기존 코드 그대로다.

## 하위 호환성과 보존

- `artworkDrawingId`는 기존 **drawing ID** 그대로이며 user_artworks ID로 변경하지 않는다.
- RoomLayout schemaVersion 1, frame/easel 지원 계약, JSONB 구조, expectedRevision은 변경하지 않는다.
- DB 테이블·마이그레이션·기록 저장·도감 API·인증·라우팅은 변경하지 않는다.
- 기존 도감 작품 및 colored의 배치·크기·충돌·수납/소유권 검증을 유지한다.
- Preview는 기존 Mock 2종과 로컬 저장만 사용한다. 새 API 호출은 실제 사용자 경로에서만 한다. Mock에 분류 필드만 추가했다.
- 이전에 저장한 레이아웃은 계속 읽는다. 파일이 사라진 전시 작품은 기존 placeholder로 보이며 레이아웃을 자동 삭제하지 않는다. 유실된 ID를 포함한 새 저장은 400이므로 작품을 교체하거나 연결된 오브젝트를 제거해야 한다.

## 검증과 재현

Node.js 22.9+와 pnpm, 별도 테스트 PostgreSQL(기존 migrations 001~020 적용), 독립 UPLOAD_DIR와 임시 SESSION_SECRET을 사용한다. 운영 DB나 실제 계정은 사용하지 않는다. API는 loopback에만 바인딩한다. `MYROOM_TEST_URL`은 테스트용 API 주소로 지정한다. 예: `http://127.0.0.1:3317`.

```sh
pnpm typecheck
pnpm test:myroom
pnpm test:myroom:preview
pnpm test:myroom:player
pnpm test:myroom:colored
pnpm test:myroom:api
pnpm test:myroom:story
pnpm build
```

API 두 명령은 MYROOM_TEST_URL 없이 실행하면 통합 테스트를 skip하므로 pass로 오인하지 않는다. 실행 전 API의 DATABASE_URL과 UPLOAD_DIR가 별도 테스트 환경인지 확인한다. 테스트가 생성한 임시 사용자·기록·이미지는 그 환경에만 남는다. 파일 검사 단위 테스트는 OS 임시 폴더를 직접 만들고 검증 후 그 폴더만 제거한다. 무작위 테스트 ID/비밀번호는 충돌 방지에만 사용하며 값에 의존하는 기대 결과는 없다.

확인 결과: geometry 6, Preview 6, player 11, colored 12, 기존 API 9, 신규 story/파일 7, **총 51 pass / 0 fail / 0 skip** (부모 테스트 포함). 타입 검사와 production flag=true 빌드 성공. 기존 큰 JS chunk 경고는 남는다.

신규 API 회귀는 인증, 타 사용자 작품 거부, 이미지 없는 완료/없는 ID 거부, 도감 대표 작품과 일치, story frame+easel+creature frame+colored 동시 저장 및 정확한 복원, revision 충돌과 사용자 격리, 점수/시간/동률 대표 이미지 갱신을 검사한다. 기존 geometry/player/colored 테스트가 배치·충돌·점프·수납품 검증을 담당한다.

실제 production 정적 빌드와 테스트 API/DB로 브라우저에서 스토리 따라 그기 완료 → 도감 사자 완료 → 같은 작품 선택창의 두 종류 확인 → 스토리 액자·이젤 + 도감 액자 전시 → 저장 성공 → 새로고침 → 두 스토리 오브젝트의 현재 선택 복원을 확인했다. 썸네일 DOM에서 story guide 0개, creature guide 1개를 확인했다. 경고/오류 콘솔 기록은 0건이었다. 이번 작업에서 실제 우클릭 유지 드래그, 모든 미니게임 완주나 모바일/GPU 성능은 재검증하지 않았으며 해당 소스는 변경하지 않았다.

## 근거와 한계

로컬 근거: 별도 작업 산출물 `outputs/myroom-story-artworks/README.md`, `logs/`, `screenshots/01~06` 및 `picker-dom.json`.
원격 보관 경로: `Research/DOROBUS_MyRoom_Inspection/experiments/DORO-MYROOM-STORY-20261031-01/` (실제 업로드·체크섬 결과는 동기화 receipt를 따른다).

목록 조회와 저장 사이에 파일이 외부에서 제거되는 경쟁은 파일 시스템과 DB가 별개이므로 완전히 원자적으로 막지 않는다. 다음 저장 시 다시 검사하며 렌더러의 기존 로딩 실패 placeholder를 유지한다. 전시 면의 기존 비율/contain 렌더링은 유지하며 스토리별 전용 액자 비율은 이번 범위가 아니다.
