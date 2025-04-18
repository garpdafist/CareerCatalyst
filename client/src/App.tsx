import { Switch, Route, useLocation } from "wouter";
import { QueryClientProvider } from "@tanstack/react-query";
import { queryClient } from "./lib/queryClient";
import { Toaster } from "@/components/ui/toaster";
import { Navbar } from "@/components/navbar";
import { AuthProvider } from "@/hooks/use-auth";
import Home from "@/pages/home";
import AuthPage from "@/pages/auth-page";
import AuthCallback from "@/pages/auth-callback";
import ResumeAnalyzer from "@/pages/resume-analyzer";
import ResumeEditor from "@/components/resume/resume-editor";
import CoverLetterGenerator from "@/pages/cover-letter-generator";
import LinkedInOptimizer from "@/pages/linkedin-optimizer";
import AllAnalyses from "@/pages/all-analyses";
import NotFound from "@/pages/not-found";
import { ProtectedRoute } from "@/components/protected-route";
import { useState, useEffect } from "react";
import { Loader2 } from "lucide-react";
import { initSupabase } from "@/lib/supabase";

function Router() {
  return (
    <Switch>
      <Route path="/auth" component={AuthPage} />
      <Route path="/auth-callback" component={AuthCallback} />
      <Route path="/" component={Home} />
      <ProtectedRoute path="/resume-analyzer" component={ResumeAnalyzer} showContentWithoutAuth={true} />
      <ProtectedRoute path="/all-analyses" component={AllAnalyses} showContentWithoutAuth={true} />
      <ProtectedRoute path="/resume-editor" component={ResumeEditor} showContentWithoutAuth={true} />
      <ProtectedRoute path="/cover-letter" component={CoverLetterGenerator} showContentWithoutAuth={true} />
      <ProtectedRoute path="/linkedin-optimizer" component={LinkedInOptimizer} showContentWithoutAuth={true} />
      <Route component={NotFound} />
    </Switch>
  );
}

function App() {
  const [isInitialized, setIsInitialized] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [location] = useLocation();

  useEffect(() => {
    initSupabase()
      .then(() => setIsInitialized(true))
      .catch((err) => setError(err.message));
  }, []);

  if (error) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <h1 className="text-2xl font-bold text-red-500 mb-2">Initialization Error</h1>
          <p className="text-gray-600">{error}</p>
        </div>
      </div>
    );
  }

  if (!isInitialized) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <QueryClientProvider client={queryClient}>
      <AuthProvider>
        {!location.startsWith('/auth') && <Navbar />}
        <main>
          <Router />
        </main>
        <Toaster />
      </AuthProvider>
    </QueryClientProvider>
  );
}

export default App;