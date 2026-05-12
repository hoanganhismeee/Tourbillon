// This is the root layout for the entire application.
// It sets up the global fonts, structure, and the navigation bar.
import type { Metadata } from "next";
import { Playfair_Display, Inter } from "next/font/google";
import { QueryProvider } from "@/providers/QueryProvider";
import { AuthProvider } from "@/contexts/AuthContext";
import { WatchesPageProvider } from "@/contexts/WatchesPageContext";
import { NavigationProvider } from "@/contexts/NavigationContext";
import { CursorProvider } from "@/contexts/CursorContext";
import { ChatProvider } from "@/contexts/ChatContext";
import { LenisProvider } from "@/app/providers/LenisProvider";
import { GSAPProvider } from "@/app/providers/GSAPProvider";
import { TooltipProvider } from "@/components/ui/tooltip";
import { Toaster } from "sonner";
import { Analytics } from "@vercel/analytics/next";
import { SpeedInsights } from "@vercel/speed-insights/next";
import "./globals.css";
import NavBar from "./components/layout/NavBar";
import Footer from "./components/layout/Footer";
import AnimatedLayout from "./scrollMotion/AnimatedLayout";
import CompareIndicator from "./components/compare/CompareIndicator";
import ChatWidget from "./components/chat/ChatWidget";
import CustomCursor from "./components/cursor/CustomCursor";
import CursorSelector from "./components/cursor/CursorSelector";

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
  icons: {
    icon: "/icon.svg",
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" suppressHydrationWarning>
      {/* Preconnect to CloudFront to reduce DNS+TLS latency on first image request */}
      <head>
        <link rel="preconnect" href="https://d2lauyid2w6u9c.cloudfront.net" crossOrigin="anonymous" />
        <link rel="dns-prefetch" href="https://d2lauyid2w6u9c.cloudfront.net" />
      </head>
      <body
        className={`${playfairDisplay.variable} ${inter.variable} antialiased`}
        suppressHydrationWarning={true}
        style={{ scrollBehavior: 'auto' }}
      >
        <LenisProvider>
          <GSAPProvider>
          <TooltipProvider>
            <QueryProvider>
              <AuthProvider>
                <WatchesPageProvider>
                  <NavigationProvider>
                    <CursorProvider>
                      <ChatProvider>
                        <NavBar />
                        <AnimatedLayout>
                          {children}
                        </AnimatedLayout>
                        <Footer />
                        <CompareIndicator />
                        <ChatWidget />
                        <Toaster
                          position="bottom-right"
                          toastOptions={{
                            style: {
                              background: '#1a1a1a',
                              border: '1px solid rgba(255,255,255,0.1)',
                              color: '#f0e6d2',
                              fontFamily: 'var(--font-inter)',
                              fontSize: '13px',
                            },
                          }}
                        />
                      </ChatProvider>
                      <CursorSelector />
                      <CustomCursor />
                    </CursorProvider>
                  </NavigationProvider>
                </WatchesPageProvider>
              </AuthProvider>
            </QueryProvider>
          </TooltipProvider>
          </GSAPProvider>
        </LenisProvider>
        <script
          dangerouslySetInnerHTML={{
            __html: `if ('scrollRestoration' in history) { history.scrollRestoration = 'manual'; }`,
          }}
        />
        <Analytics />
        <SpeedInsights />
      </body>
    </html>
  );
}
