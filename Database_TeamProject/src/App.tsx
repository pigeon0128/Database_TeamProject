import type { ComponentType } from "react";
import { usePath } from "./router";
import HomePage from "./pages/HomePage";
import CharacterPage from "./pages/CharacterPage";
import StoryPage from "./pages/StoryPage";
import LeaderboardPage from "./pages/LeaderboardPage";
import SettingsPage from "./pages/SettingsPage";

const routes: Record<string, ComponentType> = {
  "/": HomePage,
  "/character": CharacterPage,
  "/story": StoryPage,
  "/leaderboard": LeaderboardPage,
  "/settings": SettingsPage,
};

export default function App() {
  const Page = routes[usePath()] ?? HomePage;
  return <Page />;
}
