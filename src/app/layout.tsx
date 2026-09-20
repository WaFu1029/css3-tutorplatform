import type { Metadata } from "next";
import { Archivo, Instrument_Serif } from "next/font/google";
import { StoreProvider } from "@/lib/store";
import { AppBar } from "@/components/AppBar";
import { TooltipProvider } from "@/components/ui/tooltip";
import { Toaster } from "@/components/ui/sonner";
import "./globals.css";

const archivo = Archivo({
  variable: "--font-archivo",
  subsets: ["latin"],
});

const instrument = Instrument_Serif({
  variable: "--font-instrument",
  subsets: ["latin"],
  weight: "400",
});

export const metadata: Metadata = {
  title: "LVAEP Tutoring Log",
  description:
    "Attendance and achievement tracking for Literacy Volunteers of America, Essex/Passaic County.",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className={`${archivo.variable} ${instrument.variable}`}>
      <body className="antialiased">
        <StoreProvider>
          <TooltipProvider>
            <AppBar />
            <main>{children}</main>
            <Toaster position="bottom-right" />
          </TooltipProvider>
        </StoreProvider>
      </body>
    </html>
  );
}
