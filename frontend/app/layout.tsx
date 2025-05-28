import type { Metadata } from "next";
import { Nunito } from "next/font/google";
import "./globals.css";
import { AuthContextProvider } from "../context/AuthContext";
import 'react-toastify/dist/ReactToastify.css';
import { ToastContainer } from 'react-toastify';

// Use Nunito for a friendly, rounded sans-serif appearance
const nunito = Nunito({ 
  subsets: ["latin"],
  display: 'swap',
  variable: '--font-nunito',
  weight: ['300', '400', '500', '600', '700'],
});

export const metadata: Metadata = {
  title: "SonarCare - Medical Advice Chatbot",
  description: "Get medical information and advice powered by Perplexity Sonar",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body className={`${nunito.variable} font-sans antialiased`}>
        <AuthContextProvider>
          {children}
        </AuthContextProvider>
        <ToastContainer position="top-right" autoClose={5000} />
      </body>
    </html>
  );
}
