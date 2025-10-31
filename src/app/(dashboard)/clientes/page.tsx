// src/app/clientes/page.tsx
"use client";

import { useState, useEffect } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";

// Importações do Firebase (NOSSA CONEXÃO)
import { db } from "@/lib/firebase";
import { collection, addDoc, onSnapshot } from "firebase/firestore"; 

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
// import { toast } from "sonner"; // Descomentar se tiver instalado o Sonner

// 1. DEFININDO A "CARA" DO NOSSO CLIENTE
interface Cliente {
  id: string; // O ID do documento no Firebase
  nome: string;
  telefone?: string;
  cpfCnpj?: string;
  // TODO: Adicionar email e endereço no futuro
}

// 2. DEFININDO O "CONTRATO" (SCHEMA) DO FORMULÁRIO
const formSchema = z.object({
  nome: z.string().min(3, { message: "O nome deve ter pelo menos 3 caracteres." }),
  telefone: z.string().optional(),
  cpfCnpj: z.string().optional(),
});

export default function ClientesPage() {
  const [isModalOpen, setIsModalOpen] = useState(false);
  
  // 3. ESTADO PARA GUARDAR OS CLIENTES VINDOS DO FIREBASE
  const [clientes, setClientes] = useState<Cliente[]>([]);

  // 4. LIGANDO O "OUVINTE" DO FIREBASE (EM TEMPO REAL)
  useEffect(() => {
    // Ouvindo a coleção "clientes"
    const unsub = onSnapshot(collection(db, "clientes"), (querySnapshot) => {
      const listaDeClientes: Cliente[] = [];
      querySnapshot.forEach((doc) => {
        listaDeClientes.push({
          id: doc.id,
          ...doc.data()
        } as Cliente);
      });
      setClientes(listaDeClientes); // Atualiza o estado
    });

    return () => unsub(); // Desliga o ouvinte
  }, []); // Roda só uma vez

  // Configurando o formulário
  const form = useForm<z.infer<typeof formSchema>>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      nome: "",
      telefone: "",
      cpfCnpj: "",
    },
  });

  // 5. A FUNÇÃO DE SALVAR (ADAPTADA PARA CLIENTES)
  async function onSubmit(values: z.infer<typeof formSchema>) {
    try {
      // Salvando diretamente na coleção "clientes"
      const docRef = await addDoc(collection(db, "clientes"), values);
      
      console.log("Cliente salvo com ID: ", docRef.id);
      // toast.success("Cliente salvo com sucesso!");

      form.reset();
      setIsModalOpen(false);

    } catch (error) {
      console.error("Erro ao salvar cliente: ", error);
      // toast.error("Erro ao salvar cliente.");
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

            {/* ===== 6. O FORMULÁRIO ADAPTADO ===== */}
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

      {/* ===== 7. TABELA ADAPTADA PARA CLIENTES ===== */}
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