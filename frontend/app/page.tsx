"use client";

import Link from 'next/link';
import Navbar from '../components/layout/Navbar';
import { useEffect, useState } from 'react';

export default function Home() {
  const [mousePosition, setMousePosition] = useState({ x: 0, y: 0 });
  const [isVisible, setIsVisible] = useState(false);

  useEffect(() => {
    // Fade in animation
    setIsVisible(true);

    // Track mouse for subtle parallax effects
    const handleMouseMove = (e: MouseEvent) => {
      setMousePosition({
        x: (e.clientX / window.innerWidth) * 100,
        y: (e.clientY / window.innerHeight) * 100,
      });
    };

    window.addEventListener('mousemove', handleMouseMove);
    return () => window.removeEventListener('mousemove', handleMouseMove);
  }, []);

  return (
    <div className="bg-gradient-to-br flex flex-col min-h-screen from-blue-50 via-white to-cyan-50 dark:from-gray-900 dark:via-gray-800 dark:to-blue-900 relative overflow-hidden transition-colors duration-300">
      {/* Background decorative elements */}
      <div className="absolute inset-0 overflow-hidden">
        <div className="absolute -top-40 -right-40 w-80 h-80 bg-blue-800/30 rounded-full mix-blend-multiply filter blur-xl opacity-70 animate-blob"></div>
        <div className="absolute -bottom-40 -left-40 w-80 h-80 bg-cyan-800/30 rounded-full mix-blend-multiply filter blur-xl opacity-70 animate-blob animation-delay-2000"></div>
        <div className="absolute top-40 left-40 w-80 h-80 bg-teal-800/30 rounded-full mix-blend-multiply filter blur-xl opacity-70 animate-blob animation-delay-4000"></div>
        <div className="absolute top-1/2 right-1/4 w-60 h-60 bg-purple-800/30 rounded-full mix-blend-multiply filter blur-xl opacity-50 animate-blob animation-delay-6000"></div>
      </div>
      
      {/* Floating particles effect */}
      <div className="fixed inset-0 z-1 pointer-events-none opacity-30">
        {[...Array(4)].map((_, i) => (
          <div
            key={i}
            className="absolute w-1 h-1 bg-blue-400/40 dark:bg-blue-300/30 rounded-full animate-pulse"
            style={{
              left: `${25 + i * 20}%`,
              top: `${40 + i * 8}%`,
              animationDelay: `${i * 0.8}s`,
              transform: `translate(${mousePosition.x * 0.01}px, ${mousePosition.y * 0.01}px)`,
              transition: 'transform 0.2s ease-out',
            }}
          />
        ))}
      </div>
      <Navbar />
      
      <main className="flex-grow relative z-10 flex items-center justify-center">
        {/* Hero Section */}
        <section 
          className={`py-20 w-full transition-all duration-1000 ease-out ${
            isVisible ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-8'
          }`}
        >
          <div className="container mx-auto px-6 md:px-8 text-center">
            {/* Main Heading with Enhanced Typography */}
            <div className="mb-8">
              <h1 className="text-5xl md:text-7xl font-bold mb-4 bg-gradient-to-r from-blue-600 to-cyan-600 dark:from-blue-400 dark:to-cyan-400 bg-clip-text text-transparent leading-tight">
                SonarCare
              </h1>
              <div className="w-24 h-1 bg-gradient-to-r from-blue-500 to-cyan-500 dark:from-blue-400 dark:to-cyan-400 mx-auto mb-6 rounded-full" />
              <p className="text-2xl md:text-3xl font-light text-gray-700 dark:text-gray-200 mb-2">
                Medical AI Assistant
              </p>
              <p className="text-lg md:text-xl text-gray-600 dark:text-gray-300 max-w-2xl mx-auto leading-relaxed">
                Access reliable medical information powered by advanced AI and grounded by Perplexity Sonar technology
              </p>
            </div>

            {/* Call to Action Buttons */}
            <div className="flex flex-col sm:flex-row gap-4 justify-center items-center mb-12">
              <Link 
                href="/chat"
                className="group relative overflow-hidden bg-gradient-to-r from-blue-600 to-purple-600 hover:from-blue-500 hover:to-purple-500 dark:from-blue-500 dark:to-purple-500 dark:hover:from-blue-400 dark:hover:to-purple-400 text-white px-8 py-4 rounded-full font-semibold text-lg transition-all duration-300 transform hover:scale-105 hover:shadow-2xl shadow-blue-500/25 dark:shadow-blue-400/25"
              >
                <span className="relative z-10">Start Consultation</span>
                <div className="absolute inset-0 bg-gradient-to-r from-white/20 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-300" />
              </Link>
            </div>

            {/* Feature Cards */}
            <div className="grid md:grid-cols-3 gap-6 max-w-5xl mx-auto mb-12">
              {[
                {
                  title: "AI-Powered Analysis",
                  description: "Advanced medical AI provides comprehensive health insights",
                  icon: "🧠"
                },
                {
                  title: "Real-Time Research",
                  description: "Grounded in latest medical research via Perplexity Sonar",
                  icon: "🔬"
                },
                {
                  title: "Secure & Private",
                  description: "Your health information remains completely confidential",
                  icon: "🔒"
                }
              ].map((feature, index) => (
                <div
                  key={index}
                  className={`group backdrop-blur-sm bg-white/80 hover:bg-white/90 dark:bg-gray-800/80 dark:hover:bg-gray-800/90 border border-white/20 hover:border-gray-300/50 dark:border-gray-700/50 dark:hover:border-gray-600/70 p-6 rounded-2xl transition-all duration-300 hover:transform hover:scale-105 shadow-lg dark:shadow-blue-500/10 hover:shadow-xl dark:hover:shadow-blue-500/20 ${
                    isVisible ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-4'
                  }`}
                  style={{
                    transitionDelay: `${index * 200}ms`,
                    transform: `translateY(${mousePosition.y * 0.01}px)`,
                  }}
                >
                  <div className="text-4xl mb-4 group-hover:scale-110 transition-transform duration-300">
                    {feature.icon}
                  </div>
                  <h3 className="text-xl font-semibold mb-3 text-gray-900 dark:text-white">
                    {feature.title}
                  </h3>
                  <p className="text-gray-600 dark:text-gray-300 leading-relaxed">
                    {feature.description}
                  </p>
                </div>
              ))}
            </div>
          </div>
        </section>
      </main>
      
      {/* Enhanced Footer */}
      <footer className="relative z-10 backdrop-blur-sm bg-white/60 dark:bg-gray-800/60 border-t border-gray-200/50 dark:border-gray-700/50">
        <div className="container mx-auto px-6 md:px-8 py-8">
          <div className="flex flex-col md:flex-row justify-between items-center">            
            {/* <div className="flex flex-col md:flex-row items-center gap-4"> */}
              <div className="text-center md:text-right">
                <p className="text-gray-600 dark:text-gray-300 text-sm">
                  Powered by <span className="text-blue-500 dark:text-blue-400 font-medium">Perplexity Sonar</span> & <span className="text-cyan-500 dark:text-cyan-400 font-medium">LangGraph</span>
                </p>
              </div>
            {/* </div> */}
          </div>
        </div>
      </footer>

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
        .animation-delay-6000 {
          animation-delay: 6s;
        }
      `}</style>
    </div>
  );
}