import type { ComponentType } from "react";
import { usePath } from "./router";
import { AuthProvider, useAuth } from "./auth";
import HomePage from "./pages/HomePage";
import CharacterPage from "./pages/CharacterPage";
import LoginPage from "./pages/LoginPage";
import StoryPage from "./pages/StoryPage";
import StorySelectPage from "./pages/StorySelectPage";
import LeaderboardPage from "./pages/LeaderboardPage";
import SettingsPage from "./pages/SettingsPage";

const routes: Record<string, ComponentType> = {
  "/": HomePage,
  "/character": CharacterPage,
  "/story": StorySelectPage,
  "/leaderboard": LeaderboardPage,
  "/settings": SettingsPage,
};

const STORY_PREFIX = "/story/";

function Routes() {
  const { user, checking } = useAuth();
  // 주소 뒤의 ?쿼리는 화면 고르기에 쓰지 않는다 (예: #/leaderboard?drawing=1)
  const path = usePath().split("?")[0];

  if (checking && !user) {
    return <main className="flex min-h-screen items-center justify-center bg-sky-soft text-sm font-bold text-ink-muted">불러오는 중…</main>;
  }
  // 로그인 전에는 어떤 주소로 들어와도 로그인 화면을 보여 준다.
  if (!user) return <LoginPage />;

  if (path.startsWith(STORY_PREFIX)) {
    const sceneId = decodeURIComponent(path.slice(STORY_PREFIX.length));
    // key로 장면이 바뀌면 그리기 상태를 새로 시작한다.
    return <StoryPage key={sceneId} sceneId={sceneId} />;
  }
  const Page = routes[path] ?? HomePage;
  return <Page />;
}

export default function App() {
  return (
    <AuthProvider>
      <Routes />
    </AuthProvider>
  );
}
