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
