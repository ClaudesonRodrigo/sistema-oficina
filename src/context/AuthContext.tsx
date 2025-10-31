// src/context/AuthContext.tsx
"use client";

import React, { createContext, useContext, useEffect, useState } from 'react';
import { onAuthStateChanged, User } from 'firebase/auth';
import { auth } from '@/lib/firebase'; // Nosso arquivo de conexão

// 1. Define o "formato" dos dados do nosso contexto
type AuthContextType = {
  user: User | null; // O usuário do Firebase ou null
  loading: boolean; // "Carregando" (verificando se está logado ou não)
};

// 2. Cria o Contexto
const AuthContext = createContext<AuthContextType>({
  user: null,
  loading: true,
});

// 3. Cria o "Provedor" (o componente que vai envolver nosso app)
export const AuthProvider = ({ children }: { children: React.ReactNode }) => {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    // Este é o "sensor" do Firebase. Ele roda sempre que o estado de auth muda
    const unsubscribe = onAuthStateChanged(auth, (user) => {
      setUser(user); // Define o usuário (se logado) ou null (se deslogado)
      setLoading(false); // Marca que já terminou de verificar
    });

    // Limpa o "sensor" quando o componente é desmontado
    return () => unsubscribe();
  }, []);

  return (
    <AuthContext.Provider value={{ user, loading }}>
      {children}
    </AuthContext.Provider>
  );
};

// 4. Cria um "Hook" (um atalho) para usarmos em nossas páginas
export const useAuth = () => {
  return useContext(AuthContext);
};