// src/app/(dashboard)/fornecedores/page.tsx
"use client";

import { useState, useEffect } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";

import { db } from "@/lib/firebase";
// ATUALIZADO: Importar 'query' e 'where'
import { collection, addDoc, onSnapshot, query, where } from "firebase/firestore"; 

// ATUALIZADO: Importar hooks de autenticação
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

interface Fornecedor {
  id: string; 
  nome: string;
  telefone?: string;
  cnpj?: string;
  vendedor?: string; 
  ownerId?: string; // Campo de segurança
}

const formSchema = z.object({
  nome: z.string().min(3, { message: "O nome deve ter pelo menos 3 caracteres." }),
  telefone: z.string().optional(),
  cnpj: z.string().optional(),
  vendedor: z.string().optional(),
});

export default function FornecedoresPage() {
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [fornecedores, setFornecedores] = useState<Fornecedor[]>([]);

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
  // (Agora só busca os fornecedores que o usuário logado criou)
  useEffect(() => {
    // Só roda SE o userData estiver carregado
    if (userData) {
      // 1. Cria a query segura
      const q = query(
        collection(db, "fornecedores"),
        where("ownerId", "==", userData.id) // Filtra por 'ownerId'
      );
      
      // 2. Ouve a query (não a coleção inteira)
      const unsub = onSnapshot(q, (querySnapshot) => {
        const listaDeFornecedores: Fornecedor[] = [];
        querySnapshot.forEach((doc) => {
          listaDeFornecedores.push({
            id: doc.id,
            ...doc.data()
          } as Fornecedor);
        });
        setFornecedores(listaDeFornecedores); 
      });

      return () => unsub();
    }
  }, [userData]); // 3. Roda de novo se o usuário (userData) mudar

  const form = useForm<z.infer<typeof formSchema>>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      nome: "",
      telefone: "",
      cnpj: "",
      vendedor: "",
    },
  });

  // --- onSubmit ATUALIZADO ---
  // (Agora salva o ownerId)
  async function onSubmit(values: z.infer<typeof formSchema>) {
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
      
      // 2. Salva na coleção "fornecedores"
      const docRef = await addDoc(collection(db, "fornecedores"), docParaSalvar);
      
      console.log("Fornecedor salvo com ID: ", docRef.id);
      form.reset();
      setIsModalOpen(false);

    } catch (error) {
      console.error("Erro ao salvar fornecedor: ", error);
    }
  }

  return (
    <div>
      <div className="flex justify-between items-center mb-6">
        <h1 className="text-4xl font-bold">Fornecedores</h1>
        
        <Dialog open={isModalOpen} onOpenChange={setIsModalOpen}>
          <DialogTrigger asChild>
            <Button>Adicionar Novo Fornecedor</Button>
          </DialogTrigger>
          <DialogContent className="sm:max-w-[425px]">
            <DialogHeader>
              <DialogTitle>Adicionar Novo Fornecedor</DialogTitle>
              <DialogDescription>
                Preencha as informações do novo fornecedor.
              </DialogDescription>
            </DialogHeader>

            <Form {...form}>
              <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
                
                <FormField
                  control={form.control}
                  name="nome"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Nome da Empresa</FormLabel>
                      <FormControl>
                        <Input placeholder="Ex: Auto Peças Sergipe" {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                
                 <FormField
                  control={form.control}
                  name="vendedor"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Nome do Vendedor (Contato)</FormLabel>
                      <FormControl>
                        <Input placeholder="Ex: Carlos" {...field} />
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
                  name="cnpj"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>CNPJ</FormLabel>
                      <FormControl>
                        <Input placeholder="Opcional" {...field} />
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
                    {form.formState.isSubmitting ? "Salvando..." : "Salvar Fornecedor"}
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
              <TableHead>Nome da Empresa</TableHead>
              <TableHead>Vendedor (Contato)</TableHead>
              <TableHead>Telefone</TableHead>
              <TableHead>CNPJ</TableHead>
              <TableHead>Ações</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {fornecedores.map((fornecedor) => (
              <TableRow key={fornecedor.id}>
                <TableCell className="font-medium">{fornecedor.nome}</TableCell>
                <TableCell>{fornecedor.vendedor}</TableCell>
                <TableCell>{fornecedor.telefone}</TableCell>
                <TableCell>{fornecedor.cnpj}</TableCell>
                <TableCell>{/* TODO: Botões de Editar/Excluir */}</TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>
    </div>
  );
}