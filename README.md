# Database_TeamProject

도로 AI 그림 그리기 프로그램 — 캐릭터 그리기, 스토리 장면 따라 그리기, 리더보드를 제공하는 웹 앱입니다.

React 19 + TypeScript + Vite + Tailwind CSS 4 (화면), Express + PostgreSQL (API 서버) 로 만들었습니다.

> 앱은 **로그인한 뒤에만** 들어갈 수 있어서, 화면을 보려면 PostgreSQL과 API 서버가 함께 실행 중이어야 합니다.
> 아래 명령은 Windows **PowerShell** 기준이며, 모두 프로젝트 폴더에서 실행합니다.

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

### 4. 데이터베이스 만들기 (처음 한 번만)

PostgreSQL 설치 프로그램은 `psql` 명령을 등록하지 않으므로, 터미널을 열 때마다 먼저 경로를 추가합니다.
(SQL 파일의 한글이 깨지지 않도록 인코딩도 함께 지정합니다)

```powershell
$env:Path += ";C:\Program Files\PostgreSQL\18\bin"
$env:PGCLIENTENCODING = "UTF8"
```

DB를 만들고 SQL을 **아래 순서대로** 실행합니다. 비밀번호를 물으면 설치할 때 정한 `postgres` 비밀번호를 입력합니다.

```powershell
psql -U postgres -c "CREATE DATABASE doroland_drawing;"
psql -U postgres -d doroland_drawing -v ON_ERROR_STOP=1 -f database/migrations/001_initial.sql
psql -U postgres -d doroland_drawing -v ON_ERROR_STOP=1 -f database/seeds/dev_seed.sql
psql -U postgres -d doroland_drawing -v ON_ERROR_STOP=1 -f database/migrations/002_auth.sql
```

- `dev_seed.sql` 은 개발용 예시 데이터(사용자·기록)라서 빼도 됩니다. 예시 사용자는 비밀번호가 없어 로그인할 수 없습니다.
- 확인: 아래 명령으로 `users`, `chapters`, `drawings`, `play_records`, `user_artworks` 5개 테이블이 보이면 성공입니다.

```powershell
psql -U postgres -d doroland_drawing -c "\dt"
```

> 나중에 `database/migrations/` 에 새 번호의 SQL 파일이 추가되면, 그 파일만 같은 방법으로 한 번 실행하면 됩니다.

### 5. 환경 설정 파일 `.env` 만들기 (처음 한 번만)

```powershell
Copy-Item .env.example .env
```

로그인 쿠키에 쓸 무작위 비밀 값을 만들어 복사해 둡니다.

```powershell
node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
```

`notepad .env` 로 열어 아래처럼 채우고 저장합니다.

```
DATABASE_URL=postgres://postgres:설치할때정한비밀번호@localhost:5432/doroland_drawing
SESSION_SECRET=위에서복사한긴문자열
API_PORT=3001
```

> `.env` 는 비밀번호가 들어 있어 GitHub에 올라가지 않습니다. 각자 만들어야 합니다.
> 비밀번호에 `@ : / # %` 같은 특수문자가 있으면 주소가 깨지므로, 그 글자를 URL 인코딩(예: `@` → `%40`)해서 넣으세요.

### 6. 실행 (터미널 2개)

**터미널 1 — API 서버** (`[api] http://localhost:3001 에서 실행 중` 이 나오면 성공)

```powershell
pnpm dev:server
```

**터미널 2 — 화면** (같은 프로젝트 폴더에서 새 터미널을 열고)

```powershell
pnpm dev
```

브라우저에서 **http://localhost:8443** 을 열고, 처음이면 **회원가입** 탭에서 계정을 만들어 입장합니다.
코드를 저장하면 화면에 바로 반영되고, 서버를 끄려면 각 터미널에서 `Ctrl + C` 를 누릅니다.

다음부터는 **6단계(터미널 2개 실행)만** 하면 됩니다.

### 문제가 생기면

| 화면 / 터미널 메시지 | 확인할 것 |
|---|---|
| `psql` 을 인식할 수 없습니다 | PostgreSQL 설치 여부, 4단계의 `$env:Path` 명령을 이 터미널에서 실행했는지 |
| API 서버에 연결할 수 없어요 | 터미널 1에서 `pnpm dev:server` 가 켜져 있는지 |
| 데이터베이스에 연결할 수 없어요 | PostgreSQL 서비스가 켜져 있는지, `.env` 의 `DATABASE_URL` 비밀번호·DB 이름 |
| `Port 8443 is already in use` | 다른 터미널에서 이미 `pnpm dev` 가 실행 중입니다. 그 창을 쓰거나 `Ctrl + C` 로 끄고 다시 실행 |
| `bad option: --env-file-if-exists` | Node.js 버전이 낮습니다. 22.9 이상으로 업데이트 |
