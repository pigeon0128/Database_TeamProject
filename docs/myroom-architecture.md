# Babylon.js 마이룸

## 1. 기능과 범위

`#/myroom`에 직접 접속하는 로그인 사용자 전용 3D 전시 공간이다. 기존 홈의 2×2 메뉴는 유지한다. 그림 액자를 벽에 배치하고 내 도감의 완성 그림을 고르며, 의자·책상·나무를 바닥에 배치할 수 있다. 저장 버튼으로 PostgreSQL에 저장하고 재진입/새로고침 시 복원한다.

그림은 **현재 대표 작품을 따라가는 정책 A**를 따른다. 레이아웃에는 `drawingId`만 보관하고 현재 이미지 경로는 기존 `/api/collection`에서 얻는다. 기존 그림판, 브러쉬, 기록 저장·이미지 삭제 정책은 수정하지 않았다. 자체 플레이어와 점프는 15절의 단일 조작 체계로 추가했다. 포털 이동·상점·멀티플레이는 범위 밖이다.

## 2. 코드 구조와 통합 경계

```text
src/features/myroom/
  MyRoomPage.tsx                 페이지, 패널, 명시적 저장/이탈
  MyRoomViewport.tsx             Engine 수명주기와 React 연결
  api.ts / types.ts             feature 전용 REST 계약
  hooks/useMyRoom.ts             로딩, 로컬 수정, revision/충돌/백업
  engine/createScene.ts          카메라, 조명, picking, 미리보기
  engine/room.ts                 방과 독립적인 procedural 나뭇결
  objects/createObject.ts        자체 Mesh, 액자·그림 텍스처
  ui/InventoryPanel.tsx          목록/선택/배치
  ui/ArtworkPicker.tsx           기존 도감 작품 선택
  ui/RoomUI.tsx                  아이콘, 자체 SVG 썸네일, 접근성 모달
  myroom.css                    이 페이지에 한정한 HTML 오버레이
shared/myroom.js / myroom.d.ts   서버·클라이언트 공통 배치 계약
server/routes/myroom.js          기존 세션/pg pool 재사용
database/migrations/019_myroom.sql
tests/myroom*.test.js
```

공통 기능 코드는 `src/App.tsx`의 lazy route, `server/index.js`의 라우터 등록, package/lockfile만 연결했다. README에는 진입/문서 링크를 추가했다. `HomePage.tsx`, `router.ts`, `src/lib/api.ts`, 기존 collection/records/storage/auth 및 그림판 코드는 그대로다. 공유 JS는 서버가 TS 빌드 없이 쓸 수 있게 작성하고 선언 파일로 프런트엔드 타입을 제공한다.

## 3. Scene와 시각 기준

Inspection `DORO-INSPECT-20261027-01` 보고서와 ZIP의 8개 실제 JPG를 모두 직접 확인했다. ZIP 이미지와 개별 파일의 동일성도 검사했다. 구현에서는 이전 제안의 파스텔 방 대신 관찰된 넓은 황갈색 바닥·짙은 세로 나뭇결 벽·높은 시점·비어 있는 초기 방을 우선했다.

방은 24×24, 벽 높이 5인 독립 Mesh로 근사했다. 이 수치는 원본 실제 치수의 측정값이 아니다. 원본 모델/텍스처/번들 코드를 가져오지 않았다. 벽 텍스처는 seed 72의 결정적 선 무늬를 DynamicTexture에 직접 그린 것이며, 가구는 box/cylinder/sphere 조합이다. AI 이미지 생성이나 외부 3D 에셋 다운로드는 사용하지 않았다.

`@babylonjs/core` **9.31.0**을 exact/lockfile에 고정했다. npm의 정식 릴리스이며 2026-10-15 배포본이다. 설치 당시 최신 9.32.1 대신 배포 후 시간이 지난 버전을 선택했다. GLB가 필요 없어 loaders를 추가하지 않았다. Babylon은 Apache-2.0이고 자체 형상·SVG·절차적 무늬에는 별도 외부 에셋 라이선스가 없다.

부드러운 HemisphericLight + DirectionalLight, 가구 그림자를 사용한다. 첫 브라우저 렌더에서 밝은 바닥과 늘어난 나뭇결을 발견해 조명과 wrapU를 수정했다. 모달/HUD도 원본 화면 중심에 맞췄다. 정적 시각 비교는 산출물의 `visual-comparison.html`과 `visual-metrics.json`에 남긴다.

