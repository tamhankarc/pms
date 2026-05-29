import "./globals.css";
import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Billing System",
  description: "Project management, billing, attendance, and leave management",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return <html lang="en"><body>{children}</body></html>;
}
