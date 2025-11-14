// src/app/clientes/page.tsx
"use client";

import { useState, useEffect } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";

import { db } from "@/lib/firebase";
// ATUALIZADO: Importar 'query', 'where' e 'Query'
import { collection, addDoc, onSnapshot, query, where, Query } from "firebase/firestore"; 

import { useAuth } from "@/context/AuthContext";
import { useRouter } from "next/navigation";

// Importações dos componentes Shadcn
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

interface Cliente {
  id: string; 
  nome: string;
  telefone?: string;
  cpfCnpj?: string;
  ownerId?: string; // Campo de segurança
}

const formSchema = z.object({
  nome: z.string().min(3, { message: "O nome deve ter pelo menos 3 caracteres." }),
  telefone: z.string().optional(),
  cpfCnpj: z.string().optional(),
});

export default function ClientesPage() {
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [clientes, setClientes] = useState<Cliente[]>([]);
  
  // Pega o 'userData' (que tem o ID) e o 'authLoading'
  const { userData, loading: authLoading } = useAuth();
  const router = useRouter();

  // --- GUARDIÃO DE ROTA (O "PORTEIRO") ---
  if (authLoading) {
    return (
      <div className="flex h-screen w-full items-center justify-center">
        Carregando permissões...
      </div>
    );
  }
  // Se não estiver logado, redireciona
  if (!userData) { 
    router.push('/login');
    return (
       <div className="flex h-screen w-full items-center justify-center">
         Redirecionando...
       </div>
    );
  }
  // --- FIM DO GUARDIÃO ---
  
  
  // --- useEffect ATUALIZADO ---
  // (Admin vê todos, Operador vê apenas os seus)
  useEffect(() => {
    if (userData) {
      const isAdmin = userData.role === 'admin';
      const clientesRef = collection(db, "clientes");
      
      let q: Query; // Usa o tipo Query importado

      if (isAdmin) {
        // Admin vê TUDO
        q = query(clientesRef);
      } else {
        // Operador vê SÓ O DELE
        q = query(clientesRef, where("ownerId", "==", userData.id));
      }
      
      const unsub = onSnapshot(q, (querySnapshot) => {
        const listaDeClientes: Cliente[] = [];
        querySnapshot.forEach((doc) => {
          listaDeClientes.push({
            id: doc.id,
            ...doc.data()
          } as Cliente);
        });
        setClientes(listaDeClientes); 
      });

      return () => unsub(); 
    }
  }, [userData]); // Roda de novo se o usuário (userData) mudar

  const form = useForm<z.infer<typeof formSchema>>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      nome: "",
      telefone: "",
      cpfCnpj: "",
    },
  });

  // --- onSubmit ATUALIZADO ---
  // (Agora salva o ownerId)
  async function onSubmit(values: z.infer<typeof formSchema>) {
    // Validação extra (caso o guardião falhe)
    if (!userData) {
      alert("Erro: Usuário não autenticado.");
      return;
    }

    try {
      // 1. Monta o documento com o ownerId
      const docParaSalvar = {
        ...values,
        ownerId: userData.id // AQUI ESTÁ A MUDANÇA
      };
      
      // 2. Salva na coleção "clientes"
      const docRef = await addDoc(collection(db, "clientes"), docParaSalvar);
      
      console.log("Cliente salvo com ID: ", docRef.id);
      form.reset();
      setIsModalOpen(false);

    } catch (error) {
      console.error("Erro ao salvar cliente: ", error);
    }
  }

  return (
    <div>
      <div className="flex justify-between items-center mb-6">
        <h1 className="text-4xl font-bold">Clientes</h1>
        
        <Dialog open={isModalOpen} onOpenChange={setIsModalOpen}>
          <DialogTrigger asChild>
            <Button>Adicionar Novo Cliente</Button>
          </DialogTrigger>
          <DialogContent className="sm:max-w-[425px]">
            <DialogHeader>
              <DialogTitle>Adicionar Novo Cliente</DialogTitle>
              <DialogDescription>
                Preencha as informações do novo cliente.
              </DialogDescription>
            </DialogHeader>

            <Form {...form}>
              <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
                
                <FormField
                  control={form.control}
                  name="nome"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Nome do Cliente</FormLabel>
                      <FormControl>
                        <Input placeholder="Ex: Rodrigo Borges" {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="telefone"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Telefone / WhatsApp</FormLabel>
                      <FormControl>
                        <Input placeholder="Ex: 79 99999-8888" {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="cpfCnpj"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>CPF ou CNPJ</FormLabel>
                      <FormControl>
                        <Input placeholder="Ex: 123.456.789-00" {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <DialogFooter>
                  <Button 
                    type="submit" 
                    disabled={form.formState.isSubmitting}
                  >
                    {form.formState.isSubmitting ? "Salvando..." : "Salvar Cliente"}
                  </Button>
                </DialogFooter>

              </form>
            </Form>
          </DialogContent>
        </Dialog>
      </div>

      <div className="rounded-md border">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Nome</TableHead>
              <TableHead>Telefone</TableHead>
              <TableHead>CPF / CNPJ</TableHead>
              <TableHead>Ações</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {clientes.map((cliente) => (
              <TableRow key={cliente.id}>
                <TableCell className="font-medium">{cliente.nome}</TableCell>
                <TableCell>{cliente.telefone}</TableCell>
                <TableCell>{cliente.cpfCnpj}</TableCell>
                <TableCell>{/* TODO: Botões de Editar/Excluir */}</TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>

    </div>
  );
}