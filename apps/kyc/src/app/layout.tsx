import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Internal Tools Platform — KYC Review Queue",
  description: "Horizontal internal tools platform with KYC review queue demo",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body className="min-h-screen antialiased">{children}</body>
    </html>
  );
}
