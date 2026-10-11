// API 서버와 화면(Vite)을 터미널 하나에서 같이 실행한다: pnpm dev:all
// 출력 앞에 [api] / [web] 를 붙여 구분하고, Ctrl + C 를 누르거나 한쪽이 꺼지면 둘 다 끈다.
import { spawn, spawnSync } from "node:child_process";

// 이 스크립트를 실행한 패키지 관리자(pnpm 또는 npm)로 각 스크립트를 실행한다.
const runner = process.env.npm_execpath;
if (!runner) {
  console.error("pnpm dev:all 로 실행해 주세요.");
  process.exit(1);
}

const tasks = [
  { name: "api", script: "dev:server", color: "\x1b[35m" },
  { name: "web", script: "dev", color: "\x1b[36m" },
];

const children = tasks.map(({ name, script, color }) => {
  const child = spawn(process.execPath, [runner, "run", script], { stdio: ["inherit", "pipe", "pipe"], env: { ...process.env, FORCE_COLOR: "1" } });
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
