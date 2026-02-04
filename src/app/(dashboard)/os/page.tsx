// src/app/(dashboard)/os/page.tsx
"use client";

import { useState, useEffect } from "react";
import { useForm, useFieldArray } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import {
  collection,
  onSnapshot,
  getDocs,
  query,
  where,
  Query,
  deleteDoc,
  doc,
  addDoc, 
} from "firebase/firestore";
// --- CORREÇÃO 1: Adicionei 'auth' aqui ---
import { db, auth } from "@/lib/firebase";
import { cn } from "@/lib/utils";
import { Check, ChevronsUpDown, Trash2, Search, Plus } from "lucide-react";
import Link from "next/link";

import { useAuth } from "@/context/AuthContext";
import { useRouter } from "next/navigation";

// --- Importações dos componentes Shadcn ---
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
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from "@/components/ui/command";
import { Textarea } from "@/components/ui/textarea";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";

// --- Tipos de Dados (Interfaces) ---
interface Cliente {
  id: string;
  nome: string;
}
interface Produto {
  id: string;
  nome: string;
  codigoSku?: string;
  precoCusto: number; 
  precoVenda: number;
  estoqueAtual: number;
  tipo: "peca" | "servico";
}
interface Carro {
  id: string;
  modelo: string;
  placa: string;
  clienteId: string;
}

interface OrdemDeServico {
  id: string;
  numeroOS: number;
  dataAbertura: { seconds: number };
  nomeCliente: string;
  veiculoPlaca: string; 
  veiculoModelo?: string;
  status: "aberta" | "finalizada" | "cancelada";
  valorTotal: number;
  ownerId?: string; 
}

// --- Schemas de Validação ---

const osFormSchema = z.object({
  clienteId: z.string().min(1, "Selecione um cliente."),
  veiculoPlaca: z.string().min(3, "Selecione um veículo."),
  veiculoModelo: z.string().optional(),
  servicosDescricao: z.string().optional(),
  garantiaDias: z.coerce.number().int().min(0).default(0),
  itens: z
    .array(
      z.object({
        id: z.string(),
        nome: z.string(),
        qtde: z.coerce.number().min(1, "Qtde deve ser 1+"),
        precoCusto: z.coerce.number(), 
        precoUnitario: z.coerce.number(),
        tipo: z.enum(["peca", "servico"]),
        estoqueAtual: z.number(),
      })
    )
    .min(1, "Adicione pelo menos um item ou serviço."),
});

const clientFormSchema = z.object({
  nome: z.string().min(3, { message: "O nome deve ter pelo menos 3 caracteres." }),
  telefone: z.string().optional(),
  cpfCnpj: z.string().optional(),
});

const vehicleFormSchema = z.object({
  modelo: z.string().min(2, "Informe o modelo."),
  placa: z.string().min(7, "Placa inválida (min 7)."),
  ano: z.string().optional(),
  cor: z.string().optional(),
});

