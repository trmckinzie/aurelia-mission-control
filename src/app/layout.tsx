import type { Metadata } from "next";
import { Geist, JetBrains_Mono } from "next/font/google";
import "./globals.css";
import { Header } from "@/components/dashboard/Header";
import { NavBar } from "@/components/dashboard/NavBar";
import { SystemTelemetry } from "@/components/dashboard/SystemTelemetry";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const jetbrainsMono = JetBrains_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "AURELIA // Mission Control",
  description: "Command interface for the local Hermes Agent gateway.",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html
      lang="en"
      className={`${geistSans.variable} ${jetbrainsMono.variable} h-full antialiased`}
    >
      <body className="min-h-full flex flex-col bg-background">
        <div className="flex h-full min-h-screen w-full flex-col bg-background">
          <Header />
          <NavBar />
          <div className="flex flex-1 overflow-hidden">
            <SystemTelemetry />
            {children}
          </div>
        </div>
      </body>
    </html>
  );
}
