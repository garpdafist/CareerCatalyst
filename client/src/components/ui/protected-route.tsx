import { ReactNode } from "react";
import { useAuth } from "@/hooks/use-auth";
import { Redirect } from "wouter";
import { Loader2 } from "lucide-react";

interface ProtectedRouteProps {
  children: ReactNode;
  fallbackPath?: string;
}

/**
 * A route wrapper that requires authentication.
 * If the user is not authenticated, they will be redirected to the fallback path.
 */
export function ProtectedRoute({ 
  children, 
  fallbackPath = "/auth" 
}: ProtectedRouteProps) {
  const { user, isLoading } = useAuth();

  // While checking authentication state, show loading
  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  // Redirect if not authenticated
  if (!user) {
    return <Redirect to={fallbackPath} />;
  }

  // Render children if authenticated
  return <>{children}</>;
}