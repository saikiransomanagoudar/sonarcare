import Link from 'next/link';
import Navbar from '../components/layout/Navbar';

export default function Home() {
  return (
    <div className="flex flex-col min-h-screen">
      <Navbar />
      
      <main className="flex-grow">
        {/* Hero Section */}
        <section className="bg-gradient-to-r from-blue-500 to-blue-700 text-white py-20">
          <div className="container mx-auto px-4 md:px-6 text-center">
            <h1 className="text-4xl md:text-5xl font-bold mb-6">SonarCare Medical AI Assistant</h1>
            <p className="text-xl md:text-2xl mb-8 max-w-3xl mx-auto">
              Access reliable medical information powered by advanced AI and grounded by Perplexity Sonar technology.
            </p>
            <div className="bg-yellow-100 border-l-4 border-yellow-500 text-yellow-700 p-4 mb-8 max-w-2xl mx-auto text-left">
              <p className="font-bold">Medical Disclaimer:</p>
              <p>
                Information provided by SonarCare is for general educational purposes only and is not a substitute for professional medical advice, diagnosis, or treatment. Always consult a healthcare provider.
              </p>
            </div>
          </div>
        </section>
        
        {/* Features Section */}
        <section className="py-16 bg-white">
          <div className="container mx-auto px-4 md:px-6">
            <h2 className="text-3xl font-bold text-center mb-12">Key Features</h2>
            <div className="grid md:grid-cols-3 gap-8">
              <div className="p-6 border border-gray-200 rounded-lg">
                <div className="w-12 h-12 bg-blue-100 rounded-full flex items-center justify-center mb-4">
                  <svg className="w-6 h-6 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                  </svg>
                </div>
                <h3 className="text-xl font-semibold mb-2">Reliable Information</h3>
                <p className="text-gray-600">
                  Grounded responses using Perplexity Sonar's web search capabilities to provide the most up-to-date medical information.
                </p>
              </div>
              <div className="p-6 border border-gray-200 rounded-lg">
                <div className="w-12 h-12 bg-blue-100 rounded-full flex items-center justify-center mb-4">
                  <svg className="w-6 h-6 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 6v6m0 0v6m0-6h6m-6 0H6" />
                  </svg>
                </div>
                <h3 className="text-xl font-semibold mb-2">24/7 Availability</h3>
                <p className="text-gray-600">
                  Access medical information anytime, anywhere with our AI assistant that's always available to address your questions.
                </p>
              </div>
              <div className="p-6 border border-gray-200 rounded-lg">
                <div className="w-12 h-12 bg-blue-100 rounded-full flex items-center justify-center mb-4">
                  <svg className="w-6 h-6 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
                  </svg>
                </div>
                <h3 className="text-xl font-semibold mb-2">Chat History</h3>
                <p className="text-gray-600">
                  Keep track of your previous medical discussions with secure, private chat history storage.
                </p>
              </div>
            </div>
          </div>
        </section>
        
        {/* How It Works Section */}
        <section className="py-16 bg-gray-50">
          <div className="container mx-auto px-4 md:px-6">
            <h2 className="text-3xl font-bold text-center mb-12">How It Works</h2>
            <div className="max-w-3xl mx-auto">
              <div className="flex flex-col md:flex-row items-center mb-8">
                <div className="bg-blue-100 w-12 h-12 rounded-full flex items-center justify-center text-blue-600 font-bold text-xl mr-4">
                  1
                </div>
                <div className="flex-1">
                  <h3 className="text-xl font-semibold mb-1">Ask Your Medical Question</h3>
                  <p className="text-gray-600">
                    Type your health-related question or concern in natural language.
                  </p>
                </div>
              </div>
              <div className="flex flex-col md:flex-row items-center mb-8">
                <div className="bg-blue-100 w-12 h-12 rounded-full flex items-center justify-center text-blue-600 font-bold text-xl mr-4">
                  2
                </div>
                <div className="flex-1">
                  <h3 className="text-xl font-semibold mb-1">AI-Powered Research</h3>
                  <p className="text-gray-600">
                    Our AI uses Perplexity Sonar to search for relevant medical information from trusted sources.
                  </p>
                </div>
              </div>
              <div className="flex flex-col md:flex-row items-center">
                <div className="bg-blue-100 w-12 h-12 rounded-full flex items-center justify-center text-blue-600 font-bold text-xl mr-4">
                  3
                </div>
                <div className="flex-1">
                  <h3 className="text-xl font-semibold mb-1">Get Informed Response</h3>
                  <p className="text-gray-600">
                    Receive a clear, informative response based on current medical knowledge with appropriate disclaimers.
                  </p>
                </div>
              </div>
            </div>
          </div>
        </section>
      </main>
      
      <footer className="bg-gray-800 text-white py-8">
        <div className="container mx-auto px-4 md:px-6">
          <div className="flex flex-col md:flex-row justify-between items-center">
            <div className="mb-4 md:mb-0">
              <h2 className="text-xl font-bold">SonarCare</h2>
              <p className="text-gray-400">Your AI medical assistant</p>
            </div>
            <div className="text-center md:text-right">
              <p className="text-gray-400">
                © {new Date().getFullYear()} SonarCare. All rights reserved.
              </p>
              <p className="text-gray-400 text-sm mt-1">
                Powered by Perplexity Sonar & LangGraph
              </p>
            </div>
          </div>
        </div>
      </footer>
    </div>
  );
}
