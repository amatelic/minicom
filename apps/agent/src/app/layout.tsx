import type { Metadata } from "next";
import { OfflineBanner, ErrorBoundary } from "@minicom/chat-ui";

import { AppProviders } from "@/components/AppProviders";

import "./globals.css";

export const metadata: Metadata = {
  title: "MiniCom Agent",
  description: "MiniCom standalone agent inbox",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>
        <AppProviders>
          <OfflineBanner message="Offline mode. Typing events and sends will retry after reconnect." />
          <ErrorBoundary fallbackMessage="Agent app failed to render. Reload to recover.">
            {children}
          </ErrorBoundary>
        </AppProviders>
      </body>
    </html>
  );
}
