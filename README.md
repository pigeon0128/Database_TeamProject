# Database_TeamProject

도로 AI 그림 그리기 프로그램 — 캐릭터 그리기, 스토리 장면 따라 그리기, 리더보드를 제공하는 웹 앱입니다.

React 19 + TypeScript + Vite + Tailwind CSS 4 (화면), Express + PostgreSQL (API 서버) 로 만들었습니다.

> 앱은 **로그인한 뒤에만** 들어갈 수 있어서, 화면을 보려면 PostgreSQL과 API 서버가 함께 실행 중이어야 합니다.
> 기록, 그리기 설정, 그리던 그림(이어 그리기)은 모두 데이터베이스에 저장됩니다.
> 아래 명령은 Windows **PowerShell** 기준이며, 모두 프로젝트 폴더에서 실행합니다.

## 한눈에 보기

처음 한 번 (1~3단계로 프로그램을 설치한 뒤):

```powershell
pnpm install
pnpm db:migrate        # .env 가 만들어짐 → notepad .env 로 PostgreSQL 비밀번호를 넣고
pnpm db:migrate        # 한 번 더 실행하면 DB와 표가 만들어짐
```

매번:

```powershell
pnpm dev:all           # API 서버 + 화면을 함께 실행 → http://localhost:8443
```

## 파일 구조

```
src/                      화면 (React)
  main.tsx, App.tsx         시작점, 주소별 화면 연결
  auth.tsx, router.ts       로그인 상태, 페이지 이동
  pages/                    화면 하나 = 파일 하나 (story/ 스토리 그리기, creatures/ 도감 생물 그리기)
  components/               여러 화면이 같이 쓰는 부품 (그림판, 툴바)
    drawing/                  그리기 화면 공용 (도구 상태, 메뉴, 화면 틀)
  lib/                      서버에 저장되는 상태와 도우미 (api, 설정, 이어 그리기, 날짜·시간 형식)
    drawing/                  그림·채점 엔진 (획, 채점, 밑그림 가공, 단축키) — 서버 없이 브라우저에서만 동작
  data/                     장면 목록(scenes), 도감 생물 목록(creatures)
  assets/                   밑그림 이미지 (story/, creatures/) — DB에는 경로만 저장
server/                   API 서버 (Express)
  routes/                   주소별 처리 (auth, drawings, records, settings, drafts, collection)
database/                 DB (PostgreSQL)
  migrations/               표를 만드는 SQL (번호 순서대로 실행)
  queries/, seeds/          예시 쿼리, 기본 데이터
scripts/                  pnpm db:migrate, pnpm dev:all
```

화면 → `lib/api.ts` → `server/routes/` → `database/` 순서로 따라가면 기능 하나를 끝까지 볼 수 있습니다.

## 실행 방법

### 1. 준비물 (처음 한 번만)

| 프로그램 | 버전 | 설치 |
|---|---|---|
| Git | 최신 | https://git-scm.com |
| Node.js | **22.9 이상** | https://nodejs.org (LTS 버전) 또는 `winget install OpenJS.NodeJS.LTS` |
| pnpm | 10 이상 | Node.js 설치 후 `npm install -g pnpm` |
| PostgreSQL | 18 | 아래 명령 또는 https://www.postgresql.org/download/windows/ |

PostgreSQL 설치 (설치 창이 뜹니다):

```powershell
winget install PostgreSQL.PostgreSQL.18 --interactive
```

- **Password** 화면에서 정하는 `postgres` 계정 비밀번호를 꼭 기억해 두세요. (`.env` 에 넣습니다)
- **Port** 는 `5432` 그대로 두고, 마지막의 Stack Builder 실행은 체크를 빼도 됩니다.

> 프로그램을 설치한 뒤에는 **열려 있는 터미널을 모두 닫고 새로 열어야** 명령이 인식됩니다.
> PowerShell에서 `pnpm`이 실행되지 않으면 `Set-ExecutionPolicy -Scope CurrentUser RemoteSigned` 를 한 번 실행하세요.

설치 확인:

```powershell
node -v
pnpm -v
```

### 2. 프로젝트 받기

```powershell
git clone https://github.com/pigeon0128/Database_TeamProject.git
cd Database_TeamProject
```

> 이미지 파일은 Git LFS로 저장됩니다. Windows용 Git에는 LFS가 포함되어 있어 따로 할 일은 없습니다.
> 이미지가 깨져 보이면 `git lfs install` 후 `git lfs pull` 을 실행하세요.

