# 마이룸 Undo/Redo와 배치 가이드 격자

검증일: 2026-11-11 KST(클라이언트 날짜). 실험 ID: `DORO-MYROOM-HISTORY-GRID-20261111-01`.
브랜치 `feature/myroom`, 기존 HEAD `aa33d59`, 통합 기준 `origin/main c55435a`.
개발·검증 당시 main을 `git merge --no-commit --no-ff origin/main`으로 반영했으며 충돌은 없었다. 이후 사용자 커밋 승인에 따라 기존 main→feature 병합은 `dc68c44`로 별도 기록하고 기능 변경을 분리한다. 기존 미추적 `myroom-preview-wip.patch`와 별도 사본을 보존하며, main 브랜치 변경이나 Push는 수행하지 않는다.

## 이력 계약

`hooks/layoutHistory.ts`의 순수 reducer가 `present / past / future / baseline / group`을 관리한다. 기존 useMyRoom의 setLayout 인터페이스를 그대로 사용하므로 설치·이동·회전·크기·삭제·액자/이젤 작품 변경이 같은 경로로 기록된다. updater 내부에서 외부 배열이나 ref를 변경하지 않는다. React StrictMode 재평가에도 이력이 중복 추가되지 않는다.

- 이전 상태는 최대 50개다. 새 실제 편집은 Redo를 비운다.
- 객체 순서와 생략된 기본 scale=1은 같은 배치로 취급한다. 의미 있는 필드를 비교해 no-op은 기록하지 않는다.
- 테이블 및 상판 오브젝트 변환은 기존 로직을 placeLayoutObject로 옮겨 하나의 layout update로 처리한다.
- 크기 슬라이더는 pointer down/up/cancel/blur 또는 범위 조절 key down/up으로 묶는다. 시작 크기로 돌아온 제스처는 빈 Undo 단계를 남기지 않는다. 보조 기술 등 제스처 시작 이벤트가 없는 단일 change는 각각 한 단계다.
- Ctrl+Z / Ctrl+Shift+Z / Ctrl+Y와 왼쪽 사이드바 버튼을 지원한다. 입력 필드, contenteditable, 모달, 배치 프리뷰 및 로딩/저장 중에는 전역 이력 이동을 막는다.
- 이력 이동, 원격 배치 수락, 백업 복원 시 선택·배치 프리뷰를 비운다. 카메라·플레이어 위치·격자·수납함 영구 삭제는 이력에 포함하지 않는다. 이력은 런타임 메모리에만 있고 새로고침하면 초기화된다.

## 저장·충돌·나가기

기존 dirty/baseline 개념과 beforeunload 및 나가기 모달을 재사용한다. baseline은 객체 순서에 영향을 받지 않는 layoutKey 문자열이다. 저장 성공은 요청 시작 시 잡은 snapshot만 기준으로 삼고 이력을 유지한다. 따라서 Undo로 저장 상태에 돌아오면 clean, 저장 후 과거로 Undo하면 dirty다. 저장 중 별도 편집이 발생해도 현재 layout을 snapshot으로 덮어쓰지 않는다.

409 실패는 conflict/error 상태만 바꾸며 이력을 폐기하지 않는다. 사용자가 원격 상태를 명시적으로 수락하면 현재 배치를 backup에 보존하고 원격 layout/revision을 새 기준으로 삼아 이력을 초기화한다. backup 복원은 그 기준에 대한 한 번의 편집이므로 다시 Undo하면 원격 기준으로 돌아간다. 기존 JSON 다운로드와 서버 revision/소유권 검증은 그대로다.

`hooks/hashExitGuard.ts`는 미저장 해시 이동 시 현재 URL을 복원하고 기존 나가기 모달에 목적지를 전달한다. 실제 브라우저에서 hashchange 리스너 순서만으로는 라우터 전환을 막지 못하는 실패를 발견해, router.ts의 usePath가 경로를 게시하기 전에 등록된 guard를 확인하도록 최소 연결을 추가했다. 마이룸이 언마운트되면 guard를 해제한다. 깨끗한 상태의 이동과 다른 페이지 라우팅은 그대로다. 경고에서 계속 꾸미기는 방을 유지하고, 저장하지 않고 나가기는 요청한 목적지로 이동한다.

