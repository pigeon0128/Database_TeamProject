# 마이룸 Undo/Redo·격자 시연 이미지

2026-11-11 실제 Microsoft Edge Preview 실행 화면. 두 PNG 모두 1920×1080(16:9)이며 저장소의 기존 `.gitattributes`에 따라 Git LFS로 관리한다. 그림은 직접 작성한 Preview Mock 샘플이다.

- `01-placement-grid.png`: 책상 설치 중 1m 바닥 격자, 유효한 초록색 프리뷰, 배치 안내 및 Undo/Redo 버튼. 배치 중 이력 버튼은 비활성화한다.
- `02-redo-unsaved.png`: 책상 설치 → Undo로 제거 → Redo로 복원한 실제 상태. 오른쪽 책상과 미저장 변경 사항·저장 버튼을 보여 준다. Redo 완료 후 미래 이력이 없어 Redo는 비활성화한다.

브라우저 도구의 JPEG 캡처를 PNG로만 변환했다. 크롭·크기 변경·보정·합성·생성 이미지는 사용하지 않았고, 디코딩한 전체 ARGB 픽셀의 SHA256이 원본과 일치함을 검증했다. 원본과 조작 기록은 [추가 촬영 보관본](https://drive.google.com/file/d/1_pK3LdQ4OzBP5LMwkvQflNb9g0SLB9g7/view)에 있다. 전체 ZIP 재다운로드 SHA256: `9a00f468596df42c067af3bce11953d6923d23577fb4c418c947bc01306f0beb`.

PNG SHA256:

- 01: `7fe4ddd1dbff8c740cb38845b229ad3dd513915f1f94530223f48817e6d422c4`
- 02: `2dcd901479a7490a979bd71126827b63f07a7ff9d0f7f2964d69df936425de94`

로그·테스트 DB·업로드 데이터·로컬 설정·사용자 패치는 이 폴더 및 소스 커밋에 포함하지 않는다. 실험 ID: `DORO-MYROOM-FINAL-SCREENSHOTS-20261111-01`. 구현/전체 검증 실험: `DORO-MYROOM-HISTORY-GRID-20261111-01`.
