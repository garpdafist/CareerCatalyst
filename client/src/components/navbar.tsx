import { Link } from "wouter";

export function Navbar() {
  return (
    <nav className="border-b">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex justify-between h-16">
          <div className="flex">
            <Link href="/">
              <a className="flex items-center text-xl font-bold text-primary">
                JobPortal
              </a>
            </Link>
          </div>
          <div className="flex space-x-8">
            <Link href="/jobs">
              <a className="inline-flex items-center px-1 pt-1 text-sm font-medium">
                Jobs
              </a>
            </Link>
            <Link href="/resume-analyzer">
              <a className="inline-flex items-center px-1 pt-1 text-sm font-medium">
                Resume Analyzer
              </a>
            </Link>
          </div>
        </div>
      </div>
    </nav>
  );
}
