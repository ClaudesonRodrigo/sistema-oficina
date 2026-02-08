// src/app/(dashboard)/carros/page.tsx
"use client";

import { useState, useEffect } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { 
  collection, 
  addDoc, 
  onSnapshot, 
  query, 
  where, 
  deleteDoc,
  doc,
  serverTimestamp
} from "firebase/firestore"; 
import { db } from "@/lib/firebase";
import { useAuth } from "@/context/AuthContext";
import { useRouter } from "next/navigation";
import { toast } from "sonner"; // UX Melhorada

// Ícones
import { Search, Loader2, Trash2, CarFront, AlertCircle } from "lucide-react";

// Tipos Centralizados
import { Cliente, Carro } from "@/types";

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

// Schema de Validação
const formSchema = z.object({
  clienteId: z.string().min(1, "Selecione um cliente."),
  modelo: z.string().min(2, "Informe o modelo do veículo."),
  placa: z.string().min(7, "A placa deve ter pelo menos 7 caracteres."),
  ano: z.string().optional(),
  cor: z.string().optional(),
});

export default function CarrosPage() {
  const [isModalOpen, setIsModalOpen] = useState(false);
  
  // Estados de Dados
  const [carros, setCarros] = useState<Carro[]>([]);
  const [clientes, setClientes] = useState<Cliente[]>([]);
  
  // Busca
  const [searchTerm, setSearchTerm] = useState("");

  const { userData, loading: authLoading } = useAuth();
  const router = useRouter();

  // Guardião de Rota
  if (authLoading) {
    return <div className="flex h-screen w-full items-center justify-center"><Loader2 className="h-8 w-8 animate-spin text-primary"/></div>;
  }
  if (!userData) { 
    router.push('/login');
    return null;
  }

  // Buscar Dados
  useEffect(() => {
    if (userData) {
      const isAdmin = userData.role === 'admin';
      
      // 1. Buscar Clientes
      const clientesRef = collection(db, "clientes");
      const qClientes = isAdmin ? query(clientesRef) : query(clientesRef, where("ownerId", "==", userData.id));
      
      const unsubClientes = onSnapshot(qClientes, (snapshot) => {
        setClientes(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Cliente)));
      });

      // 2. Buscar Carros
      const carrosRef = collection(db, "carros");
      const qCarros = isAdmin ? query(carrosRef) : query(carrosRef, where("ownerId", "==", userData.id));

      const unsubCarros = onSnapshot(qCarros, (snapshot) => {
        const listaCarros: Carro[] = [];
        snapshot.forEach((doc) => {
          // @ts-ignore - Ignorando erro de tipagem do createdAt por enquanto
          listaCarros.push({ id: doc.id, ...doc.data() } as Carro);
        });
        
        // Ordenação no Front: Novos primeiro (baseado em createdAt ou fallback)
        // Se não tiver data, joga pro final
        listaCarros.sort((a: any, b: any) => {
            const dateA = a.createdAt?.seconds || 0;
            const dateB = b.createdAt?.seconds || 0;
            return dateB - dateA;
        });

        setCarros(listaCarros);
      });

      return () => {
        unsubClientes();
        unsubCarros();
      };
    }
  }, [userData]);

  // --- LÓGICA DE FILTRO INTELIGENTE ---
  // Se tiver busca: Mostra tudo que bater
  // Se NÃO tiver busca: Mostra só os top 30
  const carrosFiltrados = carros.filter((carro) => {
    const termo = searchTerm.toLowerCase();
    const modelo = (carro.modelo || "").toLowerCase();
    const placa = (carro.placa || "").toLowerCase();
    const dono = (carro.nomeCliente || "").toLowerCase();

    return modelo.includes(termo) || placa.includes(termo) || dono.includes(termo);
  });

  const carrosParaExibir = searchTerm 
    ? carrosFiltrados 
    : carrosFiltrados.slice(0, 30); // LIMITA A 30 VISUALMENTE

  const form = useForm<z.infer<typeof formSchema>>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      clienteId: "",
      modelo: "",
      placa: "",
      ano: "",
      cor: "",
    },
  });

  async function onSubmit(values: z.infer<typeof formSchema>) {
    if (!userData) return;

    try {
      const clienteSelecionado = clientes.find(c => c.id === values.clienteId);
      
      await addDoc(collection(db, "carros"), {
        ...values,
        placa: values.placa.replace(/[^a-zA-Z0-9]/g, "").toUpperCase(), 
        nomeCliente: clienteSelecionado?.nome || "Desconhecido",
        ownerId: userData.id,
        createdAt: serverTimestamp() // Adiciona data para ordenar
      });

      toast.success("Veículo cadastrado com sucesso!");
      form.reset();
      setIsModalOpen(false);

    } catch (error) {
      console.error("Erro:", error);
      toast.error("Erro ao cadastrar veículo.");
    }
  }

  const handleDelete = async (carroId: string) => {
    if (confirm("Tem certeza que deseja excluir este veículo?")) {
       try {
         await deleteDoc(doc(db, "carros", carroId));
         toast.success("Veículo excluído.");
       } catch (error) {
         console.error(error);
         toast.error("Erro ao excluir veículo.");
       }
    }
  }

  return (
    <div>
      <div className="flex flex-col md:flex-row justify-between items-center mb-6 gap-4">
        <h1 className="text-4xl font-bold flex items-center gap-2">
          <CarFront className="h-10 w-10" /> Veículos
        </h1>
        
        <Dialog open={isModalOpen} onOpenChange={setIsModalOpen}>
          <DialogTrigger asChild>
            <Button size="lg" className="w-full md:w-auto">Cadastrar Veículo</Button>
          </DialogTrigger>
          <DialogContent className="sm:max-w-[425px]">
            <DialogHeader>
              <DialogTitle>Novo Veículo</DialogTitle>
              <DialogDescription>
                Cadastre o veículo e vincule a um cliente.
              </DialogDescription>
            </DialogHeader>

            <Form {...form}>
              <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
                
                <FormField
                  control={form.control}
                  name="clienteId"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Dono (Cliente)</FormLabel>
                      <Select onValueChange={field.onChange} defaultValue={field.value}>
                        <FormControl>
                          <SelectTrigger>
                            <SelectValue placeholder="Selecione o cliente..." />
                          </SelectTrigger>
                        </FormControl>
                        <SelectContent>
                          {clientes.map((cliente) => (
                            <SelectItem key={cliente.id} value={cliente.id}>
                              {cliente.nome}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="modelo"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Modelo</FormLabel>
                      <FormControl>
                        <Input placeholder="Ex: Fiat Uno" {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <div className="grid grid-cols-2 gap-4">
                  <FormField
                    control={form.control}
                    name="placa"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Placa</FormLabel>
                        <FormControl>
                          <Input placeholder="ABC-1234" {...field} className="uppercase" />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  <FormField
                    control={form.control}
                    name="ano"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Ano</FormLabel>
                        <FormControl>
                          <Input placeholder="2010" {...field} />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                </div>

                <FormField
                  control={form.control}
                  name="cor"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Cor</FormLabel>
                      <FormControl>
                        <Input placeholder="Ex: Prata" {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <DialogFooter>
                  <Button type="submit" disabled={form.formState.isSubmitting}>
                    {form.formState.isSubmitting ? "Salvando..." : "Salvar Veículo"}
                  </Button>
                </DialogFooter>
              </form>
            </Form>
          </DialogContent>
        </Dialog>
      </div>

      {/* --- BARRA DE PESQUISA --- */}
      <div className="relative mb-6">
        <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 h-5 w-5" />
        <Input 
          placeholder="Pesquisar por modelo, placa ou nome do dono..." 
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
          className="pl-10 text-lg py-6"
        />
      </div>

      {/* --- TABELA (Inteligente) --- */}
      <div className="rounded-md border">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Modelo</TableHead>
              <TableHead>Placa</TableHead>
              <TableHead>Cor</TableHead>
              <TableHead>Cliente (Dono)</TableHead>
              <TableHead className="text-right">Ações</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {carrosParaExibir.length === 0 && (
               <TableRow>
                 <TableCell colSpan={5} className="text-center py-8 text-gray-500">
                   {searchTerm ? "Nenhum veículo encontrado na busca." : "Nenhum veículo cadastrado."}
                 </TableCell>
               </TableRow>
            )}
            {carrosParaExibir.map((carro) => (
              <TableRow key={carro.id}>
                <TableCell className="font-medium">{carro.modelo}</TableCell>
                <TableCell>
                  <span className="bg-gray-100 px-2 py-1 rounded font-mono font-bold text-gray-700">
                    {carro.placa}
                  </span>
                </TableCell>
                <TableCell>{carro.cor || "-"}</TableCell>
                <TableCell>{carro.nomeCliente}</TableCell>
                <TableCell className="text-right">
                   <Button 
                      variant="destructive" 
                      size="sm" 
                      onClick={() => handleDelete(carro.id)}
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>
      
      {/* Aviso de Lista Limitada (Aparece só quando não tem busca e tem muitos carros) */}
      {!searchTerm && carros.length > 30 && (
        <div className="mt-4 flex items-center justify-center text-sm text-muted-foreground gap-2">
          <AlertCircle className="h-4 w-4" />
          <span>Exibindo os 30 veículos mais recentes de um total de {carros.length}. Use a busca acima para encontrar outros.</span>
        </div>
      )}
    </div>
  );
}