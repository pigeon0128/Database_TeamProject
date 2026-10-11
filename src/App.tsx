// 최상위 컴포넌트. 현재 주소(#/...)를 보고 어떤 페이지를 보여 줄지 고른다.
// #/story/<장면 id>는 해당 장면의 그리기 화면, 나머지는 routes 표대로 연결하고 모르는 주소는 메인으로 보낸다.
import type { ComponentType } from "react";
import { usePath } from "./router";
import HomePage from "./pages/HomePage";
import CharacterPage from "./pages/CharacterPage";
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

export default function App() {
  const path = usePath();
  if (path.startsWith(STORY_PREFIX)) {
    const sceneId = decodeURIComponent(path.slice(STORY_PREFIX.length));
    // key로 장면이 바뀌면 그리기 상태를 새로 시작한다.
    return <StoryPage key={sceneId} sceneId={sceneId} />;
  }
  const Page = routes[path] ?? HomePage;
  return <Page />;
}
