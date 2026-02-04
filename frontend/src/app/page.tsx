import Link from "next/link";
import { ArrowRight, BarChart3, Shield, Zap, FileText } from "lucide-react";
import { ThemeToggle } from "@/components/ui/ThemeToggle";

export default function LandingPage() {
  return (
    <div className="min-h-screen bg-gradient-to-b from-white to-gray-1 dark:from-gray-dark dark:to-dark-bg">
      {/* Header */}
      <header className="border-b border-stroke bg-white/80 backdrop-blur-sm dark:border-stroke-dark dark:bg-gray-dark/80">
        <div className="mx-auto max-w-7xl px-4 py-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <div className="flex h-10 w-10 items-center justify-center rounded-full bg-primary">
                <span className="text-xl font-bold text-white">F</span>
              </div>
              <span className="text-xl font-bold text-dark dark:text-white">
                Finance App
              </span>
            </div>
            <div className="flex items-center gap-4">
              <ThemeToggle />
              <Link
                href="/login"
                className="text-sm font-medium text-dark-5 hover:text-primary dark:text-dark-6 dark:hover:text-primary"
              >
                Login
              </Link>
              <Link
                href="/register"
                className="rounded-lg bg-primary px-4 py-2 text-sm font-medium text-white hover:bg-primary/90"
              >
                Sign Up
              </Link>
            </div>
          </div>
        </div>
      </header>

      {/* Hero Section */}
      <section className="mx-auto max-w-7xl px-4 pt-20">
        <div className="text-center">
          <h1 className="text-5xl font-bold text-dark dark:text-white sm:text-6xl lg:text-7xl">
            Take Control of Your <span className="text-primary">Finances</span>
          </h1>
          <div className="mt-10 flex items-center justify-center gap-4">
            <Link
              href="/register"
              className="flex items-center gap-2 rounded-lg bg-primary px-6 py-3 text-base font-medium text-white hover:bg-primary/90"
            >
              Sign Up
            </Link>
            <Link
              href="/login"
              className="rounded-lg border-2 border-stroke bg-white px-6 py-3 text-base font-medium text-dark hover:bg-gray-2 dark:border-stroke-dark dark:bg-gray-dark dark:text-white dark:hover:bg-dark-2"
            >
              Sign In
            </Link>
          </div>
        </div>
      </section>

      {/* Features Section */}
      <section className="mx-auto max-w-4xl px-4 py-5">
        <div className="mt-5 grid gap-8 sm:grid-cols-1 lg:grid-cols-3">
          {/* Feature 1 */}
          <div className="rounded-lg border border-stroke bg-white p-6 shadow-card-1 dark:border-stroke-dark dark:bg-gray-dark">
            <div className="flex h-12 w-12 items-center justify-center rounded-lg bg-primary/10">
              <FileText className="h-6 w-6 text-primary" />
            </div>
            <h3 className="mt-4 text-lg font-bold text-dark dark:text-white">
              Easy Import
            </h3>
            <p className="mt-2 text-sm text-dark-5 dark:text-dark-6">
              Upload bank statements from CSV or PDF files and automatically
              parse transactions.
            </p>
          </div>

          {/* Feature 2 */}
          <div className="rounded-lg border border-stroke bg-white p-6 shadow-card-1 dark:border-stroke-dark dark:bg-gray-dark">
            <div className="flex h-12 w-12 items-center justify-center rounded-lg bg-green/10">
              <BarChart3 className="h-6 w-6 text-green" />
            </div>
            <h3 className="mt-4 text-lg font-bold text-dark dark:text-white">
              Smart Analytics
            </h3>
            <p className="mt-2 text-sm text-dark-5 dark:text-dark-6">
              Visualize your spending patterns with interactive charts and
              detailed breakdowns.
            </p>
          </div>

          {/* Feature 3 */}
          <div className="rounded-lg border border-stroke bg-white p-6 shadow-card-1 dark:border-stroke-dark dark:bg-gray-dark">
            <div className="flex h-12 w-12 items-center justify-center rounded-lg bg-red/10">
              <Zap className="h-6 w-6 text-red" />
            </div>
            <h3 className="mt-4 text-lg font-bold text-dark dark:text-white">
              Auto Categorization
            </h3>
            <p className="mt-2 text-sm text-dark-5 dark:text-dark-6">
              Automatically categorize transactions and detect duplicates to
              keep your data clean.
            </p>
          </div>
        </div>
      </section>
    </div>
  );
}
