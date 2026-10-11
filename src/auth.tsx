// 로그인 상태. 앱을 열면 서버에 현재 로그인한 사용자를 물어보고, 로그인 전에는 로그인 화면만 보여 준다.
import { createContext, useCallback, useContext, useEffect, useState, type ReactNode } from "react";
import { api, ApiError, type User } from "./lib/api";

type AuthContextValue = {
  user: User | null;
  /** 처음 확인 중이면 true */
  checking: boolean;
  /** 서버에 연결하지 못했을 때의 안내 */
  serverError: string | null;
  login: (loginId: string, password: string) => Promise<void>;
  register: (loginId: string, password: string) => Promise<void>;
  logout: () => Promise<void>;
  /** 세션이 끝났을 때(401) 로그인 화면으로 돌려보낸다. */
  expire: () => void;
  recheck: () => void;
};

const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [checking, setChecking] = useState(true);
  const [serverError, setServerError] = useState<string | null>(null);

  const recheck = useCallback(() => {
    setChecking(true);
    api
      .me()
      .then(({ user }) => {
        setUser(user);
        setServerError(null);
      })
      .catch((e: unknown) => setServerError(e instanceof ApiError ? e.message : "서버 상태를 확인하지 못했어요."))
      .finally(() => setChecking(false));
  }, []);

  useEffect(recheck, [recheck]);

  const value: AuthContextValue = {
    user,
    checking,
    serverError,
    async login(loginId, password) {
      setUser((await api.login(loginId, password)).user);
      setServerError(null);
    },
    async register(loginId, password) {
      setUser((await api.register(loginId, password)).user);
      setServerError(null);
    },
    async logout() {
      await api.logout().catch(() => {});
      setUser(null);
    },
    expire: () => setUser(null),
    recheck,
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth 는 AuthProvider 안에서만 쓸 수 있어요.");
  return ctx;
}
