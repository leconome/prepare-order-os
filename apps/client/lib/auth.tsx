"use client";

import { createAuthClient } from "better-auth/react";
import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
} from "react";

// Lazily get API URL based on current hostname
function getApiUrl(): string {
  if (typeof window === "undefined") {
    return process.env.NEXT_PUBLIC_STORE_API_URL || "http://localhost:9000";
  }

  const hostname = window.location.hostname;
  const protocol = window.location.protocol;

  if (hostname === "localhost" || hostname === "127.0.0.1") {
    return process.env.NEXT_PUBLIC_STORE_API_URL || "http://localhost:9000";
  }

  return `${protocol}//store.${hostname}`;
}

// Create auth client lazily - memoized per base URL
let cachedAuthClient: ReturnType<typeof createAuthClient> | null = null;
let cachedBaseUrl: string | null = null;

function getAuthClient() {
  const baseUrl = getApiUrl();
  if (!cachedAuthClient || cachedBaseUrl !== baseUrl) {
    cachedAuthClient = createAuthClient({
      baseURL: `${baseUrl}/api/auth`,
    });
    cachedBaseUrl = baseUrl;
  }
  return cachedAuthClient;
}

export interface User {
  id: string;
  email: string;
  name: string | null;
  role: string;
  emailVerified: boolean;
  image: string | null;
  createdAt: Date;
  updatedAt: Date;
}

interface AuthContextType {
  user: User | null;
  isLoading: boolean;
  isAuthenticated: boolean;
  login: (email: string, password: string) => Promise<void>;
  logout: () => Promise<void>;
  checkAuth: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | null>(null);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  const authClient = useMemo(() => getAuthClient(), []);

  const checkAuth = useCallback(async () => {
    try {
      const session = await authClient.getSession();
      if (session.data?.user) {
        setUser(session.data.user as User);
      } else {
        setUser(null);
      }
    } catch {
      setUser(null);
    } finally {
      setIsLoading(false);
    }
  }, [authClient]);

  const login = async (email: string, password: string) => {
    const result = await authClient.signIn.email({
      email,
      password,
    });
    if (result.error) {
      throw new Error(result.error.message || "Login failed");
    }
    await checkAuth();
  };

  const logout = async () => {
    await authClient.signOut();
    setUser(null);
  };

  useEffect(() => {
    checkAuth();
  }, [checkAuth]);

  return (
    <AuthContext.Provider
      value={{
        user,
        isLoading,
        isAuthenticated: !!user,
        login,
        logout,
        checkAuth,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error("useAuth must be used within an AuthProvider");
  }
  return context;
}
