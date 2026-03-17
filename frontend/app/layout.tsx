// This is the root layout for the entire application.
// It sets up the global fonts, structure, and the navigation bar.
import type { Metadata } from "next";
import { Playfair_Display, Inter } from "next/font/google";
import { AuthProvider } from "@/contexts/AuthContext";
import { WatchesPageProvider } from "@/contexts/WatchesPageContext";
import { NavigationProvider } from "@/contexts/NavigationContext";
import "./globals.css";
import NavBar from "./components/layout/NavBar";
import { AnimatePresence } from "framer-motion";
import MotionMain from "./scrollMotion/MotionMain";

const playfairDisplay = Playfair_Display({
  variable: "--font-playfair-display",
  subsets: ["latin"],
  display: 'swap',
  weight: ['400', '500', '600', '700', '800', '900']
});

const inter = Inter({
  variable: "--font-inter",
  subsets: ["latin"], 
  display: 'swap',
  weight: ['300', '400', '500', '600', '700'],
});

export const metadata: Metadata = {
  title: "Tourbillon",
  description: "A timeless collection of luxury watches",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" suppressHydrationWarning>
      {/* Preconnect to Cloudinary to reduce DNS+TLS latency on first image request */}
      <head>
        <link rel="preconnect" href="https://res.cloudinary.com" crossOrigin="anonymous" />
        <link rel="dns-prefetch" href="https://res.cloudinary.com" />
      </head>
      <body
        className={`${playfairDisplay.variable} ${inter.variable} antialiased`}
        suppressHydrationWarning={true}
        style={{ scrollBehavior: 'auto' }}
      >
        <AuthProvider>
          <WatchesPageProvider>
            <NavigationProvider>
              <NavBar />
              <AnimatePresence mode="wait">
                <MotionMain
                  className="relative z-10 pt-[50px]"
                  key={typeof window !== 'undefined' ? window.location.pathname : ''}
                >
                  {children}
                </MotionMain>
              </AnimatePresence>
            </NavigationProvider>
          </WatchesPageProvider>
        </AuthProvider>
        <script
          dangerouslySetInnerHTML={{
            __html: `
              if (typeof window !== 'undefined') {
                if ('scrollRestoration' in history) {
                  history.scrollRestoration = 'manual';
                }
                window.scrollTo(0, 0);
              }
            `,
          }}
        />
      </body>
    </html>
  );
}
