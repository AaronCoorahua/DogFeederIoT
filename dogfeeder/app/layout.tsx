import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "DogFeeder",
  description: "Monitoreo del dispensador de comida para mascotas",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="es">
      <body>{children}</body>
    </html>
  );
}
