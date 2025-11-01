// src/app/(dashboard)/usuarios/page.tsx
"use client";

import { useState, useEffect } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import {
  collection,
  onSnapshot,
  addDoc,
  doc,
  setDoc,
  deleteDoc,
  getDoc
} from "firebase/firestore";
import { createUserWithEmailAndPassword } from "firebase/auth"; // Importa a função de criar usuário
import { db, auth } from "@/lib/firebase";
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

// Interface para o usuário (igual a do AuthContext)
interface UserData {
  id: string;
  nome: string;
  email: string;
  role: "admin" | "operador";
}

// Schema de validação Zod
const formSchema = z.object({
  nome: z.string().min(3, "Nome muito curto"),
  email: z.string().email("E-mail inválido"),
  password: z.string().min(6, "Senha deve ter no mínimo 6 caracteres"),
  role: z.enum(["admin", "operador"]),
});

export default function UsuariosPage() {
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [usuarios, setUsuarios] = useState<UserData[]>([]);

  // Efeito para carregar os usuários
  useEffect(() => {
    const unsub = onSnapshot(collection(db, "usuarios"), (snapshot) => {
      const lista: UserData[] = [];
      snapshot.forEach((doc) => {
        lista.push({ id: doc.id, ...doc.data() } as UserData);
      });
      setUsuarios(lista);
    });
    return () => unsub();
  }, []);

  const form = useForm<z.infer<typeof formSchema>>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      nome: "",
      email: "",
      password: "",
      role: "operador",
    },
  });

  // Função para criar o novo usuário
  async function onSubmit(values: z.infer<typeof formSchema>) {
    try {
      // 1. Cria o usuário no Firebase Authentication
      // IMPORTANTE: Isso usa a "auth" principal, o que pode deslogar o admin.
      // A forma 100% correta usa o Admin SDK no backend (Node.js),
      // mas para o MVP isso funciona, embora possa pedir um novo login ao admin.
      const userCredential = await createUserWithEmailAndPassword(
        auth,
        values.email,
        values.password
      );
      const user = userCredential.user;

      // 2. Salva os dados dele no Firestore
      const userDocRef = doc(db, "usuarios", user.uid);
      await setDoc(userDocRef, {
        nome: values.nome,
        email: values.email,
        role: values.role,
      });

      console.log("Usuário criado com sucesso:", user.uid);
      form.reset();
      setIsModalOpen(false);
      
    } catch (error: any) {
      console.error("Erro ao criar usuário:", error);
      if (error.code === 'auth/email-already-in-use') {
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
                        // Por enquanto, só exclui do Firestore
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