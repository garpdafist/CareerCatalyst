import { useState } from "react";
import { useAuth } from "@/hooks/use-auth";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { motion } from "framer-motion";

export default function AuthPage() {
  const [email, setEmail] = useState("");
  const { signIn, isLoading } = useAuth();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      await signIn(email);
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