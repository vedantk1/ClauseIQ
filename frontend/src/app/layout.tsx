import "./globals.css";
import { Inter } from "next/font/google";
import { AnalysisProvider } from "@/context/AnalysisContext";
import NavBar from "@/components/NavBar";
import { Toaster } from "react-hot-toast";

const inter = Inter({ subsets: ["latin"] });

export const metadata = {
  title: "Legal-AI MVP",
  description: "Contract analyser",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body className={inter.className}>
        <AnalysisProvider>
          <Toaster position="top-right" />
          <NavBar />
          <main className="max-w-5xl mx-auto px-4 py-8">{children}</main>
        </AnalysisProvider>
      </body>
    </html>
  );
}