1490×694 화면에서 같은 영역을 JPEG로 비교한 참고값:

| 항목 | DOROBUS | 구현 |
|---|---|---|
| 빈 바닥 패치 중앙 RGB | 208, 144, 80 | 209, 146, 79 |
| 바닥 패치 색 | `#d09050` | `#d1924f` |
| x=500에서 뒤 벽/바닥 경계 y | 134 | 138 |
| 왼쪽 아이콘 바 폭 | 약 56px | 56px |
| 도움말 패널 | x≈56–315 | x=56–316 |
| 인벤토리 모달 외곽 | x=285, y=32, 920×630 | 같은 데스크톱 외곽 기준 |

색 패치와 한 경계의 국소 비교이며 전체 유사도 점수가 아니다. 원본 전체 방의 사방 치수/실제 배치된 액자 비율은 캡처로 확정할 수 없다. 독립 나뭇결은 원본과 무늬·난반사가 다르고, 가구는 단순화된 자체 형상이다. 원본의 장착/재화/채팅/아바타 UI는 구현 범위에 맞춰 제외했다. 명시적인 저장·카메라 초기화·선택 관리·충돌 패널은 요구 기능을 위한 추가 UI다.

## 4. 카메라와 인터랙션

기존 자유 배치 구조의 ArcRotateCamera를 유지하면서 단일 3인칭 조작을 연결했다. 현재 초기값은 alpha −π/2, beta 1.25, 원하는 radius 8.5, 플레이어보다 전방 1.7·높이 0.4의 target이다. 실제 거리는 방 경계와 높이에 맞춰 줄어든다. 줌 요청은 4–18이며 수직 각도는 0.65–1.48이다. pan/키보드 카메라 이동은 끄고, 초기화는 관성값도 지운다. 구체적인 입력/제약은 15절을 따른다.

우클릭 드래그 회전·휠 줌, 5px 미만 좌클릭으로 오브젝트를 선택한다. 액자를 클릭하면 작품 선택, 이후 선택 패널에서 위치 변경·제거·그림 교체를 제공한다. 배치 중에는 플레이어 이동을 멈추고 벽/바닥 picking으로 미리보기를 옮기며 좌클릭 확정, Esc 취소한다. 우클릭/휠은 배치 중에도 사용할 수 있다. 가구 R 회전은 90도 단위다. 액자는 벽 방향으로 정렬하고 회전키를 적용하지 않는다. 별도의 탐색/꾸미기 전환은 없다.

레이아웃 좌표는 0.1 단위 snap, scale 1 고정이다. 액자 bounds와 벽 고정축, inward 회전, 액자 간 겹침을 검사한다. 가구는 회전한 바닥 footprint로 방 경계와 겹침을 검사한다. 서버도 같은 검증 코드를 실행한다.

## 5. UI 상태와 자원 정리

탐색/인벤토리/작품 선택/배치 미리보기를 분리했다. 재배치는 원본을 로컬에 유지한 채 화면에서만 숨기고, 취소 시 원위치를 보인다. 미리보기·그림 교체·선택 변경으로 버려지는 Mesh/Material/Texture를 dispose한다. 비동기 이미지 콜백은 이미 dispose된 root에 적용하지 않는다.

Viewport effect cleanup은 ResizeObserver, DOM/pointer listener, render loop, Scene, Engine을 해제한다. 초기화 실패 시에도 engine을 dispose한다. StrictMode의 setup→cleanup→setup과 오래된 load 응답을 고려했다. lazy page라 홈/그림판에서 Babylon 실행을 시작하지 않는다.

모달은 focus 진입/복원, Tab trap, Esc 닫기, 이름 있는 버튼을 제공한다. 390px 모바일에서는 인벤토리를 약 65vh 아래쪽 패널로 보여 위쪽 3D 화면을 남긴다. 저장 상태를 모바일에서도 표시한다.

## 6. 작품 합성과 갱신 정책

기존 `StoryPage`는 `exportDrawing()`의 투명 PNG를 기록 API에 보낸다. 도감 목록은 `creatureGuide(slug)`를 opacity .3으로 먼저 그리고, 완성 PNG를 그 위에 놓는다. 액자도 같은 순서로 흰 바탕에 합성한다. 각각 contain 비율로 중심 정렬해 투명 배경과 종횡비를 보존한다.

