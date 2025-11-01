// src/context/AuthContext.tsx
"use client";

import React, { createContext, useContext, useEffect, useState } from 'react';
import { onAuthStateChanged, User } from 'firebase/auth';
import { auth, db } from '@/lib/firebase';
import { doc, getDoc, onSnapshot } from 'firebase/firestore';

// 1. DEFINIÇÃO DO NOVO TIPO DE USUÁRIO (COM ROLE)
export interface UserData {
  id: string;
  nome: string;
  email: string;
  role: "admin" | "operador";
}

// 2. ATUALIZA O TIPO DO CONTEXTO
type AuthContextType = {
  user: User | null; // O usuário do Firebase Auth
  userData: UserData | null; // Os dados do Firestore (com role)
  loading: boolean; // "Carregando"
};

// 3. ATUALIZA O ESTADO INICIAL
const AuthContext = createContext<AuthContextType>({
  user: null,
  userData: null,
  loading: true,
});

// 4. ATUALIZA O PROVEDOR
export const AuthProvider = ({ children }: { children: React.ReactNode }) => {
  const [user, setUser] = useState<User | null>(null);
  const [userData, setUserData] = useState<UserData | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    // O "sensor" do Firebase Auth (continua igual)
    const unsubscribe = onAuthStateChanged(auth, async (user) => {
      setUser(user);
      
      if (user) {
        // --- NOVA LÓGICA ---
        // 5. Se o usuário logou, busca os dados dele no Firestore
        const userDocRef = doc(db, 'usuarios', user.uid);
        
        // Usamos onSnapshot para "ouvir" mudanças no perfil em tempo real
        onSnapshot(userDocRef, (doc) => {
          if (doc.exists()) {
            setUserData({ id: doc.id, ...doc.data() } as UserData);
          } else {
            // Se não achar o doc, desloga por segurança
            console.error("Usuário não encontrado no Firestore. Deslogando.");
            setUserData(null);
            auth.signOut(); // Força o logout
          }
          setLoading(false);
        });
        // --- FIM DA NOVA LÓGICA ---
      } else {
        // Se deslogou, limpa tudo
        setUser(null);
        setUserData(null);
        setLoading(false);
      }
    });

    // Limpa o "sensor"
    return () => unsubscribe();
  }, []);

  return (
    // 6. FORNECE OS NOVOS DADOS PARA O APP
    <AuthContext.Provider value={{ user, userData, loading }}>
      {children}
    </AuthContext.Provider>
  );
};

// 7. O HOOK (sem mudanças, mas agora retorna o userData)
export const useAuth = () => {
  return useContext(AuthContext);
};