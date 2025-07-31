import type { Metadata } from "next";
import { Poppins } from "next/font/google";
import "./globals.css";
import PageTransition from "@/components/PageTransition";
import ConnectionStatus from '@/components/ConnectionStatus';

const poppins = Poppins({
  variable: "--font-poppins",
  subsets: ["latin"],
  weight: ["300", "400", "500", "600", "700"],
});

export const metadata: Metadata = {
  title: "CampusMesh - Campus Community Platform",
  description: "Campus community platform for rides, housing, books, and help",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body
        className={`${poppins.variable} font-sans antialiased`}
      >
        <ConnectionStatus />
        <PageTransition>
          {children}
        </PageTransition>
      </body>
    </html>
  );
}