### 3. 패키지 설치

```powershell
pnpm install
```

처음 한 번, 그리고 `package.json` 이 바뀌었을 때(다른 사람이 패키지를 추가했을 때)만 하면 됩니다.

### 4. 데이터베이스 준비 — `pnpm db:migrate`

```powershell
pnpm db:migrate
```

처음 실행하면 `.env` 파일을 만들고(로그인용 비밀 값은 자동으로 채움) 멈춥니다. 메모장으로 열어

```powershell
notepad .env
```

`DATABASE_URL` 의 `비밀번호` 자리에 PostgreSQL 설치 때 정한 비밀번호를 넣고 저장한 뒤, **한 번 더** 실행합니다.

```powershell
pnpm db:migrate
```

`db:migrate` 가 하는 일:

1. DB(`doroland_drawing`)가 없으면 만듭니다.
2. `database/migrations/` 의 SQL 중 **아직 실행하지 않은 것만** 번호 순서대로 실행하고, 실행한 파일을 `schema_migrations` 표에 기록합니다.
3. 앱의 장면 목록(`database/seeds/content.sql`)을 넣습니다. 기록 저장과 리더보드에 꼭 필요합니다.

- `완료: 표 8개 (...)` 가 나오면 성공입니다.
- **psql 을 설치하거나 경로를 잡을 필요가 없습니다.**
- 예전에 psql 로 DB를 직접 만들었어도 그대로 실행하면 됩니다. 이미 있는 것은 `이미 있음` 으로 건너뛰고 새 파일만 실행합니다.
- 나중에 다른 사람이 새 마이그레이션을 추가하면 `pnpm db:migrate` 만 다시 실행하면 됩니다.
- 개발용 예시 데이터(사용자 3명·기록)도 넣으려면 빈 DB에서 `pnpm db:migrate --seed` 로 실행합니다. 예시 사용자는 비밀번호가 없어 로그인할 수 없습니다.

> `.env` 는 비밀번호가 들어 있어 GitHub에 올라가지 않습니다. 각자 만들어야 합니다.
> 비밀번호에 `@ : / # %` 같은 특수문자가 있으면 주소가 깨지므로, 그 글자를 URL 인코딩(예: `@` → `%40`)해서 넣으세요.

### 5. 실행 — `pnpm dev:all`

```powershell
pnpm dev:all
```

API 서버(`[api]`)와 화면(`[web]`)이 한 터미널에서 함께 켜집니다. `[api] http://localhost:3001 에서 실행 중` 이 나오면 준비된 것입니다.

브라우저에서 **http://localhost:8443** 을 열고, 처음이면 **회원가입** 탭에서 계정을 만들어 입장합니다.
코드를 저장하면 화면에 바로 반영되고, 끄려면 `Ctrl + C` 를 한 번 누르면 둘 다 꺼집니다.

> 따로 띄우고 싶으면 터미널 2개에서 `pnpm dev:server`(API 서버)와 `pnpm dev`(화면)를 각각 실행해도 됩니다.

다음부터는 **5단계만** 하면 됩니다. (`git pull` 로 새 마이그레이션을 받았다면 `pnpm db:migrate` 를 먼저)

### 문제가 생기면

| 화면 / 터미널 메시지 | 확인할 것 |
|---|---|
| `.env 파일을 만들었어요` | 정상입니다. `notepad .env` 로 비밀번호를 넣고 `pnpm db:migrate` 를 다시 실행 |
| PostgreSQL 비밀번호가 맞지 않아요 | `.env` 의 `DATABASE_URL` 비밀번호 |
| PostgreSQL 에 연결할 수 없어요 | PostgreSQL 설치 여부, Windows 서비스(`postgresql-x64-18`)가 실행 중인지 |
| API 서버에 연결할 수 없어요 | `pnpm dev:all` (또는 `pnpm dev:server`) 이 켜져 있는지 |
| 데이터베이스 테이블이 없어요 | `pnpm db:migrate` 를 실행 |
| 존재하지 않는 그림이거나 사용자예요 | `pnpm db:migrate` 를 실행 (장면 목록이 DB에 없음) |
| `Port 8443 is already in use` | 다른 터미널에서 이미 화면이 실행 중입니다. 그 창을 쓰거나 `Ctrl + C` 로 끄고 다시 실행 |
| `bad option: --env-file-if-exists` | Node.js 버전이 낮습니다. 22.9 이상으로 업데이트 |
