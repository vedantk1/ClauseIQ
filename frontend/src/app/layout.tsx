import "./globals.css";
import { Inter, Space_Grotesk } from "next/font/google";
import { AnalysisProvider } from "@/context/AnalysisContext";
import NavBar from "@/components/NavBar";
import { Toaster } from "react-hot-toast";

const inter = Inter({
  subsets: ["latin"],
  variable: "--font-inter",
  display: "swap",
});

const spaceGrotesk = Space_Grotesk({
  subsets: ["latin"],
  variable: "--font-space-grotesk",
  display: "swap",
});

export const metadata = {
  title: "Legal AI - Contract Analysis Platform",
  description:
    "Understand any employment contract in minutes with AI-powered analysis",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" className="dark">
      <body
        className={`${inter.variable} ${spaceGrotesk.variable} font-sans bg-bg-primary text-text-primary antialiased`}
      >
        <AnalysisProvider>
          <div className="min-h-screen flex flex-col">
            <NavBar />
            <main className="flex-1">{children}</main>
          </div>
          <Toaster
            position="top-right"
            toastOptions={{
              style: {
                background: "var(--bg-surface)",
                color: "var(--text-primary)",
                border: "1px solid var(--border-muted)",
              },
              success: {
                iconTheme: {
                  primary: "var(--accent-green)",
                  secondary: "var(--bg-surface)",
                },
              },
              error: {
                iconTheme: {
                  primary: "var(--accent-rose)",
                  secondary: "var(--bg-surface)",
                },
              },
            }}
          />
        </AnalysisProvider>
      </body>
    </html>
  );
}
