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
