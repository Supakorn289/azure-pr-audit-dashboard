import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Infogrammer | ติดตาม Coding Complete",
  description: "ระบบติดตาม Work Items และ Pull Requests สำหรับทีมพัฒนา Infogrammer",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return <html lang="th"><body>{children}</body></html>;
}
