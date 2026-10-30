# PROJECT_STATE — 마이룸 구현

최종 갱신: 2026-10-27 KST. 기준 main: `75a872c19d5ad11f48362ebcc3e8156941844aff`. 작업 브랜치: `feature/myroom`.

## 현재 목표

DOROBUS 실관찰 화면의 색·공간·패널 계층을 기준으로 독립적인 3D 전시 공간을 제공한다. 기존 홈·그림판·기록 정책은 유지한다.

## 완료

- DORO-INSPECT-20261027-01의 8개 JPG 직접 검토/ZIP 동일성 확인.
- Babylon.js 9.31.0 lazy feature, 빈 기본 방, 자체 가구/액자, 벽/바닥 picking과 경계/충돌 검증.
- 현재 내 도감 그림을 drawingId로 전시, 밑그림 .3 + 투명 PNG 합성, 교체/placeholder/dispose.
- GET/PUT /api/myroom, 019 user_myrooms migration, 기존 세션·파라미터 SQL·소유권·revision 충돌 처리.
- 실제 PostgreSQL 18 분리 인스턴스 및 실제 브라우저 입력으로 저장/복원·2개 작품·충돌 UI 검증.
- 지오메트리/API 총 11 테스트 pass, 타입 검사/빌드 성공.

## 확립된 결과와 근거

기능/데이터 계약은 [아키텍처](docs/myroom-architecture.md), 자동화 검증은 `tests/myroom*.test.js`에 있다. 시각 비교와 실행 로그는 실험 `DORO-MYROOM-IMPL-20261027-01`의 별도 산출물에 보관한다. Inspection은 원본 서버 저장 성공을 확인하지 못했지만, 이번 구현의 저장/복원은 자체 테스트 서버에서 직접 확인했다.

## 제약과 열린 질문

원본 전체 치수·실제 배치 액자의 물리 비율은 Unknown이며 독립 형상으로 근사했다. 원본 에셋·브랜딩·아바타/포털/채팅은 포함하지 않았다. 실기기 GPU/모바일과 네트워크 장애 조합의 광범위 검증은 하지 않았다. 큰 Babylon lazy chunk 경고, 선택 때 전체 Mesh 재생성, 해시 뒤로 이동 시 미저장 상태 손실 가능성은 후속 개선 대상이다.

## 다음 단계

PR 리뷰, 팀 migration 번호 재확인, 홈 진입 UX 합의, 저사양 성능 계측, 배치 Undo/Redo 및 필요 시 작품 영구 보존 정책 설계. main merge는 수행하지 않는다.

## 보관

Research/DOROBUS_MyRoom_Inspection/experiments/DORO-MYROOM-IMPL-20261027-01/.
업로드·재다운로드 체크섬 검증 결과는 실험 산출물의 동기화 receipt를 따른다. 결과 보관 여부를 확인하기 전에는 성공으로 추정하지 않는다. 운영 DB/계정 정보는 산출물에 포함하지 않는다.

## 2026-10-28 단일 조작으로 수정

사용자가 거부한 0071c6d의 두 모드/사각 로봇 설계는 일반 revert 135f9fc로 되돌려 e7ac24d 기준 파일을 복구했다. Preview·Mock·로컬 저장·AuthProvider 분리는 보존했다. 새 구현은 사용자 제공 c1/c2 실제 화면을 직접 보고 자체 둥근 머리/작은 몸통/가는 팔다리·안테나/검은 원형 눈/닉네임으로 교체하며 별도 모드 없이 WASD/방향키·Space·우클릭·좌클릭·I·Esc를 연결한다.

물리적 상승/낙하/착지, 공중 재점프 방지와 idle/walk/jump pose, 가구/벽 충돌을 런타임 메모리에서 관리한다. 실제 SDK 입력 회귀 테스트가 허용 버튼과 movement inputMap이 다른 Babylon 9.31의 문제를 포착하도록 추가됐고 최종 우클릭 동작은 사용자 실입력 확인을 받았다. 기존 실패한 두 모드 산출물은 삭제하지 않고 역사적 기록으로 남긴다.