이미지 로딩 중·빈 액자·작품 없음·불러오기 실패 placeholder를 구분한다. 원본 URL은 `artworkUrl(imageKey)`와 앱의 기존 밑그림만 사용한다. 저장 JSON에는 URL/파일 키를 넣지 않는다. collection은 마이룸에 들어오거나 새로고침/다시 불러오기 때 갱신되므로 다른 탭의 새 최고 기록이 즉시 실시간 반영되지는 않는다.

자유 캐릭터 완성본은 기존 기능이 다운로드 중심이므로 이 MVP 선택 목록은 현재 완성한 **도감 작품**으로 한정한다. 영구 스냅샷은 후속 정책이며 기존 기록 파일 보관 로직을 바꾸지 않았다.

## 7. API 명세

모두 기존 세션의 `requireUser`를 거친다. user_id는 body에서 받지 않는다.

```text
GET /api/myroom
  200 { schemaVersion:1, revision, layout:{objects:[]}, updatedAt }
  최초 상태: revision 0, 빈 objects, updatedAt null

PUT /api/myroom
  { schemaVersion:1, expectedRevision, layout:{objects:[...]} }
  200 새 revision과 저장 상태
  400 타입/크기/좌표/겹침/작품 소유권 오류
  401 로그인 필요
  409 다른 화면에서 수정된 revision
```

객체는 `id`, `type(frame/chair/table/plant)`, `position{x,y,z}`, `rotation`, `scale:1`, 액자용 `wall`, 선택적 `artworkDrawingId`다. 최대 40개이며 중복 ID, 허용되지 않은 속성, 비유한/문자 좌표, 잘못된 벽/회전, 임의 모델 URL을 거부한다. body에는 기존 100KB JSON 제한을 적용한다.

PUT은 transaction에서 사용자 행을 잠근다. 기존 records writer와 동일한 잠금 대상이므로 작품 교체와 소유권 확인의 순서를 직렬화한다. 그림이 있는 내 play_records 및 creature_profiles와 대조한 뒤 조건부 UPDATE의 revision으로 동시 저장을 제어한다. 모든 값은 SQL parameter로 바인딩한다.

## 8. 저장·충돌 경험

저장 전에는 미저장 상태, 성공 후 저장 완료를 표시한다. 실패해도 로컬 배치는 남는다. 409 발생 시 저장을 막고 로컬 JSON 다운로드와 서버 저장본 확인을 제공한다. 서버본 불러오기는 명시적인 버튼이고, 이전 로컬 배치를 메모리 백업해 복원 버튼도 제공한다. 백업은 페이지를 벗어나기 전까지 유지되므로 영구 보관은 JSON 다운로드를 사용한다.

내부 나가기 버튼은 미저장 배치 확인 모달을 띄우며, 실제 페이지 새로고침/닫기에는 beforeunload를 연결한다. **브라우저의 hash 뒤로/앞으로 이동까지 차단하는 전역 라우터 개편은 하지 않았다.** 저장하지 않고 해시 주소를 직접 바꾸면 로컬 편집이 사라질 수 있으므로 명시적 저장/나가기 기능을 사용한다.

## 9. DB Schema와 migration

`019_myroom.sql`은 새 `user_myrooms` 테이블만 만든다. 시작 시 가져온 모든 origin 브랜치의 migration 최고 번호가 018인 것을 확인했다. 기존 migration은 변경하지 않았다. 병합 전 새 migration이 생겼으면 팀원과 번호를 조율한다.

```text
user_myrooms
  user_id         BIGINT PK/FK users ON DELETE CASCADE
  schema_version  SMALLINT = 1
  revision        INTEGER >= 0
  layout          JSONB {objects:[...]}, 최대 40개
  updated_at      TIMESTAMPTZ
```

상세 지오메트리/그림 소유권은 API에서 검사한다. JSONB의 drawingId는 관계형 FK가 아니며 읽기 때 실제 collection과 매칭한다. 존재하지 않는 작품은 placeholder로 보이고 저장 시 유효성을 다시 검증한다.

## 10. 실행과 검증 명령

기존 `.env`의 PostgreSQL 접속 설정을 준비하고 실행한다. 비밀 값은 Git에 넣지 않는다.

