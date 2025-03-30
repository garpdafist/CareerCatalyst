import { useState, useEffect } from "react";
import { useAuth } from "@/hooks/use-auth";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { motion } from "framer-motion";
import { Redirect, useLocation } from "wouter";

export default function AuthPage() {
  const [email, setEmail] = useState("");
  const [showResend, setShowResend] = useState(false);
  const [countdown, setCountdown] = useState(60);
  const { signIn, isLoading, user } = useAuth();
  
  // Redirect authenticated users to home page
  if (user) {
    return <Redirect to="/" />;
  }

  useEffect(() => {
    let timer: NodeJS.Timeout;
    if (showResend && countdown > 0) {
      timer = setInterval(() => {
        setCountdown(prev => prev - 1);
      }, 1000);
    } else if (countdown === 0) {
      setShowResend(false);
      setCountdown(60);
    }
    return () => clearInterval(timer);
  }, [showResend, countdown]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      await signIn(email);
      setShowResend(true);
    } catch (error) {
      // Error is handled in useAuth
    }
  };

  const handleResend = async (e: React.MouseEvent) => {
    e.preventDefault();
    try {
      await signIn(email);
      setCountdown(60);
    } catch (error) {
      // Error is handled in useAuth
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-background">
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5 }}
      >
        <Card className="w-[400px]">
          <CardHeader>
            <CardTitle>Welcome to CareerAI</CardTitle>
            <CardDescription>
              Enter your email to get started
            </CardDescription>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="space-y-2">
                <Input
                  type="email"
                  placeholder="Enter your email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  required
                  disabled={isLoading}
                  className="w-full"
                />
              </div>
              <Button 
                type="submit" 
                className="w-full bg-[#009963] hover:bg-[#009963]/90" 
                disabled={isLoading}
              >
                {isLoading ? "Sending magic link..." : "Continue with Email"}
              </Button>

              {showResend && (
                <Button
                  type="button"
                  variant="outline"
                  className="w-full mt-2"
                  onClick={handleResend}
                  disabled={countdown > 0 || isLoading}
                >
                  {countdown > 0
                    ? `Resend in ${countdown}s`
                    : "Resend magic link"}
                </Button>
              )}
            </form>
            <p className="mt-4 text-center text-sm text-muted-foreground">
              We'll send you a magic link to sign in instantly
            </p>
          </CardContent>
        </Card>
      </motion.div>
    </div>
  );
}