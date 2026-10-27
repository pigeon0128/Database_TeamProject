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

## 2026-10-28 Preview 재개

미커밋 Preview와 사용자 패치를 work/preview-resume-backup-20261028에 보존했다. Mock 샘플/로컬 저장 및 5개 Preview 테스트를 유지했으며 타입 검사, 기존 geometry 4개 테스트, production build를 다시 통과했다. 환경변수 true인 production JS에서 샘플과 로컬 저장 키가 제거되는 것을 확인했다. 이어서 AuthProvider 없는 개발 전용 진입과 플레이어를 별도 커밋으로 진행한다.


## 2026-10-28 독립 개발 진입

Preview는 App의 DEV 전용 분기에서 AuthProvider 없이 마운트한다. localhost:8443 루트와 직접 해시 진입을 브라우저에서 확인했고, 사용하지 않는 API 대상 39991에 대해 요청 감사 로그의 API/업로드 요청은 0건이었다. Preview 홈/나가기만 숨기고 실제 인증 래퍼와 서비스 이탈은 유지했다. production flag=true 빌드에서 Mock 데이터/저장 키가 제거됨을 다시 확인했다.