이 방식은 취소한 이동의 URL을 replaceState로 복원한다. 브라우저 히스토리의 원래 인덱스까지 재구성하지 않아 같은 마이룸 URL 항목이 연속될 수 있다. 편집 데이터 보호를 우선하며, 히스토리 인덱스의 정밀 복원은 후속 개선이다. 새로고침/문서 이탈은 기존 native beforeunload에 의존하며 브라우저의 경고 정책을 따른다.

## 격자

`engine/placementGrid.ts`가 장면 생성 시 바닥 LinesMesh 하나와 벽 LinesMesh 네 개를 만든다. 1m 간격, alpha=0.28, useVertexAlpha=true로 반투명하게 표시한다. Babylon 9.31에서 alpha 속성만 설정했을 때 불투명하게 보이는 것을 실제 화면에서 확인해 명시적 blending 설정 및 SDK 회귀 검사를 추가했다.

평소에는 모두 숨긴다. frame 설치/이동 중에는 벽 격자, 나머지 가구/colored 설치·이동 중에는 바닥 격자만 활성화한다. 완료·취소 시 숨기며 매 프레임 메시를 만들지 않는다. 벽 격자는 기존 벽 mesh를 부모로 두어 외부 벽 숨김을 따른다. 모든 격자는 isPickable=false이고 surface/object metadata를 갖지 않는다. 기존 picking, 0.1m snap, 프리뷰의 유효/무효 색과 placementError는 변경하지 않았다. 격자는 JSON/DB에 저장하지 않는다.

## 검증과 재현

Node 22.21.0, pnpm 11.25.0, 기존 의존성 React19 / Babylon9.31 / Vite8을 사용했다. 새 의존성·DB migration은 없다.

```sh
pnpm typecheck
pnpm test:myroom
pnpm test:myroom:preview
pnpm test:myroom:player
pnpm test:myroom:colored
pnpm test:myroom:history
pnpm build
# 별도 테스트 API/DB를 실행한 경우에만:
MYROOM_TEST_URL=http://127.0.0.1:3317 pnpm test:myroom:api
MYROOM_TEST_URL=http://127.0.0.1:3317 pnpm test:myroom:story
```

자동 테스트: geometry6 / Preview6 / player11 / colored12 / history·grid·navigation12 / API9 / story·file7, **총63 pass / 0 fail / 0 skip**(부모 테스트 포함). 타입 검사 및 production flag=true 빌드 성공. 기존 500KB 초과 chunk 경고가 남는다. API 테스트는 MYROOM_TEST_URL 미설정 시 skip하므로 이번 결과는 값을 지정해 실행한 로그를 기준으로 한다.

격리 PostgreSQL18 클러스터와 테스트 업로드 경로만 사용했다. 이전 55439 포트는 Windows 소켓 제한으로 실행할 수 없어 프로세스 실행 옵션으로 127.0.0.1:5545를 사용했다. DB 설정 파일/운영 DB는 변경하지 않았다. API3317은 loopback에만 열었다. 일반 모드8452는 실제 테스트 API를 사용하고, Preview8451은 사용하지 않는 API39991을 지정한 별도 저장 origin으로 실행해 기존8443 Mock 데이터를 건드리지 않았다. Preview의 API/업로드 요청 감사 결과는 0건이다.

브라우저에서 확인한 항목:

