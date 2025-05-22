"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import AuthForm from "../../../components/auth/AuthForm";
import Link from "next/link";
import { useAuth } from "../../../hooks/useAuth";

export default function SignupPage() {
  const { currentUser, loading } = useAuth();
  const router = useRouter();

  // Redirect if already logged in
  useEffect(() => {
    if (currentUser && !loading) {
      router.push("/dashboard");
    }
  }, [currentUser, loading, router]);

  // Don't render anything while checking auth state
  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-gradient-to-br from-emerald-50 via-white to-teal-50 dark:from-gray-900 dark:via-gray-800 dark:to-emerald-900 transition-colors duration-300">
        <div className="relative">
          <div className="w-16 h-16 border-4 border-emerald-200 dark:border-emerald-700 rounded-full animate-spin border-t-emerald-500 dark:border-t-emerald-400"></div>
          <div className="absolute inset-0 w-16 h-16 border-4 border-transparent rounded-full animate-pulse border-t-teal-300 dark:border-t-teal-500"></div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-emerald-50 via-white to-teal-50 dark:from-gray-900 dark:via-gray-800 dark:to-emerald-900 relative overflow-hidden transition-colors duration-300">
      {/* Background decorative elements */}
      <div className="absolute inset-0 overflow-hidden">
        <div className="absolute -top-40 -right-40 w-80 h-80 bg-emerald-100 dark:bg-emerald-800/30 rounded-full mix-blend-multiply dark:mix-blend-screen filter blur-xl opacity-70 animate-blob"></div>
        <div className="absolute -bottom-40 -left-40 w-80 h-80 bg-teal-100 dark:bg-teal-800/30 rounded-full mix-blend-multiply dark:mix-blend-screen filter blur-xl opacity-70 animate-blob animation-delay-2000"></div>
        <div className="absolute top-40 left-40 w-80 h-80 bg-cyan-100 dark:bg-cyan-800/30 rounded-full mix-blend-multiply dark:mix-blend-screen filter blur-xl opacity-70 animate-blob animation-delay-4000"></div>
      </div>

      <div className="relative flex min-h-screen flex-col">
        <div className="flex-1 flex items-center justify-center py-12 px-4 sm:px-6 lg:px-8">
          <div className="w-full max-w-md">
            {/* Logo and Header Section */}
            <div className="text-center mb-10">
              <Link href="/" className="inline-flex items-center group">
                <div className="relative">
                  <svg
                    className="h-8 w-8 text-blue-500"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="2"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  >
                    <circle cx="12" cy="12" r="10" />
                    <path d="M8 14s1.5 2 4 2 4-2 4-2" />
                    <line x1="9" y1="9" x2="9.01" y2="9" />
                    <line x1="15" y1="9" x2="15.01" y2="9" />
                  </svg>
                  <div className="absolute inset-0 bg-emerald-500 dark:bg-emerald-400 rounded-full blur-md opacity-20 group-hover:opacity-30 transition-opacity duration-200"></div>
                </div>
                <span className="ml-3 text-3xl font-bold bg-gradient-to-r from-blue-600 to-cyan-600 dark:from-blue-400 dark:to-cyan-400 bg-clip-text text-transparent">
                  SonarCare
                </span>
              </Link>

              {/* <div className="mt-8 space-y-2">
                <h2 className="text-3xl font-bold text-gray-900 dark:text-white tracking-tight">
                  Join SonarCare
                </h2>
              </div> */}
            </div>

            {/* Auth Form Container */}
            <div className="bg-white/80 dark:bg-gray-800/80 backdrop-blur-sm shadow-2xl dark:shadow-emerald-500/10 rounded-2xl p-8 border border-white/20 dark:border-gray-700/50 transition-all duration-300">
              <AuthForm defaultMode="signup" />

              {/* <div className="mt-6 text-center">
                <p className="cursor-pointer text-sm text-gray-600 dark:text-gray-300">
                  Already have an account?{" "}
                  <Link
                    href="/login"
                    className="font-semibold text-emerald-600 dark:text-emerald-400 hover:text-emerald-700 dark:hover:text-emerald-300 transition-colors duration-200 hover:underline"
                  >
                    Sign in here
                  </Link>
                </p>
              </div> */}
            </div>

            {/* Footer Navigation */}
            <div className="mt-8 text-center space-y-4">
              <Link
                href="/"
                className="inline-flex items-center px-6 py-3 text-sm font-medium text-gray-700 dark:text-gray-200 bg-white/60 dark:bg-gray-800/60 backdrop-blur-sm border border-gray-200/50 dark:border-gray-600/50 rounded-full hover:bg-white/80 dark:hover:bg-gray-700/80 hover:border-gray-300 dark:hover:border-gray-500 hover:shadow-lg dark:hover:shadow-emerald-500/20 transition-all duration-200 group relative"
              >
                <svg
                  className="w-4 h-4 mr-2 group-hover:-translate-x-1 transition-transform duration-200"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth="2"
                    d="M10 19l-7-7m0 0l7-7m-7 7h18"
                  />
                </svg>
                <span>Back to home</span>
                <div className="absolute inset-0 rounded-full bg-gradient-to-r from-emerald-500/10 to-teal-500/10 dark:from-emerald-400/10 dark:to-teal-400/10 opacity-0 group-hover:opacity-100 transition-opacity duration-200 -z-10"></div>
              </Link>
            </div>
          </div>
        </div>
      </div>

      <style jsx>{`
        @keyframes blob {
          0% {
            transform: translate(0px, 0px) scale(1);
          }
          33% {
            transform: translate(30px, -50px) scale(1.1);
          }
          66% {
            transform: translate(-20px, 20px) scale(0.9);
          }
          100% {
            transform: translate(0px, 0px) scale(1);
          }
        }
        .animate-blob {
          animation: blob 7s infinite;
        }
        .animation-delay-2000 {
          animation-delay: 2s;
        }
        .animation-delay-4000 {
          animation-delay: 4s;
        }
      `}</style>
    </div>
  );
}
