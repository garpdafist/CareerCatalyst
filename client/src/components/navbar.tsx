import { Link } from "wouter";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/hooks/use-auth";
import { motion } from "framer-motion";
import { FileText, User, PenTool, BriefcaseIcon, LogOut } from "lucide-react";

export function Navbar() {
  const { user, signOut } = useAuth();

  const navItems = [
    { href: "/resume-analyzer", label: "Resume Analyzer", icon: FileText },
    { href: "/resume-editor", label: "Resume Editor", icon: PenTool },
    { href: "/cover-letter", label: "Cover Letter", icon: FileText },
    { href: "/linkedin-optimizer", label: "LinkedIn Profile", icon: User }
  ];

  return (
    <motion.nav 
      initial={{ y: -20, opacity: 0 }}
      animate={{ y: 0, opacity: 1 }}
      className="border-b border-border/40 bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60 mb-16"
    >
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex justify-between h-16">
          <div className="flex items-center">
            <Link href="/">
              <a className="flex items-center text-xl font-bold text-[#1C170D] hover:text-[#1C170D]/80 transition-colors">
                CareerAI
              </a>
            </Link>
          </div>
          <div className="flex items-center space-x-1">
            {user && (
              <>
                {navItems.map((item) => {
                  const Icon = item.icon;
                  return (
                    <Link key={item.href} href={item.href}>
                      <a className="inline-flex items-center px-3 py-2 rounded-md text-sm font-medium text-[#1C170D] transition-colors hover:text-[#1C170D]/80 hover:bg-[#F5F0E5]">
                        <Icon className="h-4 w-4 mr-2" />
                        {item.label}
                      </a>
                    </Link>
                  );
                })}
              </>
            )}
            {user ? (
              <Button 
                variant="ghost" 
                onClick={() => signOut()}
                className="text-sm flex items-center gap-2 text-[#1C170D] hover:text-[#1C170D]/80 hover:bg-[#F5F0E5]"
              >
                <LogOut className="h-4 w-4" />
                Sign Out
              </Button>
            ) : (
              <Link href="/auth">
                <Button variant="default" className="text-sm">
                  Sign In
                </Button>
              </Link>
            )}
          </div>
        </div>
      </div>
    </motion.nav>
  );
}