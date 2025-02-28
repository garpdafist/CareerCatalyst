import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { useMutation } from "@tanstack/react-query";
import { useToast } from "@/hooks/use-toast";
import { apiRequest } from "@/lib/queryClient";
import { useLocation } from "wouter";
import { useAuth } from "@/hooks/use-auth";
import { queryClient } from "@/lib/queryClient";

export default function Auth() {
  const [email, setEmail] = useState("");
  const { toast } = useToast();
  const [, setLocation] = useLocation();
  const { user } = useAuth();

  // Redirect if already logged in
  if (user) {
    setLocation("/resume-analyzer");
    return null;
  }

  const loginMutation = useMutation({
    mutationFn: async (email: string) => {
      const res = await apiRequest("POST", "/api/auth/login", { email });
      return res.json();
    },
    onSuccess: (user) => {
      // Update the user data in the cache
      queryClient.setQueryData(["/api/user"], user);
      toast({
        title: "Success",
        description: "Successfully signed in. Redirecting...",
      });
      setLocation("/resume-analyzer");
    },
    onError: (error: Error) => {
      toast({
        title: "Error",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!email) {
      toast({
        title: "Error",
        description: "Please enter your email",
        variant: "destructive",
      });
      return;
    }
    loginMutation.mutate(email);
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-background">
      <div className="w-full max-w-5xl grid grid-cols-1 md:grid-cols-2 gap-8 p-4">
        <Card className="w-full">
          <CardHeader>
            <CardTitle>Sign In</CardTitle>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="space-y-2">
                <Input
                  type="email"
                  placeholder="Enter your email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  disabled={loginMutation.isPending}
                />
              </div>
              <Button
                type="submit"
                className="w-full"
                disabled={loginMutation.isPending}
              >
                {loginMutation.isPending ? "Signing in..." : "Continue with Email"}
              </Button>
            </form>
          </CardContent>
        </Card>

        <div className="hidden md:flex flex-col justify-center text-center">
          <h1 className="text-4xl font-bold tracking-tight bg-gradient-to-r from-primary to-primary/60 bg-clip-text text-transparent">
            Optimize Your Marketing Career
          </h1>
          <p className="mt-4 text-lg text-muted-foreground">
            Use our AI-powered tools to analyze and improve your resume, tailored specifically for marketing professionals.
          </p>
        </div>
      </div>
    </div>
  );
}