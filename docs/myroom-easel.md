# 바닥 배치형 그림 이젤 — 2026-10-29

## 변경 범위

기준: feature/myroom 251c8bd. 기존 방·배치 엔진·플레이어·카메라·인증·Preview 소스는 유지한다.

- shared/myroom.js/.d.ts: easel(폭 1.3, 높이 2.2, 깊이 1) 카탈로그, supportsArtwork(frame/easel), 기존 artworkDrawingId 양의 안전 정수 검사 유지.
- InventoryPanel/RoomUI: 장식 카테고리, 목재 이젤 설명과 자체 SVG 썸네일.
- createObject: MeshBuilder Box 기반 전면 A형 다리, 뒤 지지대, 가로대/받침대와 세로 캔버스. backing과 그림 Plane을 canvas-mount에 묶어 x=0.21rad 기울인다. mount=(0,1.44,-0.12), 받침대 윗면 y=0.81. 판 최저점은 약 y=0.807로 받침대에 닿고, 상단이 뒤쪽으로 약 0.27 이동한다. 모든 Mesh는 기존 objectId picking/shadow/dispose를 따른다.
- objects/artworkTexture.ts: 기존 액자의 DynamicTexture 768×864 생성, placeholder, 밑그림 alpha .3+완성 PNG 합성, Preview SVG 로딩 및 dispose 후 비동기 완료 방어를 이동했다. 액자 렌더링 정책은 동일하다. createObject의 preview 인자는 배치 고스트를 뜻하며 DEV Preview 데이터 모드와 다르다.
- MyRoomPage: 액자 전용 작품 선택 조건만 supportsArtwork로 확장. 이젤의 위치/회전/삭제는 기존 바닥 가구 동작을 사용한다. 이동 중 artworkDrawingId가 보존된다.

## 저장과 하위 호환성

```json
{"schemaVersion":1,"expectedRevision":3,"layout":{"objects":[{"id":"easel-example","type":"easel","position":{"x":2,"y":0,"z":1},"rotation":1.5707963267948966,"scale":1,"artworkDrawingId":2}]}}
```

실제 모드의 artworkDrawingId는 사용자 도감의 완성 작품 drawingId다. Preview는 별도 Mock ID만 허용하며 위 예시는 실제 API 계약을 설명하는 가상 값이다. 두 모드의 저장소를 섞지 않는다.

user_myrooms.layout은 JSONB이고 DB 제약은 objects 배열/최대 40개만 검사한다. 서버는 공유 validateLayout과 모든 오브젝트의 작품 ID를 검사하고 사용자 잠금/소유권 SQL/revision 비교를 유지한다. 따라서 신규 migration/schemaVersion 증가가 필요 없다. 빈 방 및 frame/chair/table/plant를 포함한 기존 레이아웃은 그대로 유효하다. 이전 버전 클라이언트/서버는 새 easel 종류를 알지 못하므로 배포 시 프런트와 공유 계약을 사용하는 서버를 함께 갱신한다.

## 검증

- pnpm typecheck 성공.
- pnpm test:myroom: 6/6 — 기존 v1 round-trip, 이젤 floor/wall/회전/경계/겹침, 가구의 작품 ID 금지.
- pnpm test:myroom:preview: 6/6 — 이젤 작품 교체/이동/90도 회전/삭제/저장 복원, 실제 ID 차단, 잘못된 geometry·stale revision이 저장본을 덮어쓰지 않음.
- pnpm test:myroom:player: 10/10 — 이젤 충돌 및 겹친 spawn 이동, 기존 점프/이동/우클릭 SDK inputMap 회귀.
- MYROOM_TEST_URL=<격리 local API> pnpm test:myroom:api: 8/8(부모 포함) — frame+easel 실제 PostgreSQL 저장/조회, 이젤에 타인/없는/Mock 작품 차단, 사용자 격리, revision, 교체/이동/삭제. 운영 DB는 사용하지 않음.
- VITE_MYROOM_PREVIEW=true pnpm build 성공; 배포 JS의 Preview Mock/저장 키 부재 확인. 기존 Babylon lazy chunk 경고(약 831KB)는 남아 있음.
- 실제 브라우저: root Preview/API 미연결, 기존 액자 유지, 인벤토리, 작품 선택/교체, 이동/90도 회전, 겹침 차단, 저장/새로고침, 이젤 앞 이동 충돌과 Space, 별도 origin 삭제 저장, 측면 기울기/받침 접점, production #/myroom 로그인 확인.
- 우클릭 입력 설정과 player/engine 파일은 이번 변경에서 수정하지 않음. SDK 회귀 테스트는 통과했고 실제 우클릭 회전은 이전 251c8bd 검증에서 사용자 확인을 받았다. 이번 브라우저 자동화에서 우클릭 유지 드래그를 새로 검증했다고 주장하지 않는다.

## 근거와 제한

실험 DORO-MYROOM-EASEL-20261029-01의 outputs/myroom-easel/에 스크린샷/로그/실험 README를 보관한다. 01–10은 수직 판을 사용한 초기 기능 검증, 12/13은 사용자 피드백을 반영한 최종 기울기 측면/복원, 14는 작품 연결 복원, 15는 삭제, 16은 production 로그인이다. 번호 11은 생성되지 않았다.

충돌은 기존 보수적인 직사각 footprint를 사용하므로 다리 사이도 통과할 수 없다. 기울기는 고정 형상으로 사용자 조절/DB 필드를 추가하지 않는다. Canvas 이미지는 공통 고정 해상도를 사용한다. 새 에셋·패키지·AI 생성 이미지·원본 DOROBUS 자료를 추가하지 않았다. 저사양/실기기 GPU와 대량 이젤 성능은 별도 검증하지 않았다.
