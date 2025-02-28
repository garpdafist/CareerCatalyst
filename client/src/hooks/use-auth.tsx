import { createContext, ReactNode, useContext } from "react";
import { User } from "@supabase/supabase-js";
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
  // For testing: Create a mock user that matches Supabase User structure
  const mockUser: User = {
    id: "test-user-123",
    app_metadata: {},
    user_metadata: {},
    aud: "authenticated",
    created_at: new Date().toISOString(),
    email: "test@example.com",
    role: "authenticated",
    updated_at: new Date().toISOString()
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