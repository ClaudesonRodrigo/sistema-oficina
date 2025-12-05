// src/app/(dashboard)/orcamentos/page.tsx
"use client";

import { useState, useEffect } from "react";
import { useForm, useFieldArray } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import {
  collection,
  onSnapshot,
  query,
  where,
  Query,
  deleteDoc,
  doc,
  addDoc, 
} from "firebase/firestore";
import { db } from "@/lib/firebase";
import { cn } from "@/lib/utils";
import { Check, ChevronsUpDown, Trash2, Plus, Search } from "lucide-react";
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
  codigoSku?: string; // Adicionado SKU
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

interface Orcamento {
  id: string;
  numeroOrcamento: number;
  dataCriacao: { seconds: number };
  nomeCliente: string;
  veiculoPlaca: string;
  veiculoModelo: string;
  valorTotal: number;
  ownerId?: string; 
  status: "pendente" | "aprovado" | "recusado";
}

// --- Schema de Validação do Orçamento ---
const orcamentoFormSchema = z.object({
  clienteId: z.string().min(1, "Selecione um cliente."),
  // Campos ocultos preenchidos automaticamente (obrigatórios no banco)
  veiculoPlaca: z.string().min(3, "Selecione um veículo."), 
  veiculoModelo: z.string().optional(),
  servicosDescricao: z.string().optional(),
  validadeDias: z.coerce.number().int().min(1).default(15),
  itens: z
    .array(
      z.object({
        id: z.string(),
        nome: z.string(),
        qtde: z.coerce.number().min(1, "Qtde deve ser 1+"),
        precoUnitario: z.coerce.number(),
        tipo: z.enum(["peca", "servico"]),
      })
    )
    .min(1, "Adicione pelo menos um item ou serviço."),
});

// --- Schema de Validação do Cliente Rápido ---
const clientFormSchema = z.object({
  nome: z.string().min(3, { message: "O nome deve ter pelo menos 3 caracteres." }),
  telefone: z.string().optional(),
  cpfCnpj: z.string().optional(),
});

// --- Schema de Validação do Veículo Rápido ---
const vehicleFormSchema = z.object({
  modelo: z.string().min(2, "Informe o modelo."),
  placa: z.string().min(7, "Placa inválida (min 7)."),
  ano: z.string().optional(),
  cor: z.string().optional(),
});

