import { PageLayout } from "@/components/layout";
import { Button } from "@/components/ui/button";
import { Link } from "wouter";
import { motion } from "framer-motion";
import { FileText, PenTool, Target, Compass, ChevronRight } from "lucide-react";
import { OnboardingTour } from "@/components/onboarding-tour";

const features = [
  {
    icon: FileText,
    title: "Resume Analyzer",
    description: "Get instant AI feedback on your resume's effectiveness",
    href: "/resume-analyzer",
    enabled: true
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

export default function Home() {
  return (
    <PageLayout>
      <OnboardingTour />
      <div className="relative">
        {/* Hero Section */}
        <section className="relative overflow-hidden pt-8 md:pt-12">
          <div className="container px-4 md:px-6">
            <div className="grid gap-6 lg:grid-cols-[1fr_400px] lg:gap-12 xl:grid-cols-[1fr_600px]">
              <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.5 }}
                className="flex flex-col justify-center space-y-4"
              >
                <h1 className="text-3xl font-bold tracking-tighter sm:text-5xl xl:text-6xl/none bg-clip-text text-transparent bg-gradient-to-r from-primary via-primary to-accent">
                  Optimize Your Resume With AI
                </h1>
                <p className="max-w-[600px] text-foreground/80 md:text-xl">
                  Transform your career prospects with our AI-powered resume optimization tools. Get instant feedback, professional guidance, and create ATS-friendly resumes.
                </p>
                <div className="flex flex-col gap-3 min-[400px]:flex-row">
                  <Link href="/resume-analyzer">
                    <Button size="lg" className="w-full min-[400px]:w-auto">
                      Get Started
                      <ChevronRight className="ml-2 h-4 w-4" />
                    </Button>
                  </Link>
                  <Link href="#features">
                    <Button variant="outline" size="lg" className="w-full min-[400px]:w-auto">
                      Learn More
                    </Button>
                  </Link>
                </div>
              </motion.div>
              <motion.div
                initial={{ opacity: 0, scale: 0.96 }}
                animate={{ opacity: 1, scale: 1 }}
                transition={{ duration: 0.5, delay: 0.1 }}
                className="mx-auto aspect-square lg:aspect-video"
              >
                <div className="w-full h-full rounded-xl bg-gradient-to-br from-primary/20 via-accent/20 to-background border border-border/50 shadow-xl" />
              </motion.div>
            </div>
          </div>
        </section>

        {/* Features Section */}
        <section id="features" className="py-16 md:py-24">
          <div className="container px-4 md:px-6">
            <div className="grid gap-8 md:grid-cols-2 lg:grid-cols-4">
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
                        <a
                          className="block h-full"
                          data-tour={feature.title.toLowerCase().replace(' ', '-')}
                        >
                          <div className="relative h-full overflow-hidden rounded-lg border bg-[#F5F0E5] p-6 shadow-md transition-all duration-300">
                            <div className="flex h-12 w-12 items-center justify-center rounded-lg bg-[#009963]/10 text-[#009963]">
                              <Icon className="h-6 w-6" />
                            </div>
                            <h3 className="mt-4 text-lg font-semibold text-[#1C170D]">{feature.title}</h3>
                            <p className="mt-2 text-sm text-[#757575]">
                              {feature.description}
                            </p>
                            <div className="mt-4">
                              <Button
                                className="w-full btn-primary flex items-center justify-center gap-2"
                              >
                                Try Now
                                <ChevronRight className="h-4 w-4" />
                              </Button>
                            </div>
                          </div>
                        </a>
                      </Link>
                    ) : (
                      <div className="relative h-full overflow-hidden rounded-lg border border-dashed bg-[#F5F0E5]/50 p-6">
                        <div className="flex h-12 w-12 items-center justify-center rounded-lg bg-[#E8DECF] text-[#757575]">
                          <Icon className="h-6 w-6" />
                        </div>
                        <h3 className="mt-4 text-lg font-semibold text-[#757575]">{feature.title}</h3>
                        <p className="mt-2 text-sm text-[#757575]/80">
                          {feature.description}
                        </p>
                        <div className="mt-4">
                          <span className="text-sm font-medium text-[#757575]">
                            Coming Soon
                          </span>
                        </div>
                      </div>
                    )}
                  </motion.div>
                );
              })}
            </div>
          </div>
        </section>
      </div>
    </PageLayout>
  );
}