import { Link } from "wouter";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/hooks/use-auth";

export function Navbar() {
  const { user, logout } = useAuth();

  return (
    <nav className="border-b">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex justify-between h-16">
          <div className="flex">
            <Link href="/">
              <a className="flex items-center text-xl font-bold text-primary">
                CareerAI
              </a>
            </Link>
          </div>
          <div className="flex items-center space-x-4">
            <Link href="/resume-analyzer">
              <a className="inline-flex items-center px-1 pt-1 text-sm font-medium">
                Resume Analyzer
              </a>
            </Link>
            {user ? (
              <Button 
                variant="ghost" 
                onClick={() => logout()}
                className="text-sm"
              >
                Sign Out
              </Button>
            ) : (
              <Link href="/auth">
                <Button variant="ghost" className="text-sm">
                  Sign In
                </Button>
              </Link>
            )}
          </div>
        </div>
      </div>
    </nav>
  );
}