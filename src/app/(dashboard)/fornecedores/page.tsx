// src/app/(dashboard)/fornecedores/page.tsx
"use client";

import { useState, useEffect } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";

import { db } from "@/lib/firebase";
import { collection, addDoc, onSnapshot } from "firebase/firestore"; 

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

// 1. DEFININDO A "CARA" DO NOSSO FORNECEDOR
interface Fornecedor {
  id: string; // O ID do documento no Firebase
  nome: string;
  telefone?: string;
  cnpj?: string;
  vendedor?: string; // Nome do contato/vendedor
}

// 2. DEFININDO O "CONTRATO" (SCHEMA) DO FORMULÁRIO
const formSchema = z.object({
  nome: z.string().min(3, { message: "O nome deve ter pelo menos 3 caracteres." }),
  telefone: z.string().optional(),
  cnpj: z.string().optional(),
  vendedor: z.string().optional(),
});

export default function FornecedoresPage() {
  const [isModalOpen, setIsModalOpen] = useState(false);
  
  // 3. ESTADO PARA GUARDAR OS FORNECEDORES
  const [fornecedores, setFornecedores] = useState<Fornecedor[]>([]);

  // 4. LIGANDO O "OUVINTE" DO FIREBASE
  useEffect(() => {
    // Ouvindo a coleção "fornecedores"
    const unsub = onSnapshot(collection(db, "fornecedores"), (querySnapshot) => {
      const listaDeFornecedores: Fornecedor[] = [];
      querySnapshot.forEach((doc) => {
        listaDeFornecedores.push({
          id: doc.id,
          ...doc.data()
        } as Fornecedor);
      });
      setFornecedores(listaDeFornecedores); // Atualiza o estado
    });

    return () => unsub(); // Desliga o ouvinte
  }, []); // Roda só uma vez

  // Configurando o formulário
  const form = useForm<z.infer<typeof formSchema>>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      nome: "",
      telefone: "",
      cnpj: "",
      vendedor: "",
    },
  });

  // 5. A FUNÇÃO DE SALVAR (ADAPTADA PARA FORNECEDORES)
  async function onSubmit(values: z.infer<typeof formSchema>) {
    try {
      // Salvando diretamente na coleção "fornecedores"
      const docRef = await addDoc(collection(db, "fornecedores"), values);
      
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

            {/* ===== 6. O FORMULÁRIO ADAPTADO ===== */}
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

      {/* ===== 7. TABELA ADAPTADA PARA FORNECEDORES ===== */}
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