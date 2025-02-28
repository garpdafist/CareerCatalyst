import { createContext, ReactNode, useContext, useEffect, useState } from "react";
import { User } from "@supabase/supabase-js";
import { supabase } from "@/lib/supabase";
import { useToast } from "@/hooks/use-toast";

type AuthContextType = {
  user: User | null;
  isLoading: boolean;
  signIn: (email: string) => Promise<void>;
  signOut: () => Promise<void>;
  signInWithGoogle: () => Promise<void>;
};

export const AuthContext = createContext<AuthContextType | null>(null);

// Modify the hook to provide a mock user for testing
export function AuthProvider({ children }: { children: ReactNode }) {
  // For testing: Always return a mock authenticated user
  const mockUser = {
    id: "test-user-123",
    email: "test@example.com",
    emailVerified: new Date(),
    lastLoginAt: new Date(),
    createdAt: new Date(),
    updatedAt: new Date()
  };

  return (
    <AuthContext.Provider
      value={{
        user: mockUser,
        isLoading: false,
        signIn: async () => {},
        signOut: async () => {},
        signInWithGoogle: async () => {},
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