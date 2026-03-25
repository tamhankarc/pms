import "./globals.css";
import type { Metadata } from "next";
export const metadata: Metadata = { title: "PMS Internal Platform", description: "Project management, billing visibility, timesheets, and reporting" };
export default function RootLayout({ children }: { children: React.ReactNode }) { return <html lang="en"><body>{children}</body></html>; }
