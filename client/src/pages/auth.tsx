import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { useToast } from "@/hooks/use-toast";
import { useLocation } from "wouter";
import { useAuth } from "@/hooks/use-auth";
import { SiGoogle } from "react-icons/si";

export default function Auth() {
  const [email, setEmail] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const { toast } = useToast();
  const [, setLocation] = useLocation();
  const { user, signIn, signInWithGoogle } = useAuth();

  // Redirect if already logged in
  if (user) {
    setLocation("/resume-analyzer");
    return null;
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email) {
      toast({
        title: "Error",
        description: "Please enter your email",
        variant: "destructive",
      });
      return;
    }
    setIsLoading(true);
    await signIn(email);
    setIsLoading(false);
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
                  disabled={isLoading}
                />
              </div>
              <Button
                type="submit"
                className="w-full"
                disabled={isLoading}
              >
                {isLoading ? "Sending magic link..." : "Continue with Email"}
              </Button>

              <div className="relative">
                <div className="absolute inset-0 flex items-center">
                  <span className="w-full border-t" />
                </div>
                <div className="relative flex justify-center text-xs uppercase">
                  <span className="bg-background px-2 text-muted-foreground">
                    Or continue with
                  </span>
                </div>
              </div>

              <Button
                type="button"
                variant="outline"
                className="w-full"
                onClick={() => signInWithGoogle()}
                disabled={isLoading}
              >
                <SiGoogle className="mr-2 h-4 w-4" />
                Google
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