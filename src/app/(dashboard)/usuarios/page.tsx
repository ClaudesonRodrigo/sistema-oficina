// src/app/(dashboard)/usuarios/page.tsx
"use client";

import { useState, useEffect } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import {
  collection,
  onSnapshot,
  deleteDoc,
  doc,
} from "firebase/firestore";
import { db, auth } from "@/lib/firebase"; // Importando auth para pegar o token
import { useAuth } from "@/context/AuthContext";
import { useRouter } from "next/navigation";

// Componentes Shadcn UI
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

// --- Tipos e Schema ---
interface UserData {
  id: string;
  nome: string;
  email: string;
  role: "admin" | "operador";
}

const formSchema = z.object({
  nome: z.string().min(3, "Nome muito curto"),
  email: z.string().email("E-mail inválido"),
  password: z.string().min(6, "Senha deve ter no mínimo 6 caracteres"),
  role: z.enum(["admin", "operador"]),
});

export default function UsuariosPage() {
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [usuarios, setUsuarios] = useState<UserData[]>([]);
  
  // Hook de autenticação
  const { userData, loading: authLoading } = useAuth();
  const router = useRouter();

  // --- 1. Guardião de Rota ---
  // Se não for admin, nem carrega os dados
  if (!authLoading && (!userData || userData.role !== 'admin')) {
    // Opcional: router.push('/') para expulsar
  }

  // --- 2. Carregar Usuários (Listener em Tempo Real) ---
  useEffect(() => {
    // Só ativa o listener se for admin
    if (!userData || userData.role !== 'admin') return;

    const unsub = onSnapshot(collection(db, "usuarios"), (snapshot) => {
      const lista: UserData[] = [];
      snapshot.forEach((doc) => {
        lista.push({ id: doc.id, ...doc.data() } as UserData);
      });
      setUsuarios(lista);
    }, (error) => {
      console.error("Erro ao buscar usuários:", error);
    });

    return () => unsub();
  }, [userData]);

  const form = useForm<z.infer<typeof formSchema>>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      nome: "",
      email: "",
      password: "",
      role: "operador",
    },
  });

  // --- 3. Função de Criar (Atualizada para Vercel API) ---
  async function onSubmit(values: z.infer<typeof formSchema>) {
    try {
      // Pegar o token do usuário atual para provar que somos Admin na API
      const token = await auth.currentUser?.getIdToken();

      if (!token) {
        alert("Erro de autenticação. Tente fazer login novamente.");
        return;
      }

      // Chamada para a nova API Route do Next.js
      const response = await fetch('/api/admin/create-user', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}` // O segredo está aqui!
        },
        body: JSON.stringify(values),
      });

      const result = await response.json();

      if (!response.ok) {
        throw new Error(result.error || "Erro ao criar usuário");
      }

      console.log("Sucesso:", result);
      form.reset();
      setIsModalOpen(false);
      alert(`Usuário ${values.nome} criado com sucesso!`);
      
    } catch (error: any) {
      console.error("Erro:", error);
      alert(error.message);
    }
  }

  // Se estiver carregando ou sem permissão, mostra aviso
  if (authLoading) return <div className="p-8">Carregando permissões...</div>;
  if (userData?.role !== 'admin') {
    return (
      <div className="flex h-screen w-full items-center justify-center text-red-500 font-bold">
        Acesso Negado. Apenas administradores podem ver esta página.
      </div>
    );
  }

  return (
    <div>
      <div className="flex justify-between items-center mb-6">
        <h1 className="text-4xl font-bold">Gerenciar Usuários</h1>
        <Dialog open={isModalOpen} onOpenChange={setIsModalOpen}>
          <DialogTrigger asChild>
            <Button>Adicionar Novo Usuário</Button>
          </DialogTrigger>
          <DialogContent className="sm:max-w-[425px]">
            <DialogHeader>
              <DialogTitle>Adicionar Novo Usuário</DialogTitle>
              <DialogDescription>
                Crie um novo login para o sistema (Admin ou Operador).
              </DialogDescription>
            </DialogHeader>

            <Form {...form}>
              <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
                <FormField
                  control={form.control}
                  name="nome"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Nome</FormLabel>
                      <FormControl>
                        <Input placeholder="Nome do funcionário" {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={form.control}
                  name="email"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>E-mail (Login)</FormLabel>
                      <FormControl>
                        <Input type="email" placeholder="email@oficina.com" {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={form.control}
                  name="password"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Senha</FormLabel>
                      <FormControl>
                        <Input type="password" placeholder="******" {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={form.control}
                  name="role"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Nível de Acesso</FormLabel>
                      <Select onValueChange={field.onChange} defaultValue={field.value}>
                        <FormControl>
                          <SelectTrigger>
                            <SelectValue placeholder="Selecione..." />
                          </SelectTrigger>
                        </FormControl>
                        <SelectContent>
                          <SelectItem value="operador">Operador (Caixa/Mecânico)</SelectItem>
                          <SelectItem value="admin">Administrador (Dono)</SelectItem>
                        </SelectContent>
                      </Select>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <DialogFooter>
                  <Button type="submit" disabled={form.formState.isSubmitting}>
                    {form.formState.isSubmitting ? "Criando..." : "Criar Usuário"}
                  </Button>
                </DialogFooter>
              </form>
            </Form>
          </DialogContent>
        </Dialog>
      </div>

      {/* Tabela de Usuários */}
      <div className="rounded-md border">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Nome</TableHead>
              <TableHead>E-mail</TableHead>
              <TableHead>Nível</TableHead>
              <TableHead>Ações</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {usuarios.map((u) => (
              <TableRow key={u.id}>
                <TableCell className="font-medium">{u.nome}</TableCell>
                <TableCell>{u.email}</TableCell>
                <TableCell>
                  <span className={u.role === 'admin' ? "text-red-600 font-bold" : "text-blue-600"}>
                    {u.role.toUpperCase()}
                  </span>
                </TableCell>
                <TableCell>
                  <Button 
                    variant="destructive" 
                    size="sm" 
                    onClick={async () => {
                      if (confirm(`Tem certeza que deseja excluir ${u.nome}?`)) {
                        try {
                          await deleteDoc(doc(db, "usuarios", u.id));
                          // Nota: Para excluir do Authentication também, precisaria de outra rota API.
                          // Por enquanto, excluímos apenas do banco para impedir listagem.
                        } catch (e) {
                          alert("Erro ao excluir usuário.");
                        }
                      }
                    }}
                  >
                    Excluir
                  </Button>
                </TableCell>
              </TableRow>
            ))}
            {usuarios.length === 0 && (
              <TableRow>
                <TableCell colSpan={4} className="text-center py-4">
                  Nenhum usuário encontrado.
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
      </div>
    </div>
  );
}