근거는 아키텍처 15절, 테스트 25건, 실제 브라우저 저장/복원·점프·충돌·단일 인벤토리·production 로그인 검증 및 실험 DORO-MYROOM-SINGLE-20261028-01이다. 서버/DB/Auth/Preview 저장 계약은 e7ac24d와 같다. 원본 표면/그림자/세부 신발 등 시각 차이와 가구 위 착지·모바일 이동·GPU 성능의 범위 제한은 보고서에 구분한다. main merge/force push/reset은 수행하지 않는다.

## 2026-10-28 Preview 재개

미커밋 Preview와 사용자 패치를 work/preview-resume-backup-20261028에 보존했다. Mock 샘플/로컬 저장 및 5개 Preview 테스트를 유지했으며 타입 검사, 기존 geometry 4개 테스트, production build를 다시 통과했다. 환경변수 true인 production JS에서 샘플과 로컬 저장 키가 제거되는 것을 확인했다. 이어서 AuthProvider 없는 개발 전용 진입과 플레이어를 별도 커밋으로 진행한다.


## 2026-10-28 독립 개발 진입

Preview는 App의 DEV 전용 분기에서 AuthProvider 없이 마운트한다. localhost:8443 루트와 직접 해시 진입을 브라우저에서 확인했고, 사용하지 않는 API 대상 39991에 대해 요청 감사 로그의 API/업로드 요청은 0건이었다. Preview 홈/나가기만 숨기고 실제 인증 래퍼와 서비스 이탈은 유지했다. production flag=true 빌드에서 Mock 데이터/저장 키가 제거됨을 다시 확인했다.


## 2026-10-29 바닥형 그림 이젤

기존 단일 조작과 Preview를 유지하면서 `easel` 카탈로그/인벤토리 항목과 자체 MeshBuilder 목재 삼각 지지대·캔버스를 추가했다. 캔버스/그림 표면은 동일한 TransformNode에서 뒤로 0.21rad(약 12도) 기울이고 받침대 위에 놓았다. 공유 `supportsArtwork` 검증은 frame/easel만 작품 ID를 허용하고, 작품 로딩/밑그림 합성/placeholder/dispose는 공통 artworkTexture 모듈로 분리했다.

기존 JSONB schemaVersion 1과 revision 및 작품 소유권 쿼리가 종류와 무관하게 작동하여 서버/DB/인증/Preview 저장 모듈 변경 및 신규 migration 없이 구현했다. 기존 4종 가구 레이아웃도 그대로 읽는다. geometry 6, Preview 6, player 10, 격리 PostgreSQL/API 8(부모 테스트 포함), 타입 검사와 production flag=true 빌드가 통과했다. 실제 브라우저에서 기존 액자 보존, 설치/교체/이동/90도 회전/겹침 차단/플레이어 충돌/점프/로컬 저장 복원/삭제, 기울기 측면 및 production 로그인 화면을 확인했다.

실험 ID: DORO-MYROOM-EASEL-20261029-01. 근거와 한계는 docs/myroom-easel.md 및 별도 outputs/myroom-easel/README.md에 기록한다. 이전 수직 캔버스 스크린샷은 초기 실험 기록이며 최종 측면 근거는 12/13번이다. main merge는 수행하지 않는다.

## 2026-10-29 최신 main 통합

동일 feature/myroom에서 origin/main bb4767c를 일반 Merge했다. PR #13은 bb4767c로 이미 Merge된 상태임을 읽기 전용 조회로 확인했다. 팀원의 studio/App 라우팅·미니게임·도감·리더보드·인증/서버/DB는 main과 동일하게 보존하고, 이젤/공통 텍스처/플레이어/Preview 및 테스트는 8f28336과 동일하게 유지했다. 코드 충돌은 없었다. 최초 sandbox의 Git LFS 실행 제한은 중간 생성 파일을 별도 보존하고 정상 권한으로 재시도해 해결했다. Git LFS PNG 원본도 정상 checkout됐다.

