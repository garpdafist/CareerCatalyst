import { PageLayout, PageHeader, PageTitle, PageDescription, ContentSection } from "@/components/layout";
import { Button } from "@/components/ui/button";
import { Link } from "wouter";
import { motion } from "framer-motion";
import { FileText, PenTool, Target, Compass } from "lucide-react";

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
      <PageHeader>
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5 }}
        >
          <PageTitle>
            Supercharge Your Marketing Career
          </PageTitle>
          <PageDescription>
            Use our AI-powered tools to optimize your resume, discover your ideal career path, 
            and find the perfect marketing role for your skills.
          </PageDescription>
        </motion.div>
      </PageHeader>

      <ContentSection>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
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
                    <a className="block">
                      <div className="group relative overflow-hidden rounded-lg border bg-background/50 p-6 shadow-sm transition-colors hover:bg-accent hover:text-accent-foreground">
                        <div className="flex h-12 w-12 items-center justify-center rounded-full bg-primary/10 text-primary group-hover:bg-primary/20">
                          <Icon className="h-6 w-6" />
                        </div>
                        <h3 className="mt-4 text-lg font-semibold">{feature.title}</h3>
                        <p className="mt-2 text-sm text-muted-foreground">
                          {feature.description}
                        </p>
                        <div className="mt-4">
                          <Button 
                            variant="ghost" 
                            className="p-0 font-semibold text-primary hover:text-primary/80"
                          >
                            Get Started →
                          </Button>
                        </div>
                      </div>
                    </a>
                  </Link>
                ) : (
                  <div className="relative overflow-hidden rounded-lg border border-dashed bg-background/50 p-6">
                    <div className="flex h-12 w-12 items-center justify-center rounded-full bg-muted text-muted-foreground">
                      <Icon className="h-6 w-6" />
                    </div>
                    <h3 className="mt-4 text-lg font-semibold text-muted-foreground">{feature.title}</h3>
                    <p className="mt-2 text-sm text-muted-foreground/80">
                      {feature.description}
                    </p>
                    <div className="mt-4">
                      <span className="text-sm font-medium text-muted-foreground">
                        Coming Soon
                      </span>
                    </div>
                  </div>
                )}
              </motion.div>
            );
          })}
        </div>
      </ContentSection>
    </PageLayout>
  );
}