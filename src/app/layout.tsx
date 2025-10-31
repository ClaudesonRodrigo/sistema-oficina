// src/app/layout.tsx (O Layout Raiz CORRIGIDO)
import type { Metadata } from "next";
import { Inter } from "next/font/google";
import "./globals.css";
// 1. Importe o nosso provedor
import { AuthProvider } from "@/context/AuthContext";

const inter = Inter({ subsets: ["latin"] });

export const metadata: Metadata = {
  title: "OficinaControl",
  description: "Sistema de Gestão para Oficina",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="pt-br">
      <body className={inter.className}>
        {/* 2. Envolva APENAS com o AuthProvider */}
        {/* O MainLayout NÃO deve estar aqui */}
        <AuthProvider>
          {children}
        </AuthProvider>
      </body>
    </html>
  );
}