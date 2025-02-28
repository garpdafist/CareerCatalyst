import { Switch, Route } from "wouter";
import { QueryClientProvider } from "@tanstack/react-query";
import { queryClient } from "./lib/queryClient";
import { Toaster } from "@/components/ui/toaster";
import { Navbar } from "@/components/navbar";
import { AuthProvider } from "@/hooks/use-auth";
import Home from "@/pages/home";
import Auth from "@/pages/auth";
import ResumeAnalyzer from "@/pages/resume-analyzer";
import ResumeEditor from "@/components/resume/resume-editor";
import CoverLetterGenerator from "@/pages/cover-letter-generator";
import NotFound from "@/pages/not-found";
import { ProtectedRoute } from "@/components/protected-route";
import { useState, useEffect } from "react";
import { Loader2 } from "lucide-react";
import { getSupabase } from "@/lib/supabase";

function Router() {
  return (
    <Switch>
      <Route path="/" component={Home} />
      <Route path="/auth" component={Auth} />
      <ProtectedRoute path="/resume-analyzer" component={ResumeAnalyzer} />
      <ProtectedRoute path="/resume-editor" component={ResumeEditor} />
      <ProtectedRoute path="/cover-letter" component={CoverLetterGenerator} />
      <Route component={NotFound} />
    </Switch>
  );
}

function App() {
  const [isInitialized, setIsInitialized] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    getSupabase()
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
        <Navbar />
        <main>
          <Router />
        </main>
        <Toaster />
      </AuthProvider>
    </QueryClientProvider>
  );
}

export default App;