```sh
pnpm install
pnpm db:migrate
pnpm dev:all
# 표시된 개발 주소 뒤에 /#/myroom 접속
pnpm typecheck
pnpm build
pnpm test:myroom
```

API 통합 테스트는 빈/폐기 가능한 **로컬 테스트 서버**에만 실행한다. 합성 사용자·그림 기록·브러쉬 구매를 생성하므로 평소 사용 DB를 대상으로 실행하지 않는다.

```powershell
$env:MYROOM_TEST_URL='http://127.0.0.1:3317'
pnpm test:myroom:api
```

MYROOM_TEST_URL이 없으면 API 테스트는 skip된다. 외부 hostname은 허용하지 않는다. 현재 저장소에는 별도 ESLint 스크립트가 없으며 `oxfmt`는 포맷 검사다.

## 11. 실제 검증 결과 — 2026-10-27 KST

- 설치/타입/빌드: pnpm install, tsc --noEmit, Vite production build 성공. Babylon feature chunk는 약 821KB/minified, 205KB/gzip이며 500KB 경고가 남는다. 기본 엔트리와 분리되어 있다.
- 테스트: 지오메트리 4건 + PostgreSQL/API 7건(상위 test 포함), **11 pass / 0 fail / 0 skip**. 4개 벽면, 범위/충돌, 인증, 사용자 분리, 다른 사용자 작품, stale/concurrent 저장, 최고 그림 갱신, 기존 도감/그림/기록/리더보드/초안/브러쉬 구매 검증.
- PostgreSQL 18 설치본으로 별도 work 디렉터리의 로컬 포트 55439 인스턴스를 만들어 모든 migration과 019를 적용했다. 기존 서비스/운영 DB/사용자 데이터는 사용하지 않았다.
- 실제 브라우저에서 가입/로그인, 기존 도감 그림판의 획 입력→완료→PNG 기록 저장으로 만든 테스트 작품 2개를 액자에 전시했다. mock collection이나 하드코딩 이미지로 대신하지 않았다.
- 드래그 회전/휠 줌/초기화, 액자 미리보기/Esc 취소/설치/선택/재배치/그림 교체, 복수 액자, 가구 R회전, 겹침 차단, 가구 제거, 저장 후 새로고침 복원을 검증했다.
- 두 브라우저 화면에서 실제 409와 로컬 수정 보존→서버본 확인→로컬 백업 복원을 검증했다. 내부 이탈 확인 모달도 확인했다.
- 홈 복귀 시 Canvas 0개, 기존 홈 메뉴 4개를 확인했다. 반복 이탈·재진입에서 오류가 없었으며 cleanup 코드를 검토했다. GPU 메모리를 별도 프로파일링한 결과는 아니다.
- 1490×694 데스크톱과 390×844 모바일을 확인했다. 모바일 문서 폭은 390px로 가로 overflow가 없었고 인벤토리는 3D 화면 위쪽을 남겼다. 최종 브라우저 error/warn 로그는 비어 있었다.

## 12. 제한 사항

원본과 픽셀 단위 동일성을 보장하지 않는다. 원본 벽의 사진 질감·GLB 가구·아바타/포털은 사용하지 않았으며 별도 자료 없는 치수/표면 디테일은 근사다. 벽/바닥 종류 변경, 크기 변경, 자유 scale, 수직 쌓기, Undo/Redo, 방문·실시간 공유, 스냅샷 보존은 없다. 모바일은 터치 회전/배치가 가능한 구조지만 실제 휴대폰 하드웨어 검증은 하지 않았다.

이미지 로딩 실패/서버 연결 실패 placeholder와 오류 처리는 구현했으나 네트워크 단절·손상 이미지의 모든 조합을 브라우저에서 주입 시험하지 않았다. WebGL 미지원 장치도 하드웨어로 검증하지 않았다.

## 13. 후속 개발과 병합

홈 진입 버튼은 팀 전체 UI 조율 후 별도 PR로 추가한다. 새 가구는 shared catalog/검증/mesh/썸네일을 함께 추가한다. 작품 영구 보존이 필요하면 별도 보존 정책과 relation을 설계하고 기록 파일 삭제와 통합한다. 3D chunk와 저사양 성능을 프로파일링하고 선택 갱신 시 전체 재생성 대신 필요한 오브젝트만 갱신하는 최적화를 고려할 수 있다.

