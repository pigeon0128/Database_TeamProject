// 아주 작은 해시 라우터. 주소의 # 뒷부분(예: #/story)을 페이지 경로로 쓴다.
// navigate()로 이동하고, usePath()로 현재 경로를 읽어 바뀔 때마다 다시 그린다.
import { useEffect, useState } from "react";

const getPath = () => window.location.hash.replace(/^#/, "") || "/";

// The room owns its confirmation UI. Check before publishing a new route so
// listener ordering cannot unmount it before its hashchange handler runs.
let hashExitGuard: (() => boolean) | null = null;
export function guardHashChanges(check: () => boolean) {
  hashExitGuard = check;
  return () => { if (hashExitGuard === check) hashExitGuard = null; };
}

/** 지금 주소의 경로 (# 뒷부분, ?쿼리 포함) */
export const currentPath = getPath;

/** 지금 주소 ?쿼리의 값 (예: #/shop?from=... 의 from). 없으면 null */
export const queryParam = (name: string) => new URLSearchParams(getPath().split("?")[1] ?? "").get(name);

/** 앱 안 경로인지 (다른 사이트 주소로 보내지 않게) */
export const isAppPath = (path: string | null): path is string => !!path && path.startsWith("/") && !path.startsWith("//");

/** 기록을 남기지 않고 주소만 바꾼다 (화면은 다시 그리지 않는다. 뒤로 가기에 쿼리 붙은 주소가 남지 않게) */
export function replacePath(path: string) {
  history.replaceState(history.state, "", `#${path}`);
}

export function navigate(path: string) {
  window.location.hash = path;
}

export function usePath() {
  const [path, setPath] = useState(getPath);
  useEffect(() => {
    const onChange = () => {
      if (!hashExitGuard?.()) setPath(getPath());
    };
    window.addEventListener("hashchange", onChange);
    return () => window.removeEventListener("hashchange", onChange);
  }, []);
  return path;
}
