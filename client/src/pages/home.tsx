import { PageLayout } from "@/components/layout";
import { Button } from "@/components/ui/button";
import { Link } from "wouter";
import { motion } from "framer-motion";
import { FileText, PenTool, Target, Compass, Upload, Download, Briefcase, Sparkles } from "lucide-react";
import { OnboardingTour } from "@/components/onboarding-tour";

const features = [
  {
    icon: FileText,
    title: "Resume Analyzer",
    description: "Get instant AI feedback on your resume's effectiveness",
    href: "/resume-analyzer",
    enabled: true,
    primary: true
  },
  {
    icon: PenTool,
    title: "Resume Editor",
    description: "Build an ATS-optimized resume with real-time guidance",
    href: "/resume-editor",
    enabled: true
  },
  {
    icon: Target,
    title: "Role Fit",
    description: "Find the perfect roles matching your skills and experience",
    href: "/role-fit",
    enabled: false
  },
  {
    icon: Compass,
    title: "Career Path",
    description: "Discover your ideal career progression and opportunities",
    href: "/career-path",
    enabled: false
  }
];

const steps = [
  {
    icon: Upload,
    title: "Upload Resume",
    description: "Upload your existing resume in PDF or Word format"
  },
  {
    icon: Sparkles,
    title: "Get AI Feedback",
    description: "Receive detailed analysis and suggestions"
  },
  {
    icon: Download,
    title: "Edit & Download",
    description: "Make improvements and download your optimized resume"
  },
  {
    icon: Briefcase,
    title: "Job Matching",
    description: "Find roles that match your enhanced profile"
  }
];

export default function Home() {
  return (
    <PageLayout>
      <OnboardingTour />

      {/* Hero Section */}
      <section className="relative overflow-hidden pt-16 pb-12 md:pt-20 md:pb-16">
        <div className="container px-4 md:px-6">
          <div className="grid gap-8 lg:grid-cols-[1fr_400px] lg:gap-12 xl:grid-cols-[1fr_600px]">
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.5 }}
              className="flex flex-col justify-center space-y-4"
            >
              <h1 className="text-4xl font-bold tracking-tighter sm:text-5xl xl:text-6xl/none bg-clip-text text-transparent bg-gradient-to-r from-primary via-primary to-accent">
                Optimize Your Resume With AI
              </h1>
              <p className="max-w-[600px] text-foreground/80 md:text-xl">
                Transform your career prospects with AI-powered resume optimization. Get instant feedback and create ATS-friendly resumes.
              </p>
              <div className="flex flex-col gap-3 min-[400px]:flex-row">
                <Link href="/resume-analyzer">
                  <Button size="lg" className="w-full min-[400px]:w-auto bg-primary hover:bg-primary/90">
                    Analyze My Resume
                  </Button>
                </Link>
              </div>
            </motion.div>
            <motion.div
              initial={{ opacity: 0, scale: 0.96 }}
              animate={{ opacity: 1, scale: 1 }}
              transition={{ duration: 0.5, delay: 0.1 }}
              className="hidden lg:block"
            >
              <div className="w-full h-full rounded-xl bg-gradient-to-br from-primary/20 via-accent/20 to-background border border-border/50 shadow-xl" />
            </motion.div>
          </div>
        </div>
      </section>

      {/* How It Works */}
      <section className="py-12 bg-muted/30">
        <div className="container px-4 md:px-6">
          <h2 className="text-3xl font-bold text-center mb-8">How It Works</h2>
          <div className="grid gap-6 md:grid-cols-4">
            {steps.map((step, index) => {
              const Icon = step.icon;
              return (
                <motion.div
                  key={step.title}
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ duration: 0.5, delay: index * 0.1 }}
                  className="flex flex-col items-center text-center p-4"
                >
                  <div className="h-12 w-12 rounded-full bg-primary/10 flex items-center justify-center mb-4">
                    <Icon className="h-6 w-6 text-primary" />
                  </div>
                  <h3 className="font-semibold mb-2">{step.title}</h3>
                  <p className="text-sm text-muted-foreground">{step.description}</p>
                </motion.div>
              );
            })}
          </div>
        </div>
      </section>

      {/* Features Grid */}
      <section className="py-12 md:py-16">
        <div className="container px-4 md:px-6">
          <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-4">
            {features.map((feature, index) => {
              const Icon = feature.icon;
              return (
                <motion.div
                  key={feature.title}
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ duration: 0.5, delay: index * 0.1 }}
                >
                  {feature.enabled ? (
                    <Link href={feature.href}>
                      <div 
                        className={`h-full p-6 rounded-lg border transition-all duration-300 hover:shadow-lg ${
                          feature.primary 
                            ? 'bg-primary/5 border-primary/20 hover:border-primary/30' 
                            : 'bg-card hover:border-border/80'
                        }`}
                      >
                        <div className={`h-12 w-12 rounded-lg flex items-center justify-center mb-4 ${
                          feature.primary ? 'bg-primary/10 text-primary' : 'bg-muted text-muted-foreground'
                        }`}>
                          <Icon className="h-6 w-6" />
                        </div>
                        <h3 className="text-lg font-semibold mb-2">{feature.title}</h3>
                        <p className="text-sm text-muted-foreground">
                          {feature.description}
                        </p>
                      </div>
                    </Link>
                  ) : (
                    <div className="h-full p-6 rounded-lg border border-dashed bg-muted/50">
                      <div className="h-12 w-12 rounded-lg bg-muted flex items-center justify-center mb-4">
                        <Icon className="h-6 w-6 text-muted-foreground/60" />
                      </div>
                      <h3 className="text-lg font-semibold mb-2 text-muted-foreground/80">{feature.title}</h3>
                      <p className="text-sm text-muted-foreground/60">
                        {feature.description}
                      </p>
                      <span className="inline-block mt-3 text-sm font-medium text-muted-foreground/80">
                        Coming Soon
                      </span>
                    </div>
                  )}
                </motion.div>
              );
            })}
          </div>
        </div>
      </section>
    </PageLayout>
  );
}