export default function OrcamentosPage() {
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isClientModalOpen, setIsClientModalOpen] = useState(false);
  const [isVehicleModalOpen, setIsVehicleModalOpen] = useState(false);

  const [orcamentos, setOrcamentos] = useState<Orcamento[]>([]);
  const [clientes, setClientes] = useState<Cliente[]>([]);
  const [produtos, setProdutos] = useState<Produto[]>([]);
  
  const [veiculosCliente, setVeiculosCliente] = useState<Carro[]>([]);
  const [carroSelecionadoId, setCarroSelecionadoId] = useState<string>(""); 
  
  const [isComboboxOpen, setIsComboboxOpen] = useState(false);

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
  if (!userData) { 
    router.push('/login');
    return (
       <div className="flex h-screen w-full items-center justify-center">
         Redirecionando...
       </div>
    );
  }

  // --- Efeito para Buscar TODOS os dados ---
  useEffect(() => {
    if (userData) {
      const isAdmin = userData.role === 'admin';
      
      // 1. Lógica de Busca de Orçamentos
      let qOrcamentos: Query;
      const orcRef = collection(db, "orcamentos");
      
      if (isAdmin) {
        qOrcamentos = query(orcRef); 
      } else {
        qOrcamentos = query(orcRef, where("ownerId", "==", userData.id));
      }
      
      const unsubOrcamentos = onSnapshot(qOrcamentos, (snapshot) => {
        setOrcamentos(
          snapshot.docs.map(
            (doc) => ({ id: doc.id, ...doc.data() } as Orcamento)
          )
        );
      });

      // 2. Busca de Clientes
      const qClientes = query(collection(db, "clientes"));
      const unsubClientes = onSnapshot(qClientes, (snapshot) => {
        setClientes(
          snapshot.docs.map((doc) => ({ id: doc.id, ...doc.data() } as Cliente))
        );
      });
      
      // 3. Busca Produtos
      const unsubProdutos = onSnapshot(collection(db, "produtos"), (snapshot) => {
        setProdutos(
          snapshot.docs.map((doc) => ({ id: doc.id, ...doc.data() } as Produto))
        );
      });
      
      return () => {
        unsubOrcamentos();
        unsubClientes();
        unsubProdutos();
      };
    }
  }, [userData]);

  // --- Configuração do Formulário ---
  const form = useForm<z.infer<typeof orcamentoFormSchema>>({
    resolver: zodResolver(orcamentoFormSchema),
    defaultValues: {
      clienteId: "",
      veiculoPlaca: "",
      veiculoModelo: "",
      servicosDescricao: "",
      validadeDias: 15, 
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
      // Limpa dados anteriores
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
      update(itemIndex, { ...item, qtde: novaQtde });
    } else {
      append({
        id: produto.id,
        nome: produto.nome,
        qtde: 1,
        precoUnitario: produto.precoVenda,
        tipo: produto.tipo,
      });
    }
    setIsComboboxOpen(false);
  };

  // --- Cálculos de Total ---
  const watchedItens = form.watch("itens");
  const valorTotalOrcamento = watchedItens.reduce((total, item) => {
    const quantidade = item.qtde || 0; 
    return total + (item.precoUnitario * quantidade);
  }, 0);
  
  // --- SUBMIT DO ORÇAMENTO ---
  async function onSubmit(values: z.infer<typeof orcamentoFormSchema>) {
    if (!userData) {
      alert("Erro: Usuário não autenticado.");
      return;
    }

    const clienteSelecionado = clientes.find((c) => c.id === values.clienteId);
    if (!clienteSelecionado) {
      console.error("Cliente não encontrado");
      return;
    }

    const novoOrcamento = {
      numeroOrcamento: Math.floor(Math.random() * 100000) + 1,
      dataCriacao: new Date(), 
      status: "pendente",
      clienteId: values.clienteId,
      nomeCliente: clienteSelecionado.nome,
      veiculoPlaca: values.veiculoPlaca.toUpperCase(),
      veiculoModelo: values.veiculoModelo,
      servicosDescricao: values.servicosDescricao,
      validadeDias: values.validadeDias, 
      itens: values.itens.map((item) => ({ 
        id: item.id,
        nome: item.nome,
        qtde: item.qtde,
        precoUnitario: item.precoUnitario,
        tipo: item.tipo,
      })),
      valorTotal: valorTotalOrcamento,
      ownerId: userData.id 
    };

    try {
      await addDoc(collection(db, "orcamentos"), novoOrcamento);
      console.log("Orçamento criado com sucesso!");
      form.reset();
      setCarroSelecionadoId(""); // Limpa seleção visual
      setIsModalOpen(false);
    } catch (error: any) {
      console.error("Erro ao criar orçamento: ", error);
      alert("Erro ao salvar: " + error.message);
    }
  }

  // --- SUBMIT DO CLIENTE RÁPIDO ---
  async function onClientSubmit(values: z.infer<typeof clientFormSchema>) {
    if (!userData) return;
    try {
      const docRef = await addDoc(collection(db, "clientes"), {
        ...values,
        ownerId: userData.id
      });
      setIsClientModalOpen(false);
      clientForm.reset();
      form.setValue("clienteId", docRef.id);
      alert("Cliente cadastrado e selecionado!");
    } catch (error) {
      console.error("Erro ao cadastrar cliente rápido:", error);
      alert("Erro ao cadastrar cliente.");
    }
  }

  // --- SUBMIT DO VEÍCULO RÁPIDO ---
  async function onVehicleSubmit(values: z.infer<typeof vehicleFormSchema>) {
    if (!userData) return;
    const clienteIdAtual = form.getValues("clienteId");
    
    if (!clienteIdAtual) {
      alert("Selecione um cliente antes de cadastrar o veículo.");
      return;
    }

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
      
      // Auto-seleciona
      setCarroSelecionadoId(docRef.id);
      form.setValue("veiculoPlaca", values.placa.toUpperCase());
      form.setValue("veiculoModelo", values.modelo);
      form.clearErrors("veiculoPlaca");

      alert("Veículo cadastrado e selecionado!");
    } catch (error) {
      console.error("Erro ao cadastrar veículo rápido:", error);
      alert("Erro ao cadastrar veículo.");
    }
  }

  return (
    <div>
      <div className="flex justify-between items-center mb-6">
        <h1 className="text-4xl font-bold">Orçamentos</h1>
        <Dialog open={isModalOpen} onOpenChange={setIsModalOpen}>
          <DialogTrigger asChild>
            <Button>Novo Orçamento</Button>
          </DialogTrigger>
          <DialogContent className="sm:max-w-3xl">
            <DialogHeader>
              <DialogTitle>Criar Novo Orçamento</DialogTitle>
              <DialogDescription>
                Preencha os dados. O estoque não será alterado.
              </DialogDescription>
            </DialogHeader>
            <Form {...form}>
              <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
                
                {/* --- SEÇÃO DADOS DO CLIENTE --- */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <FormField
                    control={form.control}
                    name="clienteId"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Cliente</FormLabel>
                        <div className="flex gap-2">
                          <Select onValueChange={field.onChange} value={field.value}>
                            <FormControl>
                              <SelectTrigger className="w-full">
                                <SelectValue placeholder="Selecione um cliente" />
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
                          
                          {/* BOTÃO + CLIENTE */}
                          <Button 
                            type="button" 
                            variant="outline" 
                            size="icon"
                            onClick={() => setIsClientModalOpen(true)}
                            title="Novo Cliente"
                          >
                            <Plus className="h-4 w-4" />
                          </Button>
                        </div>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  {/* SEÇÃO VEÍCULO (AGORA SEMPRE VISÍVEL SE TIVER CLIENTE) */}
                  {clienteIdSelecionado && (
                     <FormItem>
                        <FormLabel>Veículo Cadastrado</FormLabel>
                        <div className="flex gap-2">
                          <Select onValueChange={handleCarroSelecionado} value={carroSelecionadoId}>
                            <FormControl>
                              <SelectTrigger className="w-full">
                                <SelectValue placeholder="Selecione o veículo..." />
                              </SelectTrigger>
                            </FormControl>
                            <SelectContent>
                              {veiculosCliente.length > 0 ? (
                                veiculosCliente.map((carro) => (
                                  <SelectItem key={carro.id} value={carro.id}>
                                    {carro.modelo} - {carro.placa}
                                  </SelectItem>
                                ))
                              ) : (
                                <div className="p-2 text-sm text-muted-foreground text-center">
                                  Nenhum veículo cadastrado.
                                </div>
                              )}
                            </SelectContent>
                          </Select>

                          {/* BOTÃO + VEÍCULO */}
                          <Button 
                            type="button" 
                            variant="outline" 
                            size="icon"
                            onClick={() => setIsVehicleModalOpen(true)}
                            title="Novo Veículo"
                          >
                            <Plus className="h-4 w-4" />
                          </Button>
                        </div>
                        {form.formState.errors.veiculoPlaca && (
                          <p className="text-sm font-medium text-destructive mt-1">
                            Selecione um veículo obrigatório.
                          </p>
                        )}
                      </FormItem>
                  )}
                </div>

                {/* --- INPUTS MANUAIS REMOVIDOS AQUI --- */}

                {/* --- SEÇÃO OBSERVAÇÕES E VALIDADE --- */}
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  <FormField
                    control={form.control}
                    name="servicosDescricao"
                    render={({ field }) => (
                      <FormItem className="md:col-span-2">
                        <FormLabel>Descrição dos Serviços / Observações</FormLabel>
                        <FormControl>
                          <Textarea
                            placeholder="Descreva os serviços..."
                            {...field}
                          />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  <FormField
                    control={form.control}
                    name="validadeDias"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Validade (dias)</FormLabel>
                        <FormControl>
                          <Input type="number" placeholder="Ex: 15" {...field} />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                </div>

                {/* --- SEÇÃO ADICIONAR ITENS (COM LUPA E CÓDIGO) --- */}
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
                                value={`${produto.nome} ${produto.codigoSku || ''}`} // BUSCA PELO NOME E CÓDIGO
                                onSelect={() => { adicionarProduto(produto); }}
                              >
                                <Check
                                  className={cn("mr-2 h-4 w-4", fields.some((item) => item.id === produto.id) ? "opacity-100" : "opacity-0")}
                                />
                                <div className="flex flex-col">
                                  <span>{produto.nome} ({produto.tipo})</span>
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

                {/* --- TABELA DE ITENS --- */}
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
                                    field.onChange(novaQtde);
                                  }}
                                />
                              )}
                            />
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
                
                {/* --- TOTAIS E BOTÃO --- */}
                <div className="flex justify-end items-center">
                  <h2 className="text-2xl font-bold">
                    Total: R$ {valorTotalOrcamento.toFixed(2)}
                  </h2>
                </div>
                <DialogFooter>
                  <Button type="submit" disabled={form.formState.isSubmitting}>
                    {form.formState.isSubmitting ? "Criando..." : "Criar Orçamento"}
                  </Button>
                </DialogFooter>
              </form>
            </Form>
          </DialogContent>
        </Dialog>

        {/* --- MODAL DE CLIENTE RÁPIDO --- */}
        <Dialog open={isClientModalOpen} onOpenChange={setIsClientModalOpen}>
          <DialogContent className="sm:max-w-[425px]">
            <DialogHeader>
              <DialogTitle>Cadastro Rápido de Cliente</DialogTitle>
              <DialogDescription>Cadastre o cliente para usar neste orçamento.</DialogDescription>
            </DialogHeader>
            <Form {...clientForm}>
              <form onSubmit={clientForm.handleSubmit(onClientSubmit)} className="space-y-4">
                <FormField
                  control={clientForm.control}
                  name="nome"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Nome do Cliente</FormLabel>
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
                      <FormLabel>Telefone / WhatsApp</FormLabel>
                      <FormControl><Input placeholder="Ex: 79 99999-8888" {...field} /></FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={clientForm.control}
                  name="cpfCnpj"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>CPF ou CNPJ</FormLabel>
                      <FormControl><Input placeholder="Ex: 123.456.789-00" {...field} /></FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <DialogFooter>
                  <Button type="submit" disabled={clientForm.formState.isSubmitting}>
                    {clientForm.formState.isSubmitting ? "Salvando..." : "Salvar Cliente"}
                  </Button>
                </DialogFooter>
              </form>
            </Form>
          </DialogContent>
        </Dialog>

        {/* --- MODAL DE VEÍCULO RÁPIDO --- */}
        <Dialog open={isVehicleModalOpen} onOpenChange={setIsVehicleModalOpen}>
          <DialogContent className="sm:max-w-[425px]">
            <DialogHeader>
              <DialogTitle>Cadastro Rápido de Veículo</DialogTitle>
              <DialogDescription>
                Adicione um carro para o cliente <strong>{clientes.find(c => c.id === clienteIdSelecionado)?.nome}</strong>.
              </DialogDescription>
            </DialogHeader>
            <Form {...vehicleForm}>
              <form onSubmit={vehicleForm.handleSubmit(onVehicleSubmit)} className="space-y-4">
                <FormField
                  control={vehicleForm.control}
                  name="modelo"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Modelo</FormLabel>
                      <FormControl><Input placeholder="Ex: Fiat Palio" {...field} /></FormControl>
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
                        <FormControl><Input placeholder="2010" {...field} /></FormControl>
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
                      <FormControl><Input placeholder="Ex: Prata" {...field} /></FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <DialogFooter>
                  <Button type="submit" disabled={vehicleForm.formState.isSubmitting}>
                    {vehicleForm.formState.isSubmitting ? "Salvando..." : "Salvar Veículo"}
                  </Button>
                </DialogFooter>
              </form>
            </Form>
          </DialogContent>
        </Dialog>

      </div>

      {/* --- TABELA DE LISTAGEM DE ORÇAMENTOS --- */}
      <div className="rounded-md border">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Nº</TableHead>
              <TableHead>Cliente</TableHead>
              <TableHead>Placa</TableHead>
              <TableHead>Data</TableHead>
              <TableHead>Status</TableHead>
              <TableHead>Valor Total</TableHead>
              <TableHead>Ações</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {orcamentos.map((orc) => (
              <TableRow key={orc.id}>
                <TableCell>
                  <Link
                    href={`/orcamentos/${orc.id}`}
                    className="font-medium text-primary hover:underline"
                  >
                    #{orc.numeroOrcamento}
                  </Link>
                </TableCell>
                <TableCell className="font-medium">{orc.nomeCliente}</TableCell>
                <TableCell>{orc.veiculoPlaca}</TableCell>
                <TableCell>
                  {new Date(
                    orc.dataCriacao.seconds * 1000
                  ).toLocaleDateString()}
                </TableCell>
                <TableCell className="capitalize">{orc.status}</TableCell>
                <TableCell>R$ {orc.valorTotal.toFixed(2)}</TableCell>
                <TableCell className="flex items-center">
                  <Button asChild variant="outline" size="sm">
                    <Link href={`/orcamentos/${orc.id}`}>Ver / Imprimir</Link>
                  </Button>
                  
                  {userData?.role === 'admin' && (
                    <Button 
                      variant="destructive" 
                      size="sm" 
                      className="ml-2"
                      onClick={async () => {
                        if (confirm(`Excluir orçamento #${orc.numeroOrcamento}?`)) {
                          try {
                             await deleteDoc(doc(db, "orcamentos", orc.id));
                          } catch (error) {
                             console.error("Erro ao excluir:", error);
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