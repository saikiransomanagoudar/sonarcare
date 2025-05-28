'use client';

import React from 'react';
import Link from 'next/link';
import { useRouter, usePathname } from 'next/navigation';
import { useAuth } from '../../hooks/useAuth';
import { signOut } from '../../lib/firebase/auth';

type User = {
  displayName: string | null;
  email: string | null;
  photoURL: string | null;
};

type AuthResult = {
  currentUser: User | null;
};

interface NavbarProps {
  onMenuClick?: () => void;
}

const Navbar: React.FC<NavbarProps> = ({ onMenuClick }) => {
  const { currentUser } = useAuth() as AuthResult;
  const router = useRouter();
  const pathname = usePathname();

  const handleSignOut = async () => {
    try {
      await signOut();
      router.push('/');
    } catch (error) {
      console.error('Error signing out:', error);
    }
  };

  return (
    <header className="bg-gradient-to-br from-blue-50 via-white to-cyan-50 dark:from-gray-900 dark:via-gray-800 dark:to-blue-900 backdrop-blur-md shadow-sm relative z-20 border-b border-gray-200/50 dark:border-gray-700/50 transition-colors duration-300">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex justify-between h-16">
          <div className="flex items-center">
            {/* Hamburger menu button - only show when user is logged in and on chat pages */}
            {currentUser && pathname.startsWith('/chat') && (
              <button
                onClick={onMenuClick}
                className="cursor-pointer md:hidden mr-3 p-2 rounded-md text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-200 hover:bg-gray-100 dark:hover:bg-gray-800 active:bg-gray-200 dark:active:bg-gray-700 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-inset transition-colors duration-150"
                aria-label="Toggle sidebar"
              >
                <svg 
                  className="h-6 w-6" 
                  fill="none" 
                  viewBox="0 0 24 24" 
                  stroke="currentColor"
                >
                  <path 
                    strokeLinecap="round" 
                    strokeLinejoin="round" 
                    strokeWidth={2} 
                    d="M4 6h16M4 12h16M4 18h16" 
                  />
                </svg>
              </button>
            )}
            
            <Link href="/" className="flex-shrink-0 flex items-center">
              <svg 
                className="h-8 w-8 text-blue-500 dark:text-blue-400" 
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
              <span className="ml-2 text-xl font-bold text-gray-800 dark:text-white">SonarCare</span>
            </Link>
            <div className="hidden md:ml-6 md:flex md:space-x-8">
              {currentUser && (
                <Link 
                  href="/chat" 
                  className={`inline-flex items-center px-1 pt-1 border-b-2 text-sm font-medium ${
                    pathname.startsWith('/chat') 
                      ? 'border-blue-500 text-gray-900 dark:text-white' 
                      : 'border-transparent text-gray-500 dark:text-gray-400 hover:border-gray-300 dark:hover:border-gray-600 hover:text-gray-700 dark:hover:text-gray-200'
                  }`}
                >
                  Chat
                </Link>
              )}
            </div>
          </div>
          <div className="flex items-center">
            {currentUser ? (
              <div className="flex items-center space-x-4">
                <div className="hidden md:flex items-center">
                  {currentUser.photoURL ? (
                    <img
                      className="h-8 w-8 rounded-full"
                      src={currentUser.photoURL}
                      alt={currentUser.displayName || 'User'}
                    />
                  ) : (
                    <div className="h-8 w-8 rounded-full bg-blue-500 dark:bg-blue-600 flex items-center justify-center text-white">
                      {(currentUser.displayName || currentUser.email || 'U').charAt(0).toUpperCase()}
                    </div>
                  )}
                  <span className="ml-2 text-sm font-medium text-gray-700 dark:text-gray-200 hidden md:block">
                    {currentUser.displayName || currentUser.email?.split('@')[0]}
                  </span>
                </div>
                <button
                  onClick={handleSignOut}
                  className="ml-2 px-3 py-1.5 cursor-pointer border border-gray-300 dark:border-gray-600 rounded-md text-sm font-medium text-gray-700 dark:text-gray-200 bg-white/80 dark:bg-gray-800/80 hover:bg-gray-50 dark:hover:bg-gray-700/80 backdrop-blur-sm transition-colors duration-150"
                >
                  Sign Out
                </button>
              </div>
            ) : (
              <div className="space-x-2">
                <Link 
                  href="/login"
                  className="px-3 py-1.5 border border-gray-300 dark:border-gray-600 rounded-md text-sm font-medium text-gray-700 dark:text-gray-200 bg-white/80 dark:bg-gray-800/80 hover:bg-gray-50 dark:hover:bg-gray-700/80 backdrop-blur-sm transition-colors duration-150"
                >
                  Sign In
                </Link>
                <Link 
                  href="/signup"
                  className="px-3 py-1.5 rounded-md text-sm font-medium text-white bg-blue-500 hover:bg-blue-600 dark:bg-blue-600 dark:hover:bg-blue-700 transition-colors duration-150"
                >
                  Sign Up
                </Link>
              </div>
            )}
          </div>
        </div>
      </div>
    </header>
  );
};

export default Navbar;