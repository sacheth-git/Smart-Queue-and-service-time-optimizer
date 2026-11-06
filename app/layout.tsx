import type { Metadata } from "next";
import "@fontsource/ibm-plex-mono/latin-500.css";
import "@fontsource/ibm-plex-mono/latin-700.css";
import "@fontsource/ibm-plex-sans/latin-400.css";
import "@fontsource/ibm-plex-sans/latin-500.css";
import "@fontsource/ibm-plex-sans/latin-600.css";
import "@fontsource/ibm-plex-sans/latin-700.css";
import { AnnouncerProvider } from "@/components/announcer-provider";
import { Toaster } from "@/components/ui/sonner";
import "./globals.css";

export const metadata: Metadata = {
  title: "PulseQueue AI",
  description: "Smart queue and service-time optimization for hospital outpatient departments.",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className="h-full antialiased">
      <body className="flex min-h-full flex-col">
        <AnnouncerProvider>{children}</AnnouncerProvider>
        <Toaster position="bottom-right" richColors />
      </body>
    </html>
  );
}