`feature/myroom`을 PR로 리뷰하고 merge는 팀이 결정한다. 기존 main과 공유 파일을 대규모 포맷하지 않으며, 타 기능과의 충돌은 App route/서버 mount/package 및 migration 번호에 한정해 조율한다.

## 14. 개발 Preview — 2026-10-28

`VITE_MYROOM_PREVIEW=true`를 설정하고 Vite 개발 서버를 다시 시작하면 localhost의 루트 또는 `#/myroom`에서 로그인 없이 Mock 작품과 로컬 저장을 시험할 수 있다. Preview 전용 App 분기가 AuthProvider를 마운트하지 않으므로 API 서버/DB 없이 실행되며 인증 API도 요청하지 않는다. 모든 해시 주소는 개발용 마이룸에 머물고 홈/나가기 컨트롤은 숨긴다. 실제 서비스는 기존 인증 래퍼와 이탈 흐름을 유지한다. production build에서는 DEV 조건이 false이므로 활성화할 수 없다. Mock 작품 모듈과 로컬 저장 키가 production JS에 없는지도 검사한다.

Preview는 자체 SVG 샘플 2개와 `doroland:myroom-preview:v1` localStorage 항목만 사용한다. 실제 collection/myroom API와 PostgreSQL 데이터는 사용하지 않는다. 동일한 지오메트리 검증 및 revision 확인으로 잘못된 배치와 순차적인 stale 저장을 방어한다. localStorage의 읽기/쓰기 전체가 여러 탭 사이의 원자적 DB transaction인 것은 아니다. 손상된 저장본은 자동 덮어쓰기하지 않으며 실패 시 기존 편집 상태를 유지한다. 서버 데이터로 가져오거나 자동 동기화하지 않는다.

`pnpm test:myroom:preview`는 Node 22의 type stripping으로 실제 Preview 저장 모듈을 검사한다. 기존 geometry/API 테스트와 함께 실행한다. `myroom-preview-wip.patch`는 사용자가 만든 백업이며 소스 커밋에 포함하지 않는다.

## 15. 단일 공간의 둥근 플레이어와 점프 — 2026-10-28 수정

사용자의 수정 요청에 따라 `0071c6d`를 일반 revert 커밋 `135f9fc`로 되돌렸다. 이 시점의 파일은 기준 `e7ac24d`와 동일했고 Preview/Mock/localStorage/인증 분리는 그대로다. Force push/reset/main 변경은 하지 않았다. 이전 두 모드 UI와 사각 로봇은 복구 대상이며 현재 구현에는 포함하지 않는다.

사용자가 제공한 Desktop `c1.png`, `c2.png`를 직접 열어 주 레퍼런스로 삼았다. 헤드는 자체 cylinder+hemisphere, 몸통은 oval sphere, 가는 팔다리/안테나는 cylinder/sphere로 만들었다. 작은 어두운 원형 눈 2개와 반투명 닉네임 판을 추가하고 전체 크기/카메라 구도를 비교했다. 원본 모델·텍스처·코드는 가져오지 않았으며 AI 이미지 생성도 사용하지 않았다. 원본의 나뭇결/복잡한 표면과 형상의 미세 차이는 남는다.

`player/avatar.ts`는 형상·idle/walk/jump pose·닉네임을, `movement.ts`는 순수 이동/충돌/점프/카메라 경계를, `controller.ts`는 입력·추적·cleanup을 담당한다. 닉네임은 Preview에서 고정 Preview, 실제 세션에서 기존 loginId를 화면에만 표시하며 레이아웃에 저장하지 않는다.

**단일 입력:** WASD/방향키 이동, Space 점프, 우클릭 드래그 orbit, 휠 거리, 좌클릭 선택/배치, I 인벤토리, Esc 배치/패널 취소. 패널·로딩·저장·충돌 해결 중에는 플레이어 입력을 비우고, 배치 중에는 이동/점프만 멈추며 카메라는 유지한다. UI/텍스트 focus와 blur/숨김도 키를 비운다. 별도 모드·자유 scale·배치 계약 변경은 없다.

