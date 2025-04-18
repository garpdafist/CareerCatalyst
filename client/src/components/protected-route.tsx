import { useAuth } from "@/hooks/use-auth";
import { Loader2, Lock } from "lucide-react";
import { Route, useLocation } from "wouter";
import { Card, CardContent, CardDescription, CardHeader, CardTitle, CardFooter } from "@/components/ui/card";
import { Button } from "@/components/ui/button";

export function ProtectedRoute({
  path,
  component: Component,
  showContentWithoutAuth = false,
}: {
  path: string;
  component: () => React.JSX.Element;
  showContentWithoutAuth?: boolean;
}) {
  const { user, isLoading } = useAuth();
  const [, setLocation] = useLocation();

  if (isLoading) {
    return (
      <Route path={path}>
        <div className="flex items-center justify-center min-h-screen">
          <Loader2 className="h-8 w-8 animate-spin text-border" />
        </div>
      </Route>
    );
  }

  // If showContentWithoutAuth is true, render the component with a sign-in prompt
  if (!user && showContentWithoutAuth) {
    return (
      <Route path={path}>
        <div>
          <Component />
          <div className="fixed bottom-4 left-1/2 transform -translate-x-1/2 z-50">
            <Card className="bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60">
              <CardContent className="py-4 px-6 flex items-center gap-4">
                <div>
                  <CardTitle className="text-sm mb-1">Sign in to view results</CardTitle>
                  <CardDescription className="text-xs">Create a free account to access all features</CardDescription>
                </div>
                <Button 
                  onClick={() => setLocation("/auth")}
                  className="bg-[#009963] hover:bg-[#009963]/90"
                >
                  Sign in
                </Button>
              </CardContent>
            </Card>
          </div>
        </div>
      </Route>
    );
  }

  // If user is not authenticated and content shouldn't be shown, redirect to auth
  if (!user && !showContentWithoutAuth) {
    setLocation("/auth");
    return null;
  }

  return <Route path={path} component={Component} />;
}