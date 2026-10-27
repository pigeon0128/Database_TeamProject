// 최상위 컴포넌트. 현재 주소(#/...)를 보고 어떤 페이지를 보여 줄지 고른다.
// #/story/<장면 id>는 장면 그리기, #/creatures/<생물>은 도감 생물 그리기 화면, 나머지는 routes 표대로 연결하고 모르는 주소는 메인으로 보낸다.
import { lazy, Suspense, type ComponentType } from "react";
import { usePath } from "./router";
import { AuthProvider, useAuth } from "./auth";
import HomePage from "./pages/HomePage";
import CharacterPage from "./pages/CharacterPage";
import CreatureDrawPage from "./pages/creatures/CreatureDrawPage";
import CreatureListPage from "./pages/creatures/CreatureListPage";
import LoginPage from "./pages/LoginPage";
import StoryPage from "./pages/story/StoryPage";
import StorySelectPage from "./pages/StorySelectPage";
import LeaderboardPage from "./pages/LeaderboardPage";
import SettingsPage from "./pages/SettingsPage";

const MyRoomPage = lazy(() => import("./features/myroom/MyRoomPage"));

const routes: Record<string, ComponentType> = {
  "/": HomePage,
  "/character": CharacterPage,
  "/story": StorySelectPage,
  "/leaderboard": LeaderboardPage,
  "/creatures": CreatureListPage,
  "/settings": SettingsPage,
  "/myroom": MyRoomPage,
};

const STORY_PREFIX = "/story/";
const CREATURE_PREFIX = "/creatures/";

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
  if (path.startsWith(CREATURE_PREFIX)) {
    const slug = decodeURIComponent(path.slice(CREATURE_PREFIX.length));
    return <CreatureDrawPage key={slug} slug={slug} />;
  }
  const Page = routes[path] ?? HomePage;
  return (
    <Suspense fallback={<main className="flex min-h-screen items-center justify-center bg-sky-soft text-sm text-ink-muted">마이룸을 준비하고 있어요…</main>}>
      <Page />
    </Suspense>
  );
}

export default function App() {
  return (
    <AuthProvider>
      <Routes />
    </AuthProvider>
  );
}
