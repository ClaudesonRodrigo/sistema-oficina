// src/context/AuthContext.tsx
"use client";

import { createContext, useContext, useEffect, useState, ReactNode } from "react";
import { 
  onAuthStateChanged, 
  User, 
  signOut 
} from "firebase/auth";
import { doc, getDoc, setDoc } from "firebase/firestore";
import { auth, db } from "@/lib/firebase";
import { useRouter } from "next/navigation";

// Tipo dos dados do usuário no Firestore
interface UserData {
  id: string;
  nome: string;
  email: string;
  role: "admin" | "operador";
  plan?: string;
}

// Interface do Contexto (Aqui estava faltando o logout!)
interface AuthContextType {
  user: User | null;      // O usuário técnico do Firebase Authentication
  userData: UserData | null; // Os dados do nosso banco (nome, cargo, etc)
  loading: boolean;
  logout: () => Promise<void>; // <--- ADICIONADO AQUI
}

const AuthContext = createContext<AuthContextType>({} as AuthContextType);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [userData, setUserData] = useState<UserData | null>(null);
  const [loading, setLoading] = useState(true);
  const router = useRouter();

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (currentUser) => {
      setLoading(true);
      setUser(currentUser);

      if (currentUser) {
        // Buscar dados extras no Firestore (Role, Nome, etc)
        const docRef = doc(db, "usuarios", currentUser.uid);
        const docSnap = await getDoc(docRef);

        if (docSnap.exists()) {
          setUserData({ id: docSnap.id, ...docSnap.data() } as UserData);
        } else {
          // Se o usuário existe no Auth mas não no banco (ex: criado manualmente), cria um perfil básico
          // Isso evita travar o sistema
          const novoUsuario: UserData = {
            id: currentUser.uid,
            nome: currentUser.displayName || "Usuário",
            email: currentUser.email || "",
            role: "operador" // Padrão seguro
          };
          
          // Opcional: Salvar no banco para a próxima vez
          // await setDoc(docRef, novoUsuario);
          
          setUserData(novoUsuario);
        }
      } else {
        setUserData(null);
      }
      setLoading(false);
    });

    return () => unsubscribe();
  }, []);

  // Função de Logout
  const logout = async () => {
    try {
      await signOut(auth);
      setUser(null);
      setUserData(null);
      router.push("/login"); // Redireciona para login após sair
    } catch (error) {
      console.error("Erro ao sair:", error);
    }
  };

  return (
    <AuthContext.Provider value={{ user, userData, loading, logout }}>
      {children}
    </AuthContext.Provider>
  );
}

// Hook personalizado para facilitar o uso
export const useAuth = () => useContext(AuthContext);