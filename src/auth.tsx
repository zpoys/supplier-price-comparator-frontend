import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";
import { Navigate, Outlet, useLocation } from "react-router-dom";
import { Box, Spinner, Text, VStack } from "@chakra-ui/react";
import { clearAllCache, post, request } from "./api";

export type AuthUser = { username: string };

type AuthContextValue = {
  user: AuthUser | null;
  checking: boolean;
  login: (username: string, password: string) => Promise<void>;
  logout: () => Promise<void>;
  refreshSession: () => Promise<AuthUser>;
};

const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<AuthUser | null>(null);
  const [checking, setChecking] = useState(true);

  const refreshSession = useCallback(async () => {
    const me = await request<AuthUser>("/me", { cache: "no-store" });
    if (!me || typeof me.username !== "string") {
      throw new Error("Respons session dari server tidak valid.");
    }
    setUser(me);
    return me;
  }, []);

  useEffect(() => {
    let mounted = true;

    const validate = async () => {
      try {
        const me = await request<AuthUser>("/me", { cache: "no-store" });
        if (mounted && me && typeof me.username === "string") setUser(me);
        else if (mounted) setUser(null);
      } catch {
        if (mounted) setUser(null);
      } finally {
        if (mounted) setChecking(false);
      }
    };

    const handleUnauthorized = () => {
      clearAllCache();
      setUser(null);
      setChecking(false);
    };

    window.addEventListener("app:unauthorized", handleUnauthorized);
    void validate();

    return () => {
      mounted = false;
      window.removeEventListener("app:unauthorized", handleUnauthorized);
    };
  }, []);

  const login = useCallback(
    async (username: string, password: string) => {
      await post("/auth/login", { username: username.trim(), password });
      clearAllCache();
      await refreshSession();
    },
    [refreshSession],
  );

  const logout = useCallback(async () => {
    try {
      await post("/auth/logout");
    } finally {
      clearAllCache();
      setUser(null);
    }
  }, []);

  const value = useMemo(
    () => ({ user, checking, login, logout, refreshSession }),
    [user, checking, login, logout, refreshSession],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context)
    throw new Error("useAuth harus digunakan di dalam AuthProvider.");
  return context;
}

function AuthLoading() {
  return (
    <Box minH="100vh" display="grid" placeItems="center">
      <VStack spacing={3}>
        <Spinner color="brand.500" size="lg" />
        <Text color="gray.500" fontSize="sm">
          Memeriksa session...
        </Text>
      </VStack>
    </Box>
  );
}

export function RequireAuth() {
  const { user, checking } = useAuth();
  const location = useLocation();

  if (checking) return <AuthLoading />;
  if (!user) return <Navigate to="/login" replace state={{ from: location }} />;
  return <Outlet />;
}

export function GuestOnly({ children }: { children: ReactNode }) {
  const { user, checking } = useAuth();
  if (checking) return <AuthLoading />;
  if (user) return <Navigate to="/" replace />;
  return <>{children}</>;
}
