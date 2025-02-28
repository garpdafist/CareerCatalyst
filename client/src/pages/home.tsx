import { Button } from "@/components/ui/button";
import { Link } from "wouter";

export default function Home() {
  return (
    <div className="min-h-[calc(100vh-4rem)] flex flex-col items-center justify-center text-center px-4">
      <h1 className="text-4xl font-bold tracking-tight sm:text-6xl bg-gradient-to-r from-primary to-primary/60 bg-clip-text text-transparent">
        Supercharge Your Marketing Career
      </h1>
      <p className="mt-6 text-lg leading-8 text-muted-foreground max-w-2xl">
        Use our AI-powered tools to optimize your resume, discover your ideal career path, and find the perfect marketing role for your skills.
      </p>
      <div className="mt-10 flex items-center justify-center gap-x-6">
        <Link href="/resume-analyzer">
          <Button size="lg">Analyze Resume</Button>
        </Link>
        <Button variant="outline" size="lg" disabled>
          Role Fit (Coming Soon)
        </Button>
        <Button variant="outline" size="lg" disabled>
          Career Path (Coming Soon)
        </Button>
      </div>
    </div>
  );
}