타입 검사, geometry 6/Preview 6/player 10/격리 PostgreSQL API 8(부모 포함), production build를 통과했다. 실제 브라우저에서 인증, 캐릭터 입력·Undo/Redo, 스토리 입력·채점, studio 경로, 도감 완성·기록 저장·리더보드와 완성 작품의 이젤 연결·회전·DB 저장/복원, Mock 별도 저장/복원 및 이동/점프를 검증했다. 테스트 증거는 실험 DORO-MYROOM-MAIN-20261029-01의 outputs/myroom-main-integration에 남긴다. 대규모 게임 플레이/실기기 성능 검증을 의미하지 않는다. 사용자 백업 패치는 원본 및 별도 사본의 SHA256 동일성을 확인하고 추적하지 않았다. Git 작성자 설정과 기존 커밋은 변경하지 않고 Co-authored-by를 추가하지 않았다. 새 브랜치/PR 생성 및 기존 PR 수정, main Push/Merge는 수행하지 않는다.

## 2026-10-30 이젤·색칠 오브젝트 충돌 통합

기존 feature/myroom 9cf13eb에서 최신 origin/main c094f74를 일반 Merge하면서 실제 충돌 4개 파일(shared/myroom.d.ts, MyRoomPage.tsx, createObject.ts, docs/myroom-architecture.md)을 기능 단위로 통합했다. ObjectType에 easel/colored를 모두 유지하고, 작품 선택·공통 DynamicTexture·기울어진 이젤과 colored의 수납 spec 렌더링/크기 슬라이더/0.5~2.5배 및 테이블 배치 규칙을 모두 보존했다. shared/myroom.js와 InventoryPanel의 자동 병합 결과도 양쪽 카탈로그·ID/크기 검증·배치·인벤토리 계약이 살아 있음을 검토했다. 양쪽 개발 기록은 삭제하지 않고 아키텍처 16절(이젤)/17절(수납함)로 함께 남겼다. main의 020_stored_objects.sql과 색칠/내보내기/지우개/도감 수정은 그대로 반영했고 이번 해결을 위한 별도 migration은 만들지 않았다.

검증: typecheck, geometry 6/Preview 6/player 11/colored 12/격리 PostgreSQL API 9(부모 포함), 총44건 pass/0 fail/0 skip 및 production flag=true build 성공. 새 테스트는 frame+easel+colored 동시 저장, 양쪽 ID/소유권/크기 규칙, 확대·회전 footprint 충돌과 플레이어 충돌, revision·불법 변경 거부·저장 복원·수납 삭제 방어를 검사한다. 테스트 DB의 기존 분리 cluster(55439)에 main의 020만 적용했으며 운영 DB는 사용하지 않았다.

실제 브라우저에서 3D 색칠→수납→바닥 배치(2.5배)→선택 패널 크기 변경(2.3배)→완성 도감 작품을 이젤에 전시→혼합 저장/새로고침→colored 2.3배 및 이젤 작품 연결 복원을 확인했다. 기존 Mock Preview 이젤의 꽃→산 교체·로컬 저장/복원, WASD/Space, studio·캐릭터 입력/Undo/Redo·스토리 입력/채점·도감 완성 저장도 검증했다. 우클릭 카메라 파일은 원형 보존 및 Babylon SDK 회귀 통과를 근거로 하며 자동화에서 실제 우클릭 유지 드래그를 재검증했다고 주장하지 않는다. 실제 휴대폰/GPU·전 게임 완주 성능은 미검증이다. 증거는 DORO-MYROOM-COLORED-MERGE-20261030-01/outputs/myroom-colored-merge에 보관한다. 사용자 패치 백업 SHA256은 이전과 동일하고 별도 사본도 보존한다. 새 브랜치/PR/원격 main 변경/force push/reset/rebase를 수행하지 않는다. 기존 Git 작성자 설정과 커밋 Author를 변경하거나 Co-authored-by를 추가하지 않는다.
