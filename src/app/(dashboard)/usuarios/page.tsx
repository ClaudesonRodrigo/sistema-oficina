// src/app/(dashboard)/usuarios/page.tsx
"use client";

import { useState, useEffect } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import {
  collection,
  onSnapshot,
  doc,
  setDoc,
  deleteDoc,
} from "firebase/firestore";
// REMOVEMOS createUserWithEmailAndPassword e auth
import { db } from "@/lib/firebase";

import { useAuth } from "@/context/AuthContext";
import { useRouter } from "next/navigation";

// Componentes Shadcn
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

  // --- GUARDIÃO DE ROTA ---
  const { userData, loading: authLoading } = useAuth();
  const router = useRouter();

  if (authLoading) {
    return (
      <div className="flex h-screen w-full items-center justify-center">
        Carregando permissões...
      </div>
    );
  }

  if (!userData || userData.role !== 'admin') {
    router.push('/');
    return (
       <div className="flex h-screen w-full items-center justify-center">
         Acesso negado. Redirecionando...
       </div>
    );
  }
  // --- FIM DO GUARDIÃO ---


  // Efeito para carregar os usuários
  useEffect(() => {
    // Este onSnapshot só roda se o usuário for admin (devido ao guardião)
    // E agora vai funcionar, pois o admin (após o Passo 1) tem o token correto
    const unsub = onSnapshot(collection(db, "usuarios"), (snapshot) => {
      const lista: UserData[] = [];
      snapshot.forEach((doc) => {
        lista.push({ id: doc.id, ...doc.data() } as UserData);
      });
      setUsuarios(lista);
    }, (error) => {
       // O erro de permissão não deve mais acontecer aqui
       console.error("Erro no listener de usuários (verifique as regras):", error);
    });
    return () => unsub();
  }, []); // Dependência vazia

  const form = useForm<z.infer<typeof formSchema>>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      nome: "",
      email: "",
      password: "",
      role: "operador",
    },
  });

  // --- FUNÇÃO onSubmit ATUALIZADA ---
  async function onSubmit(values: z.infer<typeof formSchema>) {
    try {
      // 1. Chama a Netlify Function
      const response = await fetch('/.netlify/functions/criarUsuarioComRole', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(values),
      });

      const result = await response.json();

      if (!response.ok) {
        throw new Error(result.error || "Erro desconhecido ao criar usuário");
      }

      console.log("Usuário criado com sucesso pela Netlify Function:", result.uid);
      form.reset();
      setIsModalOpen(false);
      
    } catch (error: any) {
      console.error("Erro ao chamar Netlify Function:", error);
      if (error.message.includes('email-already-exists')) {
        alert("Erro: Este e-mail já está em uso.");
      } else {
        alert("Erro ao criar usuário: " + error.message);
      }
    }
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
                Crie um novo login (admin ou operador) para o sistema.
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
                      <FormLabel>E-mail (para login)</FormLabel>
                      <FormControl>
                        <Input type="email" placeholder="email@login.com" {...field} />
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
                      <FormLabel>Senha (mínimo 6 caracteres)</FormLabel>
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
                            <SelectValue placeholder="Selecione um nível" />
                          </SelectTrigger>
                        </FormControl>
                        <SelectContent>
                          <SelectItem value="operador">Operador (Caixa)</SelectItem>
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

      {/* --- Tabela de Usuários --- */}
      <div className="rounded-md border">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Nome</TableHead>
              <TableHead>E-mail (Login)</TableHead>
              <TableHead>Nível (Role)</TableHead>
              <TableHead>Ações</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {usuarios.map((usuario) => (
              <TableRow key={usuario.id}>
                <TableCell className="font-medium">{usuario.nome}</TableCell>
                <TableCell>{usuario.email}</TableCell>
                <TableCell>{usuario.role}</TableCell>
                <TableCell>
                  <Button variant="destructive" size="sm" 
                    onClick={async () => {
                      if (confirm(`Tem certeza que quer excluir ${usuario.nome}? Isso NÃO pode ser desfeito.`)) {
                        // TODO: Excluir o usuário do AUTH (requer backend)
                        // Vamos precisar de outra Netlify Function para isso
                        await deleteDoc(doc(db, "usuarios", usuario.id));
                      }
                    }}>
                    Excluir
                  </Button>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>
    </div>
  );
}