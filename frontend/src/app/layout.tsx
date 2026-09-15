import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Decentralized Clinical Gateway | XFL-Gateway",
  description: "Explainable Federated Learning for Healthcare IoT with Local SHAP Explanations",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <body className="antialiased min-h-screen bg-gray-50">{children}</body>
    </html>
  );
}
