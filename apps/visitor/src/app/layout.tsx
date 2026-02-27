import type { Metadata } from "next";
import { OfflineBanner, ErrorBoundary } from "@minicom/chat-ui";

import { AppProviders } from "@/components/AppProviders";

import "./globals.css";

export const metadata: Metadata = {
  title: "MiniCom Visitor",
  description: "MiniCom visitor demo app",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>
        <AppProviders>
          <OfflineBanner message="You are offline. Sending and typing signals are paused." />
          <ErrorBoundary fallbackMessage="Chat failed to load. Refresh the page to recover.">
            {children}
          </ErrorBoundary>
        </AppProviders>
      </body>
    </html>
  );
}
