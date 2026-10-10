// 아주 작은 해시 라우터. 주소의 # 뒷부분(예: #/story)을 페이지 경로로 쓴다.
// navigate()로 이동하고, usePath()로 현재 경로를 읽어 바뀔 때마다 다시 그린다.
import { useEffect, useState } from "react";

const getPath = () => window.location.hash.replace(/^#/, "") || "/";

export function navigate(path: string) {
  window.location.hash = path;
}

export function usePath() {
  const [path, setPath] = useState(getPath);
  useEffect(() => {
    const onChange = () => setPath(getPath());
    window.addEventListener("hashchange", onChange);
    return () => window.removeEventListener("hashchange", onChange);
  }, []);
  return path;
}
