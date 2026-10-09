# Database_TeamProject

도로 AI 그림 그리기 프로그램 — 캐릭터 그리기, 스토리 장면 따라 그리기, 리더보드를 제공하는 웹 앱입니다.

React 19 + TypeScript + Vite + Tailwind CSS 4 로 만들었습니다.

## 실행 방법

### 1. 준비물 (처음 한 번만)

| 프로그램 | 버전 | 설치 |
|---|---|---|
| Git | 최신 | https://git-scm.com |
| Node.js | 22 이상 | https://nodejs.org (LTS 버전) 또는 `winget install OpenJS.NodeJS.LTS` |
| pnpm | 10 이상 | Node.js 설치 후 `npm install -g pnpm` |

> Node.js를 설치한 뒤에는 **열려 있는 터미널을 모두 닫고 새로 열어야** `node`, `npm` 명령이 인식됩니다.
> PowerShell에서 `pnpm`이 실행되지 않으면 `Set-ExecutionPolicy -Scope CurrentUser RemoteSigned` 를 한 번 실행하세요.

설치 확인:

```bash
node -v
pnpm -v
```

### 2. 프로젝트 받기

```bash
git clone https://github.com/pigeon0128/Database_TeamProject.git
cd Database_TeamProject
```

> 이미지 파일은 Git LFS로 저장됩니다. Windows용 Git에는 LFS가 포함되어 있어 따로 할 일은 없습니다.
> 이미지가 깨져 보이면 `git lfs install` 후 `git lfs pull` 을 실행하세요.

### 3. 패키지 설치

```bash
pnpm install
```

처음 한 번, 그리고 `package.json` 이 바뀌었을 때(다른 사람이 패키지를 추가했을 때)만 하면 됩니다.

### 4. 개발 서버 실행

```bash
pnpm dev
```

브라우저에서 **http://localhost:8443** 을 열면 됩니다.
코드를 저장하면 화면에 바로 반영되고, 서버를 끄려면 터미널에서 `Ctrl + C` 를 누릅니다.

### 그 밖의 명령

| 명령 | 설명 |
|---|---|
| `pnpm build` | 배포용 파일을 `dist/` 폴더에 만듭니다 |
| `pnpm preview` | `pnpm build` 결과를 미리 실행해 봅니다 |
| `pnpm format` | 코드 서식을 정리합니다 |

## 자주 나는 문제

| 증상 | 해결 |
|---|---|
| `'npm'(또는 node, pnpm) 용어가 ... 인식되지 않습니다` | Node.js 설치 후 터미널을 새로 열었는지 확인. 그래도 안 되면 Node.js를 다시 설치 |
| `Port 8443 is in use` | 다른 터미널에서 이미 `pnpm dev` 가 실행 중입니다. 그 창을 쓰거나 `Ctrl + C` 로 끄고 다시 실행 |
| 화면이 하얗게 나옴 | `pnpm install` 을 다시 실행한 뒤 `pnpm dev` |

## 함께 작업하기

작업 전에 항상 최신 코드를 받습니다.

```bash
git pull
```

기능은 브랜치를 만들어 작업하고, GitHub에서 Pull Request로 `main` 에 합칩니다.

```bash
git switch -c 브랜치이름
git add .
git commit -m "무엇을 바꿨는지"
git push -u origin 브랜치이름
```

## 화면 구성

| 주소 | 화면 | 파일 |
|---|---|---|
| `#/` | 메인 메뉴 | `src/pages/HomePage.tsx` |
| `#/character` | 캐릭터 그리기 | `src/pages/CharacterPage.tsx` |
| `#/story` | 스토리 장면 그리기 (밑그림 따라 그리기 + 실시간 점수) | `src/pages/StoryPage.tsx` |
| `#/leaderboard` | 리더보드 | `src/pages/LeaderboardPage.tsx` |
| `#/settings` | 설정 및 방법 | `src/pages/SettingsPage.tsx` |

### 스토리 장면 그리기 조작법

| 키 | 기능 |
|---|---|
| `B` / `E` | 브러쉬 / 지우개 |
| `[` / `]` | 굵기 줄이기 / 늘리기 |
| `1` ~ `0` | 색깔 고르기 |
| `Ctrl + Z` / `Ctrl + Y` | 되돌리기 / 다시 하기 |
| `Ctrl + 휠`, `Ctrl + +` / `Ctrl + -` / `Ctrl + 0` | 캔버스 확대 / 축소 / 원래 크기 |
| `Ctrl + 드래그` | 확대한 화면 이동 |

## 폴더 구조

```
src/
├─ pages/          화면별 컴포넌트
├─ components/     공통 컴포넌트 (PageLayout, TracingCanvas)
├─ lib/            채점(traceScore), 밑그림 처리(guideImage)
├─ assets/         이미지
├─ router.ts       #주소 기반 화면 이동
└─ main.tsx        시작 파일
```

## 팀원

윤태원, 구준영, 김상봉, 이찬영, 이준수
