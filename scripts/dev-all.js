// API 서버와 화면(Vite)을 터미널 하나에서 같이 실행한다: pnpm dev:all
// 출력 앞에 [api] / [web] 를 붙여 구분하고, Ctrl + C 를 누르거나 한쪽이 꺼지면 둘 다 끈다.
import { spawn, spawnSync } from "node:child_process";

// 이 스크립트를 실행한 패키지 관리자(pnpm 또는 npm)로 각 스크립트를 실행한다.
// npm_execpath 는 npm 이면 JavaScript 파일(npm-cli.js), pnpm 은 설치 방법에 따라 .cjs 파일이거나 실행 파일(pnpm.exe)이다.
const runner = process.env.npm_execpath;
if (!runner) {
  console.error("pnpm dev:all 로 실행해 주세요.");
  process.exit(1);
}
const runnerIsScript = /\.[cm]?js$/i.test(runner);
/** 패키지 관리자로 package.json 의 스크립트 하나를 실행하는 명령 */
const command = (script) => (runnerIsScript ? [process.execPath, [runner, "run", script]] : [runner, ["run", script]]);
// .cmd / .bat 는 Windows 에서 셸을 거쳐야 실행된다.
const needsShell = /\.(cmd|bat)$/i.test(runner);

const tasks = [
  { name: "api", script: "dev:server", color: "\x1b[35m" },
  { name: "web", script: "dev", color: "\x1b[36m" },
];

const children = tasks.map(({ name, script, color }) => {
  const [file, args] = command(script);
  // 출력을 가로채면 색이 꺼지므로 다시 켠다. 단, 색을 끄라는 설정(NO_COLOR)이 있으면 그대로 둔다.
  const env = process.env.NO_COLOR ? process.env : { ...process.env, FORCE_COLOR: "1" };
  const child = spawn(file, args, { stdio: ["inherit", "pipe", "pipe"], shell: needsShell, env });
  const prefix = `${color}[${name}]\x1b[0m `;
  for (const stream of [child.stdout, child.stderr]) {
    let rest = "";
    stream.on("data", (chunk) => {
      const lines = (rest + chunk).split(/\r?\n/);
      rest = lines.pop();
      for (const line of lines) process.stdout.write(prefix + line + "\n");
    });
  }
  child.on("exit", (code) => {
    console.log(`${prefix}꺼짐 (종료 코드 ${code ?? "?"})`);
    stopAll();
  });
  return child;
});

let stopping = false;
function stopAll() {
  if (stopping) return;
  stopping = true;
  for (const child of children) {
    if (child.exitCode !== null) continue;
    // Windows 는 자식이 띄운 프로세스까지 함께 꺼야 한다.
    if (process.platform === "win32") spawnSync("taskkill", ["/pid", String(child.pid), "/t", "/f"], { stdio: "ignore" });
    else child.kill("SIGTERM");
  }
  setTimeout(() => process.exit(0), 300);
}

process.on("SIGINT", stopAll);
process.on("SIGTERM", stopAll);
