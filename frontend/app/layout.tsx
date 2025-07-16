import type { Metadata } from "next";
import { Playfair_Display, Inter } from "next/font/google";
import "./globals.css";
import NavBar from "./NavBar";


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
  title: "Tourbillon"
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body
        className={`${playfairDisplay.variable} ${inter.variable} antialiased`}
        suppressHydrationWarning={true}>
        <NavBar />
        {children}
      </body>
    </html>
  );
}
