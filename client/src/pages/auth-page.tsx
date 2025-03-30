import { useState, useEffect } from "react";
import { useAuth } from "@/hooks/use-auth";
import { Card, CardContent, CardDescription, CardHeader, CardTitle, CardFooter } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { motion } from "framer-motion";
import { Redirect } from "wouter";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Label } from "@/components/ui/label";
import { Loader2 } from "lucide-react";

export default function AuthPage() {
  const [email, setEmail] = useState("");
  const [otp, setOtp] = useState("");
  const [showResend, setShowResend] = useState(false);
  const [countdown, setCountdown] = useState(60);
  const [activeTab, setActiveTab] = useState<"magic-link" | "otp">("magic-link");
  const [emailForOtp, setEmailForOtp] = useState("");
  
  const { signIn, isLoading, verifyOtp, isVerifyingOtp, user } = useAuth();
  
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
      setEmailForOtp(email); // Store email for OTP verification
      // Switch to OTP tab after sending magic link
      setActiveTab("otp");
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

  const handleVerifyOtp = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!emailForOtp) {
      // If email isn't stored (user went directly to OTP tab), use the current email field
      setEmailForOtp(email);
    }
    
    try {
      await verifyOtp(emailForOtp || email, otp);
    } catch (error) {
      // Error is handled in useAuth hook
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-background">
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5 }}
      >
        <Card className="w-[450px]">
          <CardHeader>
            <CardTitle>Welcome to CareerAI</CardTitle>
            <CardDescription>
              Sign in with email to get started
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Tabs value={activeTab} onValueChange={(value) => setActiveTab(value as "magic-link" | "otp")} className="w-full">
              <TabsList className="grid w-full grid-cols-2 mb-4">
                <TabsTrigger value="magic-link">Magic Link</TabsTrigger>
                <TabsTrigger value="otp">One-Time Password</TabsTrigger>
              </TabsList>
              
              <TabsContent value="magic-link">
                <form onSubmit={handleSubmit} className="space-y-4">
                  <div className="space-y-2">
                    <Label htmlFor="email">Email Address</Label>
                    <Input
                      id="email"
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
                    {isLoading ? (
                      <>
                        <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                        Sending magic link...
                      </>
                    ) : (
                      "Send Magic Link"
                    )}
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
              </TabsContent>
              
              <TabsContent value="otp">
                <form onSubmit={handleVerifyOtp} className="space-y-4">
                  {!emailForOtp && (
                    <div className="space-y-2">
                      <Label htmlFor="email-otp">Email Address</Label>
                      <Input
                        id="email-otp"
                        type="email"
                        placeholder="Enter your email"
                        value={email}
                        onChange={(e) => setEmail(e.target.value)}
                        required
                        disabled={isVerifyingOtp}
                        className="w-full"
                      />
                    </div>
                  )}
                  
                  <div className="space-y-2">
                    <Label htmlFor="otp">One-Time Password</Label>
                    <Input
                      id="otp"
                      type="text"
                      placeholder="Enter 6-digit code from email"
                      value={otp}
                      onChange={(e) => setOtp(e.target.value)}
                      required
                      maxLength={6}
                      disabled={isVerifyingOtp}
                      className="w-full"
                    />
                  </div>
                  
                  <Button 
                    type="submit" 
                    className="w-full bg-[#009963] hover:bg-[#009963]/90" 
                    disabled={isVerifyingOtp}
                  >
                    {isVerifyingOtp ? (
                      <>
                        <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                        Verifying...
                      </>
                    ) : (
                      "Verify & Sign In"
                    )}
                  </Button>
                  
                  {!emailForOtp && (
                    <p className="text-sm text-muted-foreground mt-2">
                      Don't have a code? <Button variant="link" className="p-0 h-auto" onClick={() => setActiveTab("magic-link")}>Request a magic link first</Button>
                    </p>
                  )}
                </form>
              </TabsContent>
            </Tabs>
          </CardContent>
          <CardFooter className="flex flex-col text-center text-sm text-muted-foreground px-8 pb-6">
            <p className="mb-2">
              {activeTab === "magic-link" 
                ? "We'll send you a magic link and OTP code to sign in securely"
                : "Enter the 6-digit code from the email we sent you"}
            </p>
            <p className="text-xs">
              Both the magic link and OTP code expire after 10 minutes for security
            </p>
          </CardFooter>
        </Card>
      </motion.div>
    </div>
  );
}