import type { Metadata } from "next";
import type { ReactNode } from "react";

import { project } from "@/lib/project";

import "./globals.css";

export const metadata: Metadata = {
  title: project.name,
  description: project.description,
};

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="ko">
      <body>{children}</body>
    </html>
  );
}
