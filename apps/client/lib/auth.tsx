"use client";

import { createAuthClient } from "better-auth/react";
import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useState,
} from "react";
import { loginWithPin as loginWithPinApi } from "./api";

// In dev: use current origin (requests go to /api/* on same origin, proxied by Next.js rewrites).
// In prod: explicit API URL (e.g. https://api.prepareos.fr).
const API_URL = process.env.NEXT_PUBLIC_STORE_API_URL
  || (typeof window !== "undefined" ? window.location.origin : "http://localhost:3000");

const authClient = createAuthClient({
  baseURL: `${API_URL}/api/auth`,
});

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
  loginWithPin: (userId: string, pin: string) => Promise<void>;
  logout: () => Promise<void>;
  checkAuth: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | null>(null);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  const checkAuth = useCallback(async () => {
    try {
      const session = await authClient.getSession();
      console.log("[checkAuth] session result:", JSON.stringify(session.data, null, 2));
      if (session.data?.user) {
        setUser(session.data.user as User);
      } else {
        console.log("[checkAuth] No user in session, setting null");
        setUser(null);
      }
    } catch (err) {
      console.error("[checkAuth] Error:", err);
      setUser(null);
    } finally {
      setIsLoading(false);
    }
  }, []);

  const login = async (email: string, password: string) => {
    try {
      const result = await authClient.signIn.email({
        email,
        password,
      });
      if (result.error) {
        const status = result.error.status;
        const message =
          result.error.message ||
          (status === 429
            ? "Trop de tentatives, veuillez réessayer plus tard"
            : "Échec de la connexion");
        throw new Error(message);
      }
      await checkAuth();
    } catch (err) {
      if (err instanceof Error) throw err;
      throw new Error("Échec de la connexion");
    }
  };

  const loginWithPin = async (userId: string, pin: string) => {
    try {
      await loginWithPinApi(userId, pin);
      await checkAuth();
    } catch (err) {
      if (err instanceof Error) throw err;
      throw new Error("PIN incorrect");
    }
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
        loginWithPin,
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
