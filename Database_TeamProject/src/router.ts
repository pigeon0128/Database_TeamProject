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
