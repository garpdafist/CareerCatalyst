import { Button } from "@/components/ui/button";
import { Link } from "wouter";

export default function Home() {
  return (
    <div className="min-h-[calc(100vh-4rem)] flex flex-col items-center justify-center text-center px-4">
      <h1 className="text-4xl font-bold tracking-tight sm:text-6xl bg-gradient-to-r from-primary to-primary/60 bg-clip-text text-transparent">
        Find Your Dream Job Today
      </h1>
      <p className="mt-6 text-lg leading-8 text-muted-foreground max-w-2xl">
        Browse through our curated job listings and use our smart resume analyzer to improve your chances of landing the perfect role.
      </p>
      <div className="mt-10 flex items-center justify-center gap-x-6">
        <Link href="/jobs">
          <Button size="lg">Browse Jobs</Button>
        </Link>
        <Link href="/resume-analyzer">
          <Button variant="outline" size="lg">
            Analyze Resume
          </Button>
        </Link>
      </div>
    </div>
  );
}