Babylon 9.31은 허용 pointer 버튼과 실제 movement inputMap을 별도로 관리한다. 기본 우클릭 pan/회전 button 0 매핑을 그대로 두고 pointers.buttons만 2로 바꾸면 회전하지 않는다. 이 문제를 실제 사용자 확인으로 발견했다. `cameraInput.ts`에서 pointer 매핑을 우클릭 rotate 한 개로 명시하고, 컨트롤 재연결 때도 적용한다. 실제 SDK의 onButtonDown/onTouch에서 회전 누적값이 생기고 좌클릭은 회전하지 않는 회귀 테스트를 추가했다. 최종 수정 뒤 사용자가 실제 우클릭 회전 정상 작동을 확인했다.

점프는 초기 수직속도 4.5, 중력 12, analytic 적분 `h += v*dt - .5*g*dt²`와 `v -= g*dt`를 사용한다. delta는 50ms로 제한한다. grounded에서만 반복이 아닌 Space keydown을 소비하므로 공중 재점프/홀드 자동 재점프를 막고, 착지 시 높이/속도를 정확히 0으로 만든다. UI를 공중에서 열면 새 입력은 막되 낙하·착지는 계속된다. 점프 중에도 가구 footprint의 수평 충돌을 유지하며 가구 위 착지/계단은 제공하지 않는다.

플레이어 위치/방향/점프는 런타임 메모리다. RoomLayout, 실제 Express API, PostgreSQL schema, 인증 코드와 Preview 저장 구조는 변경하지 않았다. 기존 보관본은 역사적 결과로 남기고 이번 시각 비교/검증은 `DORO-MYROOM-SINGLE-20261028-01`에 별도 보관한다.

최종 검증은 geometry 4 + Preview 5 + player/점프/실제 SDK 입력 9 + 로컬 PostgreSQL/API 7, 총 25건이다. 타입 검사와 production flag=true 빌드도 실행한다. 화면의 초록색 ROI 계측은 본체 높이가 레퍼런스 약 18.9–20.1%, 구현 약 19%임을 보여 주며 가로 폭도 이를 기준으로 보정했다. 원본 표면/목재 무늬, 그림자 방향, 몸통의 미세한 곡률과 신발 디테일은 다르다. 점프는 가구 위 착지/계단/중력을 이용한 가구 이동을 포함하지 않는다. 모바일 이동 패드, 실휴대폰/GPU 성능은 미검증이다.

## 16. 수납함과 색칠 오브젝트 — 2026-10-29

3D 색칠하기(`Test_3d_coloring`)에서 `저장 → 수납하기`를 누르면 칠한 캐릭터가 사용자의 수납함에 보관되고, 마이룸 인벤토리의 `수납함` 탭에서 꺼내 바닥이나 테이블 위에 놓는다.

- **DB**: `020_stored_objects.sql`의 `user_stored_objects`(사용자당 최대 50개). 모양은 `spec` JSONB, 인벤토리 미리보기는 작은 JPEG data URL.
- **API** (모두 로그인 필요): `GET /api/myroom/storage` 목록(spec 제외), `GET /api/myroom/storage/:id` 모양 포함 조회, `POST /api/myroom/storage` 수납(본문 최대 8MB). 다른 사용자의 오브젝트는 404, 방 저장 때 남의 번호는 400.
- **spec** (`shared/colored.js`가 검증): 허용된 프리미티브(sphere/box/cone/cylinder/torus/roof)와 변환 행렬, 칠한 꼭짓점의 위치+색 샘플(9바이트, base64)만 받는다. 임의 모델·URL은 저장하지 않는다.
- **레이아웃**: 새 종류 `colored` + `storedObjectId`. 바닥(y=0) 또는 테이블 상판(y=`TABLE_TOP`=0.95, 상판 안쪽·다른 물건과 겹치지 않을 때)에 놓는다. 서버는 `onTable` 규칙으로 허공에 뜬 배치를 거부한다. 테이블을 옮기거나 제거하면 그 위의 오브젝트도 함께 옮겨지거나 제거된다.
- **렌더링**: `objects/coloredModel.ts`가 같은 프리미티브를 Babylon `MeshBuilder`로 만들고(박스·지붕만 직접 분할), 정점마다 가장 가까운 색 샘플을 입힌다. three.js(오른손)와 Babylon(왼손) 차이는 맨 바깥 노드의 `scaling.z = -1`로 맞춘다. 정점 색은 spec마다 한 번만 계산해 재사용한다.
- **크기**: `CATALOG.colored`(0.6 × 0.9 × 0.6)에 맞춰 줄이고 바닥면을 y=0에 맞춘다.
- **테스트**: `pnpm test:myroom:colored`.
