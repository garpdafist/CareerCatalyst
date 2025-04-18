import { ReactNode } from "react";
import { motion } from "framer-motion";
import { AnimatedBackground } from "./animated-background";

interface LayoutProps {
  children: ReactNode;
  className?: string;
}

export function PageLayout({ children, className }: LayoutProps) {
  return (
    <>
      <AnimatedBackground />
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ duration: 0.5 }}
        className={`min-h-screen bg-[#FFFFFF] ${className}`}
      >
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
          {children}
        </div>
      </motion.div>
    </>
  );
}

export function PageHeader({ children, className }: LayoutProps) {
  return (
    <motion.div
      initial={{ opacity: 0, y: -20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.5, delay: 0.2 }}
      className={`text-center space-y-4 mb-12 ${className}`}
    >
      {children}
    </motion.div>
  );
}

export function PageTitle({ children, className }: LayoutProps) {
  return (
    <h1 className={`text-4xl md:text-5xl font-bold tracking-tight text-[#1C170D] ${className}`}>
      {children}
    </h1>
  );
}

export function PageDescription({ children, className }: LayoutProps) {
  return (
    <p className={`text-lg text-[#757575] max-w-2xl mx-auto ${className}`}>
      {children}
    </p>
  );
}

export function ContentSection({ children, className }: LayoutProps) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.5, delay: 0.3 }}
      className={`bg-[#F5F0E5] rounded-xl p-6 space-y-6 ${className}`}
    >
      {children}
    </motion.div>
  );
}