export default function OsPage() {
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isClientModalOpen, setIsClientModalOpen] = useState(false);
  const [isVehicleModalOpen, setIsVehicleModalOpen] = useState(false);

  const [ordensDeServico, setOrdensDeServico] = useState<OrdemDeServico[]>([]);
  const [clientes, setClientes] = useState<Cliente[]>([]);
  const [produtos, setProdutos] = useState<Produto[]>([]);
  const [veiculosCliente, setVeiculosCliente] = useState<Carro[]>([]);
  
  const [isComboboxOpen, setIsComboboxOpen] = useState(false);
  const [searchTerm, setSearchTerm] = useState(""); 
  const [carroSelecionadoId, setCarroSelecionadoId] = useState<string>(""); 

  // --- GUARDIÃO DE ROTA ---
  const { userData, loading: authLoading } = useAuth();
  const router = useRouter();

  if (authLoading) {
    return <div className="flex h-screen w-full items-center justify-center">Carregando permissões...</div>;
  }
  if (!userData) { 
    router.push('/login');
    return null;
  }

  // --- Efeito para Buscar TODOS os dados ---
  useEffect(() => {
    if (userData) {
      const isAdmin = userData.role === 'admin';
      
      let qOS: Query;
      const osRef = collection(db, "ordensDeServico");
      
      if (isAdmin) {
        qOS = query(osRef); 
      } else {
        qOS = query(osRef, where("ownerId", "==", userData.id));
      }
      
      const unsubOS = onSnapshot(qOS, (snapshot) => {
        setOrdensDeServico(
          snapshot.docs.map(
            (doc) => ({ id: doc.id, ...doc.data() } as OrdemDeServico)
          )
        );
      });

      const qClientes = query(collection(db, "clientes"));
      const unsubClientes = onSnapshot(qClientes, (snapshot) => {
        setClientes(
          snapshot.docs.map((doc) => ({ id: doc.id, ...doc.data() } as Cliente))
        );
      });
      
      const unsubProdutos = onSnapshot(collection(db, "produtos"), (snapshot) => {
        setProdutos(
          snapshot.docs.map((doc) => ({ id: doc.id, ...doc.data() } as Produto))
        );
      });
      
      return () => {
        unsubOS();
        unsubClientes();
        unsubProdutos();
      };
    }
  }, [userData]);

  // --- LÓGICA DE FILTRO E ORDENAÇÃO ---
  const ordensFiltradas = ordensDeServico
    .filter((os) => {
      const search = searchTerm.toLowerCase();
      const nome = (os.nomeCliente || "").toLowerCase();
      const num = (os.numeroOS || "").toString();
      const placa = (os.veiculoPlaca || "").toLowerCase();

      return (
        nome.includes(search) ||
        num.includes(search) ||
        placa.includes(search)
      );
    })
    .sort((a, b) => {
        const dateA = a.dataAbertura?.seconds || 0;
        const dateB = b.dataAbertura?.seconds || 0;
        return dateB - dateA;
    }); 

  // --- Configuração dos Formulários ---
  const form = useForm<z.infer<typeof osFormSchema>>({
    resolver: zodResolver(osFormSchema),
    defaultValues: {
      clienteId: "",
      veiculoPlaca: "",
      veiculoModelo: "",
      servicosDescricao: "",
      garantiaDias: 90, 
      itens: [],
    },
  });

  const clientForm = useForm<z.infer<typeof clientFormSchema>>({
    resolver: zodResolver(clientFormSchema),
    defaultValues: { nome: "", telefone: "", cpfCnpj: "" },
  });

  const vehicleForm = useForm<z.infer<typeof vehicleFormSchema>>({
    resolver: zodResolver(vehicleFormSchema),
    defaultValues: { modelo: "", placa: "", ano: "", cor: "" },
  });

  const { fields, append, remove, update } = useFieldArray({
    control: form.control,
    name: "itens",
  });

  // --- Efeito para buscar carros quando o cliente muda ---
  const clienteIdSelecionado = form.watch("clienteId");

  useEffect(() => {
    if (clienteIdSelecionado) {
      form.setValue("veiculoPlaca", "");
      form.setValue("veiculoModelo", "");
      setCarroSelecionadoId("");

      const q = query(
        collection(db, "carros"),
        where("clienteId", "==", clienteIdSelecionado)
      );

      const unsub = onSnapshot(q, (snapshot) => {
        setVeiculosCliente(
          snapshot.docs.map((doc) => ({ id: doc.id, ...doc.data() } as Carro))
        );
      });

      return () => unsub();
    } else {
      setVeiculosCliente([]);
      setCarroSelecionadoId("");
    }
  }, [clienteIdSelecionado, form]);

  // --- Função para selecionar carro ---
  const handleCarroSelecionado = (carroId: string) => {
    setCarroSelecionadoId(carroId);
    const carro = veiculosCliente.find((c) => c.id === carroId);
    if (carro) {
      form.setValue("veiculoPlaca", carro.placa);
      form.setValue("veiculoModelo", carro.modelo);
      form.clearErrors("veiculoPlaca");
    }
  };

  // --- Função adicionarProduto ---
  const adicionarProduto = (produto: Produto) => {
    const itemIndex = fields.findIndex((field) => field.id === produto.id);

    if (itemIndex > -1) {
      const item = fields[itemIndex];
      const novaQtde = item.qtde + 1;
      if (produto.tipo === "peca" && novaQtde > produto.estoqueAtual) {
        alert(
          `Estoque máximo (${produto.estoqueAtual}) atingido para ${produto.nome}.`
        );
        return;
      }
      update(itemIndex, { ...item, qtde: novaQtde });
    } else {
      append({
        id: produto.id,
        nome: produto.nome,
        qtde: 1,
        precoCusto: produto.precoCusto,
        precoUnitario: produto.precoVenda,
        tipo: produto.tipo,
        estoqueAtual: produto.estoqueAtual,
      });
    }
    setIsComboboxOpen(false);
  };

  // --- Cálculos de Total ---
  const watchedItens = form.watch("itens");
  const valorTotalOS = watchedItens.reduce((total, item) => {
    const quantidade = item.qtde || 0; 
    return total + (item.precoUnitario * quantidade);
  }, 0);
  
  const custoTotalOS = watchedItens.reduce((total, item) => {
    const quantidade = item.qtde || 0;
    if (item.tipo === 'peca') {
      return total + (item.precoCusto * quantidade);
    }
    return total;
  }, 0);


  // --- FUNÇÃO ON SUBMIT (ATUALIZADA PARA VERCEL) ---
  async function onSubmit(values: z.infer<typeof osFormSchema>) {
    
    if (!userData) {
      alert("Erro: Usuário não autenticado.");
      return;
    }

    try {
      let q: Query;
      const osRef = collection(db, "ordensDeServico");
      
      if (userData.role === 'admin') {
         q = query(
          osRef,
          where("clienteId", "==", values.clienteId),
          where("status", "==", "aberta")
         );
      } else {
         q = query(
          osRef,
          where("clienteId", "==", values.clienteId),
          where("status", "==", "aberta"),
          where("ownerId", "==", userData.id) 
         );
      }
      
      const querySnapshot = await getDocs(q);
      
      if (!querySnapshot.empty) {
        alert("Erro: Este cliente já possui uma Ordem de Serviço em aberto.");
        return; 
      }
    } catch (error) {
      console.error("Erro ao verificar OS existente:", error);
      alert("Erro ao verificar OS existente. Tente novamente.");
      return;
    }

    const clienteSelecionado = clientes.find((c) => c.id === values.clienteId);
    if (!clienteSelecionado) {
      console.error("Cliente não encontrado");
      return;
    }

    const novaOSParaEnvio = {
      numeroOS: Math.floor(Math.random() * 10000) + 1,
      dataAbertura: new Date(), 
      status: "aberta" as "aberta",
      clienteId: values.clienteId,
      nomeCliente: clienteSelecionado.nome,
      veiculoPlaca: values.veiculoPlaca.toUpperCase(),
      veiculoModelo: values.veiculoModelo,
      servicosDescricao: values.servicosDescricao,
      garantiaDias: values.garantiaDias, 
      itens: values.itens.map((item) => ({ 
        id: item.id,
        nome: item.nome,
        qtde: item.qtde,
        precoCusto: item.precoCusto,
        precoUnitario: item.precoUnitario,
        tipo: item.tipo,
      })),
      valorTotal: valorTotalOS,
      custoTotal: custoTotalOS,
      ownerId: userData.id 
    };

    try {
      // --- CORREÇÃO 2: Pegar Token de Autenticação ---
      const token = await auth.currentUser?.getIdToken();

      // --- CORREÇÃO 3: Chamar API Vercel (/api/os/create) ---
      const response = await fetch('/api/os/create', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}` // Header de Segurança
        },
        body: JSON.stringify({
          novaOS: novaOSParaEnvio, 
          itens: values.itens,
        }),
      });

      const result = await response.json();

      if (!response.ok) {
        throw new Error(result.error || "Erro desconhecido ao salvar OS");
      }

      console.log("OS salva pela Vercel API!", result.message);
      form.reset();
      setCarroSelecionadoId(""); 
      setIsModalOpen(false);
      alert("Ordem de Serviço criada com sucesso!");

    } catch (error: any) {
      console.error("Erro ao criar OS: ", error);
      alert("Erro ao salvar: " + error.message);
    }
  }

  // --- SUBMITS RÁPIDOS ---
  async function onClientSubmit(values: z.infer<typeof clientFormSchema>) {
    if (!userData) return;
    try {
      const docRef = await addDoc(collection(db, "clientes"), { ...values, ownerId: userData.id });
      setIsClientModalOpen(false);
      clientForm.reset();
      form.setValue("clienteId", docRef.id);
      alert("Cliente cadastrado e selecionado!");
    } catch (error) { console.error(error); alert("Erro ao cadastrar."); }
  }

  async function onVehicleSubmit(values: z.infer<typeof vehicleFormSchema>) {
    if (!userData) return;
    const clienteIdAtual = form.getValues("clienteId");
    if (!clienteIdAtual) { alert("Selecione um cliente antes."); return; }
    
    const clienteObj = clientes.find(c => c.id === clienteIdAtual);

    try {
      const docRef = await addDoc(collection(db, "carros"), {
        ...values,
        placa: values.placa.toUpperCase(),
        clienteId: clienteIdAtual,
        nomeCliente: clienteObj?.nome || "Desconhecido",
        ownerId: userData.id
      });
      
      setIsVehicleModalOpen(false);
      vehicleForm.reset();
      
      setCarroSelecionadoId(docRef.id);
      form.setValue("veiculoPlaca", values.placa.toUpperCase());
      form.setValue("veiculoModelo", values.modelo);
      form.clearErrors("veiculoPlaca");

      alert("Veículo cadastrado e selecionado!");
    } catch (error) { console.error(error); alert("Erro ao cadastrar."); }
  }

  return (
    <div>
      <div className="flex flex-col md:flex-row justify-between items-center mb-6 gap-4">
        <h1 className="text-4xl font-bold">Ordens de Serviço</h1>
        <Dialog open={isModalOpen} onOpenChange={setIsModalOpen}>
          <DialogTrigger asChild>
            <Button>Criar Nova OS</Button>
          </DialogTrigger>
          <DialogContent className="sm:max-w-3xl">
            <DialogHeader>
              <DialogTitle>Criar Nova Ordem de Serviço</DialogTitle>
              <DialogDescription>
                Preencha as informações do cliente, veículo e os serviços/peças.
              </DialogDescription>
            </DialogHeader>
            <Form {...form}>
              <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
                
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <FormField
                    control={form.control}
                    name="clienteId"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Cliente</FormLabel>
                        <div className="flex gap-2">
                          <Select onValueChange={field.onChange} value={field.value}>
                            <FormControl><SelectTrigger className="w-full"><SelectValue placeholder="Selecione..." /></SelectTrigger></FormControl>
                            <SelectContent>
                              {clientes.map((c) => (<SelectItem key={c.id} value={c.id}>{c.nome}</SelectItem>))}
                            </SelectContent>
                          </Select>
                          <Button type="button" variant="outline" size="icon" onClick={() => setIsClientModalOpen(true)} title="Novo Cliente"><Plus className="h-4 w-4" /></Button>
                        </div>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  {clienteIdSelecionado && (
                     <FormItem>
                        <FormLabel>Veículo</FormLabel>
                        <div className="flex gap-2">
                          <Select onValueChange={handleCarroSelecionado} value={carroSelecionadoId}>
                            <FormControl><SelectTrigger className="w-full"><SelectValue placeholder="Selecione..." /></SelectTrigger></FormControl>
                            <SelectContent>
                              {veiculosCliente.length > 0 ? (
                                veiculosCliente.map((carro) => (
                                  <SelectItem key={carro.id} value={carro.id}>{carro.modelo} - {carro.placa}</SelectItem>
                                ))
                              ) : (
                                <div className="p-2 text-sm text-muted-foreground text-center">Nenhum veículo cadastrado.</div>
                              )}
                            </SelectContent>
                          </Select>
                          <Button type="button" variant="outline" size="icon" onClick={() => setIsVehicleModalOpen(true)} title="Novo Veículo"><Plus className="h-4 w-4" /></Button>
                        </div>
                        {form.formState.errors.veiculoPlaca && (
                          <p className="text-sm font-medium text-destructive mt-1">Selecione um veículo obrigatório.</p>
                        )}
                      </FormItem>
                  )}
                </div>

                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  <FormField
                    control={form.control}
                    name="servicosDescricao"
                    render={({ field }) => (
                      <FormItem className="md:col-span-2">
                        <FormLabel>Descrição dos Serviços / Observações</FormLabel>
                        <FormControl>
                          <Textarea
                            placeholder="Descreva os serviços a serem realizados..."
                            {...field}
                          />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  <FormField
                    control={form.control}
                    name="garantiaDias"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Garantia (dias)</FormLabel>
                        <FormControl>
                          <Input type="number" placeholder="Ex: 90" {...field} />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                </div>

                <div>
                  <FormLabel>Adicionar Peças e Serviços</FormLabel>
                  <Popover open={isComboboxOpen} onOpenChange={setIsComboboxOpen}>
                    <PopoverTrigger asChild>
                      <Button variant="outline" role="combobox" className="w-full justify-between mt-2">
                        Selecione um item...
                        <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
                      </Button>
                    </PopoverTrigger>
                    <PopoverContent className="w-[--radix-popover-trigger-width] p-0">
                      <Command>
                        <CommandInput placeholder="Buscar item (Nome ou Código)..." />
                        <CommandList>
                          <CommandEmpty>Nenhum item encontrado.</CommandEmpty>
                          <CommandGroup>
                            {produtos.map((produto) => (
                              <CommandItem
                                key={produto.id}
                                value={`${produto.nome} ${produto.codigoSku || ''}`}
                                onSelect={() => { adicionarProduto(produto); }}
                              >
                                <Check
                                  className={cn("mr-2 h-4 w-4", fields.some((item) => item.id === produto.id) ? "opacity-100" : "opacity-0")}
                                />
                                <div className="flex flex-col">
                                  <span>{produto.nome} {produto.tipo === "peca" && `(Estoque: ${produto.estoqueAtual})`}</span>
                                  {produto.codigoSku && (
                                    <span className="text-xs text-muted-foreground">Cód: {produto.codigoSku}</span>
                                  )}
                                </div>
                              </CommandItem>
                            ))}
                          </CommandGroup>
                        </CommandList>
                      </Command>
                    </PopoverContent>
                  </Popover>
                  <FormMessage>{form.formState.errors.itens?.message}</FormMessage>
                </div>

                <div className="rounded-md border">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Item</TableHead>
                        <TableHead className="w-[100px]">Qtde</TableHead>
                        <TableHead className="w-[120px]">Vl. Unit.</TableHead>
                        <TableHead className="w-[120px]">Vl. Total</TableHead>
                        <TableHead className="w-[50px]">Ações</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {fields.length === 0 && (
                        <TableRow>
                          <TableCell colSpan={5} className="text-center">Nenhum item adicionado.</TableCell>
                        </TableRow>
                      )}
                      {fields.map((item, index) => (
                        <TableRow key={item.id}>
                          <TableCell>{item.nome}</TableCell>
                          <TableCell>
                            <FormField
                              control={form.control}
                              name={`itens.${index}.qtde`}
                              render={({ field }) => (
                                <Input
                                  type="number"
                                  className="h-8"
                                  {...field}
                                  onChange={(e) => {
                                    const novaQtde = parseInt(e.target.value) || 0;
                                    if (item.tipo === "peca" && novaQtde > item.estoqueAtual) {
                                      form.setError(`itens.${index}.qtde`, {
                                        type: "manual",
                                        message: `Max: ${item.estoqueAtual}`,
                                      });
                                    } else {
                                      form.clearErrors(`itens.${index}.qtde`);
                                    }
                                    field.onChange(novaQtde);
                                  }}
                                />
                              )}
                            />
                            <FormMessage>{form.formState.errors.itens?.[index]?.qtde?.message}</FormMessage>
                          </TableCell>
                          <TableCell>R$ {item.precoUnitario.toFixed(2)}</TableCell>
                          <TableCell>R$ {(item.precoUnitario * (item.qtde || 0)).toFixed(2)}</TableCell>
                          <TableCell>
                            <Button type="button" variant="destructive" size="icon-sm" onClick={() => remove(index)}>
                              <Trash2 className="h-4 w-4" />
                            </Button>
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
                
                <div className="flex justify-between items-center">
                  <h2 className="text-lg font-medium text-gray-600">
                    Custo Peças: R$ {custoTotalOS.toFixed(2)}
                  </h2>
                  <h2 className="text-2xl font-bold">
                    Total da OS: R$ {valorTotalOS.toFixed(2)}
                  </h2>
                </div>
                <DialogFooter>
                  <Button type="submit" disabled={form.formState.isSubmitting}>
                    {form.formState.isSubmitting ? "Salvando..." : "Salvar Ordem de Serviço"}
                  </Button>
                </DialogFooter>
              </form>
            </Form>
          </DialogContent>
        </Dialog>

        <Dialog open={isClientModalOpen} onOpenChange={setIsClientModalOpen}>
          <DialogContent className="sm:max-w-[425px]">
            <DialogHeader>
              <DialogTitle>Cadastro Rápido de Cliente</DialogTitle>
            </DialogHeader>
            <Form {...clientForm}>
              <form onSubmit={clientForm.handleSubmit(onClientSubmit)} className="space-y-4">
                <FormField
                  control={clientForm.control}
                  name="nome"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Nome</FormLabel>
                      <FormControl><Input placeholder="Ex: João da Silva" {...field} /></FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={clientForm.control}
                  name="telefone"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Telefone</FormLabel>
                      <FormControl><Input placeholder="(00) 00000-0000" {...field} /></FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={clientForm.control}
                  name="cpfCnpj"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>CPF/CNPJ</FormLabel>
                      <FormControl><Input placeholder="000.000.000-00" {...field} /></FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <DialogFooter>
                  <Button type="submit" disabled={clientForm.formState.isSubmitting}>Salvar</Button>
                </DialogFooter>
              </form>
            </Form>
          </DialogContent>
        </Dialog>

        <Dialog open={isVehicleModalOpen} onOpenChange={setIsVehicleModalOpen}>
          <DialogContent className="sm:max-w-[425px]">
            <DialogHeader>
              <DialogTitle>Cadastro Rápido de Veículo</DialogTitle>
            </DialogHeader>
            <Form {...vehicleForm}>
              <form onSubmit={vehicleForm.handleSubmit(onVehicleSubmit)} className="space-y-4">
                <FormField
                  control={vehicleForm.control}
                  name="modelo"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Modelo</FormLabel>
                      <FormControl><Input placeholder="Ex: Fiat Uno" {...field} /></FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <div className="grid grid-cols-2 gap-4">
                  <FormField
                    control={vehicleForm.control}
                    name="placa"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Placa</FormLabel>
                        <FormControl><Input placeholder="ABC-1234" {...field} className="uppercase" /></FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  <FormField
                    control={vehicleForm.control}
                    name="ano"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Ano</FormLabel>
                        <FormControl><Input placeholder="2015" {...field} /></FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                </div>
                <FormField
                  control={vehicleForm.control}
                  name="cor"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Cor</FormLabel>
                      <FormControl><Input placeholder="Prata" {...field} /></FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <DialogFooter>
                  <Button type="submit" disabled={vehicleForm.formState.isSubmitting}>Salvar</Button>
                </DialogFooter>
              </form>
            </Form>
          </DialogContent>
        </Dialog>

      </div>

      <div className="relative mb-6">
        <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 h-5 w-5" />
        <Input 
          placeholder="Pesquisar por cliente, placa ou número da OS..." 
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
          className="pl-10 text-lg py-6"
        />
      </div>

      <div className="rounded-md border">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Nº OS</TableHead>
              <TableHead>Cliente</TableHead>
              <TableHead>Placa</TableHead>
              <TableHead>Data</TableHead>
              <TableHead>Status</TableHead>
              <TableHead>Valor Total</TableHead>
              <TableHead>Ações</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {ordensFiltradas.length === 0 && (
              <TableRow>
                <TableCell colSpan={7} className="text-center py-8 text-muted-foreground">
                  Nenhuma OS encontrada.
                </TableCell>
              </TableRow>
            )}
            {ordensFiltradas.map((os) => (
              <TableRow key={os.id}>
                <TableCell>
                  <Link
                    href={`/os/${os.id}`}
                    className="font-medium text-primary hover:underline"
                  >
                    {os.numeroOS}
                  </Link>
                </TableCell>
                <TableCell className="font-medium">{os.nomeCliente}</TableCell>
                <TableCell>{os.veiculoPlaca}</TableCell>
                <TableCell>
                  {os.dataAbertura && os.dataAbertura.seconds
                    ? new Date(os.dataAbertura.seconds * 1000).toLocaleDateString()
                    : "Data Inválida"}
                </TableCell>
                <TableCell>{os.status}</TableCell>
                <TableCell>R$ {os.valorTotal.toFixed(2)}</TableCell>
                <TableCell className="flex items-center">
                  <Button asChild variant="outline" size="sm">
                    <Link href={`/os/${os.id}`}>Ver Detalhes</Link>
                  </Button>
                  
                  {userData?.role === 'admin' && (
                    <Button 
                      variant="destructive" 
                      size="sm" 
                      className="ml-2"
                      onClick={async () => {
                        const confirmacao = confirm(`Tem certeza que deseja excluir a OS #${os.numeroOS}?`);
                        if (confirmacao) {
                          try {
                             await deleteDoc(doc(db, "ordensDeServico", os.id));
                             alert("OS excluída com sucesso!");
                          } catch (error) {
                             console.error("Erro ao excluir:", error);
                             alert("Erro ao excluir OS.");
                          }
                        }
                      }}
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  )}
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>
    </div>
  );
}