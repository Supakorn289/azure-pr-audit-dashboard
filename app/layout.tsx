import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "scope. — Coding Complete Audit",
  description: "Azure DevOps dashboard สำหรับตรวจสอบใบงาน Coding Complete และสถานะ Pull Request",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return <html lang="th"><body>{children}</body></html>;
}
