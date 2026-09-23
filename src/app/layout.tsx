import type { Metadata } from "next";
import { StoreProvider } from "@/lib/store";
import { AppBar } from "@/components/AppBar";
import { RouteGuard } from "@/components/RouteGuard";
import { TooltipProvider } from "@/components/ui/tooltip";
import { Toaster } from "@/components/ui/sonner";
import { fontVariables } from "@/styles/fonts";
import "@/styles/fonts";
import "./globals.css";

export const metadata: Metadata = {
  title: "LVAEP Tutoring Log",
  description:
    "Attendance and achievement tracking for Literacy Volunteers of America, Essex/Passaic County.",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" style={fontVariables}>
      <body className="grid-bg antialiased">
        <StoreProvider>
          <TooltipProvider>
            <AppBar />
            <main>
              <RouteGuard>{children}</RouteGuard>
            </main>
            <Toaster position="bottom-right" />
          </TooltipProvider>
        </StoreProvider>
      </body>
    </html>
  );
}
