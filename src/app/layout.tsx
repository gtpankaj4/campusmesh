import type { Metadata } from "next";
import { Poppins } from "next/font/google";
import "./globals.css";
import PageTransition from "@/components/PageTransition";
import ConnectionStatus from "@/components/ConnectionStatus";

const poppins = Poppins({
  variable: "--font-poppins",
  subsets: ["latin"],
  weight: ["300", "400", "500", "600", "700"],
});

export const metadata: Metadata = {
  title: "Campesh - Your campus, your network",
  description:
    "Your campus community platform for connecting, sharing, and building networks",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <head>
        <link
          rel="stylesheet"
          href="https://cdnjs.cloudflare.com/ajax/libs/font-awesome/4.7.0/css/font-awesome.min.css"
        />
      </head>
      <body className={`${poppins.variable} font-sans antialiased`}>
        <ConnectionStatus />
        <PageTransition>{children}</PageTransition>
      </body>
    </html>
  );
}
