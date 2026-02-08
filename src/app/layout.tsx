import type { Metadata, Viewport } from "next"; // Importe Viewport também
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";
import { AuthProvider } from "@/context/AuthContext";
import { Toaster } from "sonner";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

// Configuração PWA e SEO
export const metadata: Metadata = {
  title: "Rodrigo Skap | Oficina Especializada",
  description: "Sistema de gerenciamento de oficina",
  manifest: "/manifest.json", // Link para o arquivo acima
  icons: {
    icon: "/icons/icon-192x192.png", // Usa o ícone como favicon
    apple: "/icons/icon-192x192.png", // Ícone para iPhone
    shortcut: "/icons/icon-192x192.png",
  },
  appleWebApp: {
    capable: true,
    statusBarStyle: "default",
    title: "Rodrigo Skap",
  },
};

// Configuração de Viewport (Para não dar zoom errado no celular)
export const viewport: Viewport = {
  themeColor: "#000000",
  width: "device-width",
  initialScale: 1,
  maximumScale: 1,
  userScalable: false,
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="pt-br">
      <body
        className={`${geistSans.variable} ${geistMono.variable} antialiased`}
      >
        <AuthProvider>
          {children}
          <Toaster position="top-right" richColors closeButton />
        </AuthProvider>
      </body>
    </html>
  );
}