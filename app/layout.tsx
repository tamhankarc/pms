import "./globals.css";
import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "PMS + EMS Internal Platform",
  description: "Project management, billing, attendance, and leave management",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return <html lang="en"><body>{children}</body></html>;
}
