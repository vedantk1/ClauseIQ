import "./globals.css";
import { Inter, Space_Grotesk } from "next/font/google";
import { AppStateProvider } from "@/store/appState";
import { AuthProvider } from "@/context/AuthContext.v2";
import { AnalysisProvider } from "@/context/AnalysisContext";
import NavBar from "@/components/NavBar.v2";
import { Toaster } from "react-hot-toast";
import { Toast, ErrorBoundary } from "@/components/ui";

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
  title: "ClauseIQ - Contract Analysis Platform",
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
        <AppStateProvider>
          <AuthProvider>
            <AnalysisProvider>
              <ErrorBoundary>
                <div className="min-h-screen flex flex-col">
                  <NavBar />
                  <main className="flex-1">{children}</main>
                </div>
                <Toast />
              </ErrorBoundary>
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
          </AuthProvider>
        </AppStateProvider>
      </body>
    </html>
  );
}