- Preview 설치→작품 선택→각 Undo/Redo, 이동+90도 회전 복원, 새 편집의 Redo 제거, 삭제 복원, 저장 후 Undo의 dirty 및 재저장/새로고침 복원.
- 모달·배치 프리뷰·range 포커스의 단축키 차단, I 인벤토리, Esc 취소, 편집 후 W 이동/Space 점프. 플레이어 위치 변화는 이력/dirty에 포함되지 않는다.
- 바닥/벽 격자 분리, 실제 바닥·벽 클릭 설치, 완료/취소 후 격자 숨김.
- 실제 테스트 사용자와 테이블+상판 colored fixture에서 slider1.0→1.5 연속 드래그를 단일 Undo로1.0 복원. 테이블+상판 객체를 이동·회전한 뒤 단일 Undo로 모두 복원.
- 홈 이동 경고, 실제 hash anchor/브라우저 Back 차단 및 취소, clean 홈 이동, 명시적 이탈 확인 후 목적지 이동. hash 테스트 anchor는 외부 검증 서버가 주입한 것으로 제품/빌드에는 포함하지 않는다.
- 두 화면의 실제 DB409 후 Undo/Redo 유지, JSON 백업 다운로드(schemaVersion1), 원격 revision1 수락 시 clean/빈 이력, backup 복원→Undo 시 원격 clean 상태.

Native 새로고침 경고창의 실제 표시, 우클릭 유지 드래그, 모든 미니게임 완주 및 모바일/GPU 성능은 이번에 재검증하지 않았다. 기존 beforeunload와 카메라 입력은 보존하고 플레이어 SDK/물리 회귀는 통과했다. 수납함에서 원본을 영구 삭제하는 등 레이아웃 밖 리소스 수명 변경은 Undo 대상이 아니며, 그런 ID를 복원한 배치는 기존 서버 소유권 검증에 따라 저장이 거부될 수 있다.

근거: 별도 `outputs/myroom-history-20261111/README.md`, `logs/`, `screenshots/01~12`, 새 tests/myroom-history.test.js / myroom-grid.test.js / myroom-navigation.test.js. 보관 경로: `Research/DOROBUS_MyRoom_Inspection/experiments/DORO-MYROOM-HISTORY-GRID-20261111-01/` (실제 업로드·전체 재다운로드 SHA256 확인 여부는 receipt를 따른다).

## 최종 시연 스크린샷과 검증 보관

아래 PNG 두 장은 실제 실행한 Preview 화면이며 Git LFS로 관리한다. 원본/픽셀 무결성/수행 조작은 [이미지 기록](assets/myroom/README.md)에 있다. 로그·테스트 데이터·환경설정은 Git에 포함하지 않고 기존 실험 아카이브에 보관한다.

**배치 모드:** 바닥 격자와 유효한 책상 프리뷰, 하단 배치 안내, 왼쪽 Undo/Redo 버튼을 함께 표시한다. 모달·배치 중 단축키 충돌 방지를 위해 이력 버튼은 비활성화되어 있다.

![바닥 격자와 책상 배치 프리뷰](assets/myroom/01-placement-grid.png)

**Undo/Redo 이후:** 책상 설치 → Undo로 제거 → Redo로 복원했다. 복원된 책상과 상단 미저장 변경 사항을 보여 주며, 격자는 배치 완료 후 숨겨진다. Redo 완료 후 미래 이력이 없어 Redo 버튼은 비활성화한다.

![Redo로 복원된 책상과 미저장 상태](assets/myroom/02-redo-unsaved.png)

[구현·63개 테스트·브라우저 검증 보관본](https://drive.google.com/file/d/1wkU_qbPrIFqCLZpPwQGmn0Bjemmo0rnY/view)은 전체 재다운로드 SHA256 `32366c48f3018f9870bba10825635a246bf42d91fcb3d703a9daee7c5ffb02ac` 일치를 확인했다. [최종 촬영 보관본](https://drive.google.com/file/d/1_pK3LdQ4OzBP5LMwkvQflNb9g0SLB9g7/view)도 같은 방식으로 확인했다. 기존 사용자 작업·원본 산출물은 삭제하지 않는다.
