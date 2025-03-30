import { useState, useEffect } from "react";
import { useAuth } from "@/hooks/use-auth";
import { Card, CardContent, CardDescription, CardHeader, CardTitle, CardFooter } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { motion } from "framer-motion";
import { Redirect } from "wouter";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Label } from "@/components/ui/label";
import { Loader2, Mail, ShieldCheck, Clock, ArrowRight } from "lucide-react";
import { AnimatedBackground } from "@/components/animated-background";
import { OtpInput } from "@/components/ui/otp-input";

export default function AuthPage() {
  const [email, setEmail] = useState("");
  const [otp, setOtp] = useState("");
  const [showResend, setShowResend] = useState(false);
  const [countdown, setCountdown] = useState(60);
  const [activeTab, setActiveTab] = useState<"magic-link" | "otp">("magic-link");
  const [emailForOtp, setEmailForOtp] = useState("");
  
  const { signIn, isLoading, verifyOtp, isVerifyingOtp, user } = useAuth();
  
  // Use useEffect for timer management
  useEffect(() => {
    let timer: NodeJS.Timeout | undefined;
    if (showResend && countdown > 0) {
      timer = setInterval(() => {
        setCountdown(prev => prev - 1);
      }, 1000);
    } else if (countdown === 0) {
      setShowResend(false);
      setCountdown(60);
    }
    return () => {
      if (timer) clearInterval(timer);
    };
  }, [showResend, countdown]);
  
  // Redirect authenticated users to home page
  if (user) {
    return <Redirect to="/" />;
  }

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
    <div className="min-h-screen flex items-center justify-center bg-[#f8f5ee] relative overflow-hidden">
      {/* Animated background */}
      <AnimatedBackground />
      
      {/* Content container */}
      <div className="container px-4 py-16 md:py-24 flex flex-col lg:flex-row max-w-6xl mx-auto gap-8 lg:gap-16 items-center">
        {/* Hero section (left on desktop, top on mobile) */}
        <motion.div 
          className="w-full lg:w-1/2 flex flex-col text-center lg:text-left space-y-6 mb-8 lg:mb-0"
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6 }}
        >
          <h1 className="text-4xl md:text-5xl font-bold tracking-tight text-[#292929] leading-tight">
            Enhance your career with <span className="bg-gradient-to-r from-[#009963] to-emerald-600 bg-clip-text text-transparent">AI-powered</span> insights
          </h1>
          <p className="text-lg text-muted-foreground max-w-xl mx-auto lg:mx-0">
            CareerAI helps you optimize your resume, craft compelling cover letters, and improve your job application success rate.
          </p>
          
          <div className="flex flex-col space-y-4 mt-4">
            <div className="flex items-center space-x-3 p-3 bg-white/50 rounded-lg backdrop-blur-sm">
              <div className="bg-[#e8f5e9] p-2 rounded-full">
                <ShieldCheck className="h-5 w-5 text-[#2e7d32]" />
              </div>
              <div className="text-sm text-left">
                Secure passwordless login with magic links and one-time codes
              </div>
            </div>
            
            <div className="flex items-center space-x-3 p-3 bg-white/50 rounded-lg backdrop-blur-sm">
              <div className="bg-[#e8f5e9] p-2 rounded-full">
                <Mail className="h-5 w-5 text-[#2e7d32]" />
              </div>
              <div className="text-sm text-left">
                Get personalized career advice delivered to your inbox
              </div>
            </div>
          </div>
        </motion.div>
        
        {/* Auth form (right on desktop, bottom on mobile) */}
        <motion.div
          className="w-full lg:w-1/2"
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5, delay: 0.2 }}
        >
          <Card className="w-full max-w-md mx-auto bg-white/90 backdrop-blur-sm shadow-md border-none">
            <CardHeader className="space-y-3 pb-5">
              <CardTitle className="text-2xl font-bold text-center text-[#292929]">
                Welcome to CareerAI
              </CardTitle>
              <CardDescription className="text-center text-base">
                Sign in with your email to get started
              </CardDescription>
            </CardHeader>
            
            <CardContent>
              <Tabs 
                value={activeTab} 
                onValueChange={(value) => setActiveTab(value as "magic-link" | "otp")} 
                className="w-full"
              >
                <TabsList className="grid w-full grid-cols-2 mb-6 bg-[#f2efe5]/40">
                  <TabsTrigger 
                    value="magic-link"
                    className="data-[state=active]:bg-[#e8f5e9] data-[state=active]:text-[#2e7d32] data-[state=active]:shadow-sm py-2.5"
                  >
                    Magic Link
                  </TabsTrigger>
                  <TabsTrigger 
                    value="otp"
                    className="data-[state=active]:bg-[#e8f5e9] data-[state=active]:text-[#2e7d32] data-[state=active]:shadow-sm py-2.5"
                  >
                    One-Time Password
                  </TabsTrigger>
                </TabsList>
                
                <TabsContent value="magic-link">
                  <form onSubmit={handleSubmit} className="space-y-5">
                    <div className="space-y-3">
                      <Label htmlFor="email" className="text-sm font-medium">
                        Email Address
                      </Label>
                      <Input
                        id="email"
                        type="email"
                        placeholder="Enter your email"
                        value={email}
                        onChange={(e) => setEmail(e.target.value)}
                        required
                        disabled={isLoading}
                        className="w-full bg-white py-6 px-4 border border-[#e5e5e5] placeholder:text-muted-foreground/60 focus:border-[#009963]"
                      />
                    </div>
                    
                    <Button 
                      type="submit" 
                      className="w-full h-12 bg-[#009963] hover:bg-[#008955] transition-all duration-200 shadow-sm hover:shadow-md rounded-md text-white font-medium" 
                      disabled={isLoading}
                    >
                      {isLoading ? (
                        <>
                          <Loader2 className="mr-2 h-5 w-5 animate-spin" />
                          Sending magic link...
                        </>
                      ) : (
                        <>
                          Send Magic Link
                          <ArrowRight className="ml-2 h-4 w-4" />
                        </>
                      )}
                    </Button>

                    {showResend && (
                      <Button
                        type="button"
                        variant="outline"
                        className="w-full mt-2 border-[#e5e5e5] hover:bg-[#f2efe5]/30 hover:text-[#009963]"
                        onClick={handleResend}
                        disabled={countdown > 0 || isLoading}
                      >
                        {countdown > 0 ? (
                          <div className="flex items-center">
                            <Clock className="mr-2 h-4 w-4" />
                            Resend in {countdown}s
                          </div>
                        ) : (
                          "Resend magic link"
                        )}
                      </Button>
                    )}
                  </form>
                </TabsContent>
                
                <TabsContent value="otp">
                  <form onSubmit={handleVerifyOtp} className="space-y-5">
                    {!emailForOtp && (
                      <div className="space-y-3">
                        <Label htmlFor="email-otp" className="text-sm font-medium">
                          Email Address
                        </Label>
                        <Input
                          id="email-otp"
                          type="email"
                          placeholder="Enter your email"
                          value={email}
                          onChange={(e) => setEmail(e.target.value)}
                          required
                          disabled={isVerifyingOtp}
                          className="w-full bg-white py-6 px-4 border border-[#e5e5e5] placeholder:text-muted-foreground/60 focus:border-[#009963]"
                        />
                      </div>
                    )}
                    
                    <div className="space-y-3">
                      <Label htmlFor="otp" className="text-sm font-medium">
                        One-Time Password
                      </Label>
                      
                      {/* Custom OTP input component */}
                      <OtpInput
                        value={otp}
                        onChange={setOtp}
                        length={6}
                        disabled={isVerifyingOtp}
                        className="py-2"
                        inputClassName="bg-white border-[#e5e5e5] focus:border-[#009963]"
                      />
                    </div>
                    
                    <Button 
                      type="submit" 
                      className="w-full h-12 bg-[#009963] hover:bg-[#008955] transition-all duration-200 shadow-sm hover:shadow-md rounded-md text-white font-medium" 
                      disabled={isVerifyingOtp}
                    >
                      {isVerifyingOtp ? (
                        <>
                          <Loader2 className="mr-2 h-5 w-5 animate-spin" />
                          Verifying...
                        </>
                      ) : (
                        <>
                          Verify & Sign In
                          <ArrowRight className="ml-2 h-4 w-4" />
                        </>
                      )}
                    </Button>
                    
                    {!emailForOtp && (
                      <p className="text-sm text-muted-foreground mt-2 text-center">
                        Don't have a code? <Button variant="link" className="p-0 h-auto text-[#009963] hover:text-[#008955]" onClick={() => setActiveTab("magic-link")}>Request a magic link first</Button>
                      </p>
                    )}
                  </form>
                </TabsContent>
              </Tabs>
            </CardContent>
            
            <CardFooter className="flex flex-col text-center text-sm text-muted-foreground px-8 pb-6 pt-1 border-t border-[#e5e5e5]/50">
              <div className="flex items-center justify-center mb-2 space-x-2">
                <Clock className="h-4 w-4 text-muted-foreground/70" />
                <p>
                  {activeTab === "magic-link" 
                    ? "We'll send you a magic link and OTP code to sign in securely"
                    : "Enter the 6-digit code from the email we sent you"}
                </p>
              </div>
              <p className="text-xs text-muted-foreground/70">
                Both the magic link and OTP code expire after 10 minutes for security
              </p>
            </CardFooter>
          </Card>
        </motion.div>
      </div>
    </div>
  );
}