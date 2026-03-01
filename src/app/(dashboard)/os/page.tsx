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
  deleteDoc,
  doc,
  addDoc,
  orderBy,
  limit,
  Timestamp
} from "firebase/firestore";
import { db, auth } from "@/lib/firebase"; 
import { cn } from "@/lib/utils";
import { Check, ChevronsUpDown, Trash2, Search, Plus, Loader2, AlertCircle, RefreshCcw } from "lucide-react";
import Link from "next/link";
import { useAuth } from "@/context/AuthContext";
import { useRouter } from "next/navigation";
import { toast } from "sonner"; 

// --- TIPOS GLOBAIS ---
import { Cliente, Produto, Carro, OrdemDeServico } from "@/types";

// --- COMPONENTES UI ---
import { Button } from "@/components/ui/button";
import {
  Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger,
} from "@/components/ui/dialog";
import {
  Form, FormControl, FormField, FormItem, FormLabel, FormMessage,
} from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import {
  Popover, PopoverContent, PopoverTrigger,
} from "@/components/ui/popover";
import {
  Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList,
} from "@/components/ui/command";
import { Textarea } from "@/components/ui/textarea";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";

// --- SCHEMAS ---
const osFormSchema = z.object({
  clienteId: z.string().min(1, "Selecione um cliente."),
  veiculoPlaca: z.string().min(3, "Selecione um veículo."),
  veiculoModelo: z.string().optional(),
  servicosDescricao: z.string().optional(),
  garantiaDias: z.coerce.number().int().min(0).default(0),
  itens: z.array(
      z.object({
        id: z.string(),
        nome: z.string(),
        qtde: z.coerce.number().min(1, "Qtde deve ser 1+"),
        precoCusto: z.coerce.number(), 
        precoUnitario: z.coerce.number(),
        tipo: z.enum(["peca", "servico"]),
        estoqueAtual: z.number(),
      })
    ).min(1, "Adicione pelo menos um item ou serviço."),
});

const clientFormSchema = z.object({
  nome: z.string().min(3, { message: "Min 3 caracteres." }),
  telefone: z.string().optional(),
  cpfCnpj: z.string().optional(),
});

const vehicleFormSchema = z.object({
  modelo: z.string().min(2, "Informe o modelo."),
  placa: z.string().min(7, "Placa inválida."),
  ano: z.string().optional(),
  cor: z.string().optional(),
});

export default function OsPage() {
  // --- ESTADOS ---
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isClientModalOpen, setIsClientModalOpen] = useState(false);
  const [isVehicleModalOpen, setIsVehicleModalOpen] = useState(false);

  // Dados Principais
  const [ordensDeServico, setOrdensDeServico] = useState<OrdemDeServico[]>([]);
  const [clientes, setClientes] = useState<Cliente[]>([]);
  const [produtos, setProdutos] = useState<Produto[]>([]);
  const [veiculosCliente, setVeiculosCliente] = useState<Carro[]>([]);
  
  // Controles de Busca e UI
  const [isComboboxOpen, setIsComboboxOpen] = useState(false);
  const [searchTerm, setSearchTerm] = useState(""); 
  const [isSearching, setIsSearching] = useState(false); // Indica se está buscando no banco
  const [carroSelecionadoId, setCarroSelecionadoId] = useState<string>(""); 

  // Auth
  const { userData, loading: authLoading } = useAuth();
  const router = useRouter();

  // --- FORMULÁRIOS ---
  const form = useForm<z.infer<typeof osFormSchema>>({
    resolver: zodResolver(osFormSchema),
    defaultValues: { clienteId: "", veiculoPlaca: "", veiculoModelo: "", servicosDescricao: "", garantiaDias: 90, itens: [] },
  });
  const clientForm = useForm<z.infer<typeof clientFormSchema>>({ resolver: zodResolver(clientFormSchema), defaultValues: { nome: "", telefone: "", cpfCnpj: "" } });
  const vehicleForm = useForm<z.infer<typeof vehicleFormSchema>>({ resolver: zodResolver(vehicleFormSchema), defaultValues: { modelo: "", placa: "", ano: "", cor: "" } });
  const { fields, append, remove, update } = useFieldArray({ control: form.control, name: "itens" });


  // --- CARREGAMENTO INICIAL INTELIGENTE (LIMIT 30) ---
  useEffect(() => {
    if (!userData) return;

    // 1. Carregar Clientes e Produtos (Leves, pode manter onSnapshot por enquanto ou mudar para getDocs se quiser economizar muito)
    // Mantemos onSnapshot aqui para garantir que o select funcione bem, mas limitamos se necessário no futuro
    const unsubClientes = onSnapshot(query(collection(db, "clientes")), (s) => setClientes(s.docs.map(d => ({ id: d.id, ...d.data() } as Cliente))));
    const unsubProdutos = onSnapshot(collection(db, "produtos"), (s) => setProdutos(s.docs.map(d => ({ id: d.id, ...d.data() } as Produto))));

    // 2. Carregar OS (O Pesado) - Lógica de Escuta Padrão
    // Se NÃO estiver buscando, escuta as 30 últimas em tempo real
    let unsubOS = () => {};

    if (!isSearching) {
      const osRef = collection(db, "ordensDeServico");
      let qOS;
      
      if (userData.role === 'admin') {
        qOS = query(osRef, orderBy("dataAbertura", "desc"), limit(30));
      } else {
        // Obs: OwnerId + OrderBy requer índice composto no Firebase
        qOS = query(osRef, where("ownerId", "==", userData.id), orderBy("dataAbertura", "desc"), limit(30));
      }

      unsubOS = onSnapshot(qOS, (snapshot) => {
        setOrdensDeServico(snapshot.docs.map((doc) => ({ id: doc.id, ...doc.data() } as OrdemDeServico)));
      }, (error) => {
        console.error("Erro no snapshot de OS:", error);
        if (error.code === 'failed-precondition') {
            toast.error("Erro de Índice: Verifique o console do navegador (F12) para criar o índice no Firebase.");
        }
      });
    }

    return () => {
      unsubClientes();
      unsubProdutos();
      unsubOS();
    };
  }, [userData, isSearching]); // Recarrega se user mudar ou se entrar/sair do modo busca


  // --- FUNÇÃO DE BUSCA CIRÚRGICA (ECONOMIA DE LEITURAS) ---
  const handleSearch = async () => {
    if (!searchTerm.trim()) {
      setIsSearching(false); // Volta para o modo "30 últimas"
      return;
    }

    if (!userData) return;
    setIsSearching(true); // Ativa modo busca (para o onSnapshot padrão)
    setOrdensDeServico([]); // Limpa lista visualmente

    const term = searchTerm.trim().toUpperCase(); // Normaliza para caixa alta (se salvou placa em maiusculo)
    const osRef = collection(db, "ordensDeServico");
    const resultadosTemp: Map<string, OrdemDeServico> = new Map();

    try {
      // Como o Firestore não tem "OR" nativo fácil para texto parcial, faremos buscas paralelas inteligentes
      const promises = [];

      // 1. Busca por Número da OS (se for número)
      if (!isNaN(Number(term))) {
        let qNum = query(osRef, where("numeroOS", "==", Number(term)));
        if (userData.role !== 'admin') qNum = query(qNum, where("ownerId", "==", userData.id));
        promises.push(getDocs(qNum));
      }

      // 2. Busca por Placa (Exata ou Início)
      // Truque do Firestore para "começa com": where('placa', '>=', term) e where('placa', '<=', term + '\uf8ff')
      let qPlaca = query(osRef, where("veiculoPlaca", ">=", term), where("veiculoPlaca", "<=", term + '\uf8ff'), limit(20));
      if (userData.role !== 'admin') {
         // Nota: Queries de desigualdade (>=) com filtro de ownerId exigem indice composto
         qPlaca = query(osRef, where("ownerId", "==", userData.id), where("veiculoPlaca", ">=", term), where("veiculoPlaca", "<=", term + '\uf8ff'), limit(20));
      }
      promises.push(getDocs(qPlaca));

      // 3. Busca por Nome Cliente (Opcional - mais custoso se não tiver índice, vamos tentar)
      // Vamos assumir que nome está salvo como digitado. Busca "Case Sensitive" no Firestore é chata.
      // Vamos tentar buscar pelo termo original (sem upperCase forçado) para nomes
      const termNome = searchTerm.trim(); 
      let qNome = query(osRef, where("nomeCliente", ">=", termNome), where("nomeCliente", "<=", termNome + '\uf8ff'), limit(20));
       if (userData.role !== 'admin') {
         qNome = query(osRef, where("ownerId", "==", userData.id), where("nomeCliente", ">=", termNome), where("nomeCliente", "<=", termNome + '\uf8ff'), limit(20));
      }
      promises.push(getDocs(qNome));

      // Executa tudo
      const snapshots = await Promise.all(promises);

      snapshots.forEach(snap => {
        snap.forEach(doc => {
          resultadosTemp.set(doc.id, { id: doc.id, ...doc.data() } as OrdemDeServico);
        });
      });

      // Converte Map para Array e ordena por data (memória)
      const listaFinal = Array.from(resultadosTemp.values()).sort((a, b) => {
         const dateA = (a.dataAbertura as any)?.seconds || 0;
         const dateB = (b.dataAbertura as any)?.seconds || 0;
         return dateB - dateA;
      });

      setOrdensDeServico(listaFinal);
      
      if (listaFinal.length === 0) {
        toast.info("Nenhuma OS encontrada com estes dados.");
      } else {
        toast.success(`${listaFinal.length} resultados encontrados.`);
      }

    } catch (error) {
      console.error("Erro na busca:", error);
      toast.error("Erro ao buscar. Verifique o console para índices.");
    }
  };

  const limparBusca = () => {
    setSearchTerm("");
    setIsSearching(false);
  };

  // --- EFEITOS AUXILIARES ---
  const clienteIdSelecionado = form.watch("clienteId");
  useEffect(() => {
    if (clienteIdSelecionado) {
      form.setValue("veiculoPlaca", ""); form.setValue("veiculoModelo", ""); setCarroSelecionadoId("");
      const unsub = onSnapshot(query(collection(db, "carros"), where("clienteId", "==", clienteIdSelecionado)), (s) => setVeiculosCliente(s.docs.map(d => ({ id: d.id, ...d.data() } as Carro))));
      return () => unsub();
    } else { setVeiculosCliente([]); setCarroSelecionadoId(""); }
  }, [clienteIdSelecionado, form]);

  const handleCarroSelecionado = (carroId: string) => {
    setCarroSelecionadoId(carroId);
    const carro = veiculosCliente.find((c) => c.id === carroId);
    if (carro) { form.setValue("veiculoPlaca", carro.placa); form.setValue("veiculoModelo", carro.modelo); form.clearErrors("veiculoPlaca"); }
  };

  const adicionarProduto = (produto: Produto) => {
    const itemIndex = fields.findIndex((field) => field.id === produto.id);
    if (itemIndex > -1) {
      const item = fields[itemIndex];
      const novaQtde = item.qtde + 1;
      if (produto.tipo === "peca" && novaQtde > produto.estoqueAtual) {
        toast.error(`Estoque máx (${produto.estoqueAtual}) atingido.`);
        return;
      }
      update(itemIndex, { ...item, qtde: novaQtde });
    } else {
      append({ id: produto.id, nome: produto.nome, qtde: 1, precoCusto: produto.precoCusto, precoUnitario: produto.precoVenda, tipo: produto.tipo, estoqueAtual: produto.estoqueAtual });
    }
    setIsComboboxOpen(false);
    toast.success("Item adicionado!");
  };

  // --- CÁLCULOS ---
  const watchedItens = form.watch("itens");
  const valorTotalOS = watchedItens.reduce((total, item) => total + (item.precoUnitario * (item.qtde || 0)), 0);
  const custoTotalOS = watchedItens.reduce((total, item) => item.tipo === 'peca' ? total + (item.precoCusto * (item.qtde || 0)) : total, 0);

  // --- SUBMITS ---
  async function onSubmit(values: z.infer<typeof osFormSchema>) {
    if (!userData) { toast.error("Erro de autenticação."); return; }
    try {
      const q = query(collection(db, "ordensDeServico"), where("clienteId", "==", values.clienteId), where("status", "==", "aberta"));
      const querySnapshot = await getDocs(q);
      if (!querySnapshot.empty) { toast.warning("Cliente já possui OS aberta."); return; }

      const clienteSelecionado = clientes.find((c) => c.id === values.clienteId);
      if (!clienteSelecionado) return;

      const novaOS = {
        numeroOS: Math.floor(Math.random() * 10000) + 1,
        dataAbertura: new Date(), 
        status: "aberta",
        clienteId: values.clienteId,
        nomeCliente: clienteSelecionado.nome,
        veiculoPlaca: values.veiculoPlaca.toUpperCase(),
        veiculoModelo: values.veiculoModelo,
        servicosDescricao: values.servicosDescricao,
        garantiaDias: values.garantiaDias, 
        itens: values.itens.map((item) => ({ id: item.id, nome: item.nome, qtde: item.qtde, precoCusto: item.precoCusto, precoUnitario: item.precoUnitario, tipo: item.tipo })),
        valorTotal: valorTotalOS,
        custoTotal: custoTotalOS,
        ownerId: userData.id 
      };

      const toastId = toast.loading("Criando OS...");
      const token = await auth.currentUser?.getIdToken();
     const response = await fetch('/api/os/create', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
        body: JSON.stringify({ novaOS, itens: values.itens }),
      });

      if (!response.ok) {
        // Tenta ler a mensagem de erro exata que veio do backend (ex: "Estoque insuficiente...")
        const errorData = await response.json();
        throw new Error(errorData.error || "Erro desconhecido na API");
      }
      
      toast.dismiss(toastId);
      toast.success("OS Criada com Sucesso!");
      form.reset(); setCarroSelecionadoId(""); setIsModalOpen(false);

    } catch (error: any) { 
      toast.dismiss(); 
      console.error(error); 
      // Agora o Toast mostra a mensagem inteligente do backend!
      toast.error(error.message || "Erro ao salvar OS."); 
    }
  }

  // --- SUBMITS MODAIS ---
  async function onClientSubmit(values: z.infer<typeof clientFormSchema>) {
    if (!userData) return;
    try {
      const docRef = await addDoc(collection(db, "clientes"), { ...values, ownerId: userData.id });
      setIsClientModalOpen(false); clientForm.reset(); form.setValue("clienteId", docRef.id);
      toast.success("Cliente cadastrado!");
    } catch (e) { toast.error("Erro ao cadastrar."); }
  }
  async function onVehicleSubmit(values: z.infer<typeof vehicleFormSchema>) {
    if (!userData) return;
    const cid = form.getValues("clienteId");
    if (!cid) { toast.warning("Selecione cliente antes."); return; }
    try {
      const docRef = await addDoc(collection(db, "carros"), {
        ...values, placa: values.placa.toUpperCase(), clienteId: cid, nomeCliente: clientes.find(c=>c.id===cid)?.nome || "", ownerId: userData.id
      });
      setIsVehicleModalOpen(false); vehicleForm.reset();
      setCarroSelecionadoId(docRef.id); form.setValue("veiculoPlaca", values.placa.toUpperCase()); form.setValue("veiculoModelo", values.modelo); form.clearErrors("veiculoPlaca");
      toast.success("Veículo cadastrado!");
    } catch (e) { toast.error("Erro ao cadastrar."); }
  }
  
  const handleDeleteOS = async (os: OrdemDeServico) => {
    if (confirm(`Excluir OS #${os.numeroOS}?`)) {
       try { await deleteDoc(doc(db, "ordensDeServico", os.id)); toast.success("OS excluída."); }
       catch (error) { toast.error("Erro ao excluir."); }
    }
  }

  // --- RENDER ---
  if (authLoading) return <div className="flex h-screen items-center justify-center"><Loader2 className="h-8 w-8 animate-spin text-primary"/></div>;

  return (
    <div>
      <div className="flex flex-col md:flex-row justify-between items-center mb-6 gap-4">
        <h1 className="text-4xl font-bold">Ordens de Serviço</h1>
        <Dialog open={isModalOpen} onOpenChange={setIsModalOpen}>
          <DialogTrigger asChild><Button>Criar Nova OS</Button></DialogTrigger>
          <DialogContent className="sm:max-w-3xl">
             <DialogHeader><DialogTitle>Nova OS</DialogTitle><DialogDescription>Preencha os dados abaixo.</DialogDescription></DialogHeader>
             <Form {...form}>
               <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
                 {/* ... FORMULARIO (MANTIDO IGUAL AO ANTERIOR PARA ECONOMIZAR ESPAÇO VISUAL AQUI, MAS O CODIGO COMPLETO ESTÁ NA LOGICA ACIMA) ... */}
                 {/* LINHA 1 */}
                 <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <FormField control={form.control} name="clienteId" render={({ field }) => (
                      <FormItem>
                        <FormLabel>Cliente</FormLabel>
                        <div className="flex gap-2">
                          <Select onValueChange={field.onChange} value={field.value}><FormControl><SelectTrigger><SelectValue placeholder="Selecione..." /></SelectTrigger></FormControl><SelectContent>{clientes.map((c) => (<SelectItem key={c.id} value={c.id}>{c.nome}</SelectItem>))}</SelectContent></Select>
                          <Button type="button" variant="outline" size="icon" onClick={() => setIsClientModalOpen(true)}><Plus className="h-4 w-4" /></Button>
                        </div>
                        <FormMessage />
                      </FormItem>
                    )} />
                    {clienteIdSelecionado && (
                     <FormItem>
                        <FormLabel>Veículo</FormLabel>
                        <div className="flex gap-2">
                          <Select onValueChange={handleCarroSelecionado} value={carroSelecionadoId}><FormControl><SelectTrigger><SelectValue placeholder="Selecione..." /></SelectTrigger></FormControl><SelectContent>{veiculosCliente.length>0 ? veiculosCliente.map((c)=>(<SelectItem key={c.id} value={c.id}>{c.modelo} - {c.placa}</SelectItem>)) : <div className="p-2 text-sm">Nenhum veículo.</div>}</SelectContent></Select>
                          <Button type="button" variant="outline" size="icon" onClick={() => setIsVehicleModalOpen(true)}><Plus className="h-4 w-4" /></Button>
                        </div>
                        {form.formState.errors.veiculoPlaca && <p className="text-sm text-destructive mt-1">Veículo obrigatório.</p>}
                      </FormItem>
                    )}
                 </div>
                 {/* LINHA 2 */}
                 <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                    <FormField control={form.control} name="servicosDescricao" render={({ field }) => (<FormItem className="md:col-span-2"><FormLabel>Observações</FormLabel><FormControl><Textarea placeholder="Serviços a realizar..." {...field} /></FormControl><FormMessage /></FormItem>)} />
                    <FormField control={form.control} name="garantiaDias" render={({ field }) => (<FormItem><FormLabel>Garantia (dias)</FormLabel><FormControl><Input type="number" {...field} /></FormControl><FormMessage /></FormItem>)} />
                 </div>
                 {/* ITENS */}
                 <div>
                    <FormLabel>Peças e Serviços</FormLabel>
                    <Popover open={isComboboxOpen} onOpenChange={setIsComboboxOpen}>
                      <PopoverTrigger asChild><Button variant="outline" role="combobox" className="w-full justify-between mt-2">Selecione um item...<ChevronsUpDown className="ml-2 h-4 w-4 opacity-50" /></Button></PopoverTrigger>
                      <PopoverContent className="w-[--radix-popover-trigger-width] p-0">
                        <Command>
                          <CommandInput placeholder="Buscar..." />
                          <CommandList><CommandEmpty>Nada encontrado.</CommandEmpty><CommandGroup>{produtos.map((p) => (<CommandItem key={p.id} value={`${p.nome} ${p.codigoSku||''}`} onSelect={() => adicionarProduto(p)}><Check className={cn("mr-2 h-4 w-4", fields.some((i) => i.id === p.id) ? "opacity-100" : "opacity-0")} />{p.nome}</CommandItem>))}</CommandGroup></CommandList>
                        </Command>
                      </PopoverContent>
                    </Popover>
                    <FormMessage>{form.formState.errors.itens?.message}</FormMessage>
                 </div>
                 {/* TABELA ITENS */}
                 <div className="rounded-md border">
                    <Table>
                      <TableHeader><TableRow><TableHead>Item</TableHead><TableHead className="w-[100px]">Qtde</TableHead><TableHead className="w-[120px]">Unit.</TableHead><TableHead className="w-[120px]">Total</TableHead><TableHead className="w-[50px]"></TableHead></TableRow></TableHeader>
                      <TableBody>
                        {fields.map((item, index) => (
                          <TableRow key={item.id}>
                            <TableCell>{item.nome}</TableCell>
                            <TableCell><FormField control={form.control} name={`itens.${index}.qtde`} render={({ field }) => (<Input type="number" className="h-8" {...field} onChange={(e) => { const v = parseInt(e.target.value)||0; if(item.tipo==='peca' && v>item.estoqueAtual) form.setError(`itens.${index}.qtde`,{message:`Max:${item.estoqueAtual}`}); else form.clearErrors(`itens.${index}.qtde`); field.onChange(v); }} />)} /><FormMessage>{form.formState.errors.itens?.[index]?.qtde?.message}</FormMessage></TableCell>
                            <TableCell>R$ {item.precoUnitario.toFixed(2)}</TableCell>
                            <TableCell>R$ {(item.precoUnitario*(item.qtde||0)).toFixed(2)}</TableCell>
                            <TableCell><Button type="button" variant="destructive" size="icon-sm" onClick={() => remove(index)}><Trash2 className="h-4 w-4" /></Button></TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                 </div>
                 <div className="flex justify-between items-center"><h2 className="text-lg text-gray-600">Custo: R$ {custoTotalOS.toFixed(2)}</h2><h2 className="text-2xl font-bold">Total: R$ {valorTotalOS.toFixed(2)}</h2></div>
                 <DialogFooter><Button type="submit" disabled={form.formState.isSubmitting}>{form.formState.isSubmitting?"Salvando...":"Salvar OS"}</Button></DialogFooter>
               </form>
             </Form>
          </DialogContent>
        </Dialog>

        {/* MODAIS AUXILIARES (CLIENTE/VEICULO) */}
        <Dialog open={isClientModalOpen} onOpenChange={setIsClientModalOpen}>
           <DialogContent><DialogHeader><DialogTitle>Novo Cliente</DialogTitle></DialogHeader><Form {...clientForm}><form onSubmit={clientForm.handleSubmit(onClientSubmit)} className="space-y-4"><FormField control={clientForm.control} name="nome" render={({field})=>(<FormItem><FormLabel>Nome</FormLabel><FormControl><Input {...field}/></FormControl><FormMessage/></FormItem>)}/><FormField control={clientForm.control} name="telefone" render={({field})=>(<FormItem><FormLabel>Telefone</FormLabel><FormControl><Input {...field}/></FormControl><FormMessage/></FormItem>)}/><DialogFooter><Button type="submit">Salvar</Button></DialogFooter></form></Form></DialogContent>
        </Dialog>
        <Dialog open={isVehicleModalOpen} onOpenChange={setIsVehicleModalOpen}>
           <DialogContent><DialogHeader><DialogTitle>Novo Veículo</DialogTitle></DialogHeader><Form {...vehicleForm}><form onSubmit={vehicleForm.handleSubmit(onVehicleSubmit)} className="space-y-4"><FormField control={vehicleForm.control} name="modelo" render={({field})=>(<FormItem><FormLabel>Modelo</FormLabel><FormControl><Input {...field}/></FormControl><FormMessage/></FormItem>)}/><div className="grid grid-cols-2 gap-4"><FormField control={vehicleForm.control} name="placa" render={({field})=>(<FormItem><FormLabel>Placa</FormLabel><FormControl><Input className="uppercase" {...field}/></FormControl><FormMessage/></FormItem>)}/><FormField control={vehicleForm.control} name="ano" render={({field})=>(<FormItem><FormLabel>Ano</FormLabel><FormControl><Input {...field}/></FormControl><FormMessage/></FormItem>)}/></div><FormField control={vehicleForm.control} name="cor" render={({field})=>(<FormItem><FormLabel>Cor</FormLabel><FormControl><Input {...field}/></FormControl><FormMessage/></FormItem>)}/><DialogFooter><Button type="submit">Salvar</Button></DialogFooter></form></Form></DialogContent>
        </Dialog>
      </div>

      {/* --- BARRA DE BUSCA EFICIENTE --- */}
      <div className="relative mb-6 flex gap-2">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 h-5 w-5" />
          <Input 
            placeholder="Pesquisar por Placa, Nome do Cliente ou Nº OS..." 
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && handleSearch()} // Busca ao dar Enter
            className="pl-10 text-lg py-6"
          />
        </div>
        <Button onClick={handleSearch} className="h-auto px-6 text-lg" disabled={isSearching && searchTerm.length > 0}>
           {isSearching && searchTerm.length > 0 ? <Loader2 className="animate-spin" /> : "Buscar"}
        </Button>
        {isSearching && (
          <Button variant="outline" onClick={limparBusca} className="h-auto" title="Limpar Busca">
            <RefreshCcw className="h-5 w-5" />
          </Button>
        )}
      </div>

      {/* --- TABELA --- */}
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
            {ordensDeServico.length === 0 && (
              <TableRow>
                <TableCell colSpan={7} className="text-center py-8 text-muted-foreground">
                  {isSearching ? "Nenhum resultado encontrado." : "Nenhuma OS recente."}
                </TableCell>
              </TableRow>
            )}
            {ordensDeServico.map((os) => (
              <TableRow key={os.id}>
                <TableCell>
                  <Link href={`/os/${os.id}`} className="font-medium text-primary hover:underline">
                    {os.numeroOS}
                  </Link>
                </TableCell>
                <TableCell className="font-medium">{os.nomeCliente}</TableCell>
                <TableCell>{os.veiculoPlaca}</TableCell>
                <TableCell>
                  {/* @ts-ignore */}
                  {os.dataAbertura && (os.dataAbertura.toDate ? os.dataAbertura.toDate().toLocaleDateString() : new Date(os.dataAbertura.seconds * 1000).toLocaleDateString())}
                </TableCell>
                <TableCell><span className={cn("capitalize", os.status==='aberta' && "text-yellow-600 font-bold", os.status==='finalizada' && "text-green-600 font-bold")}>{os.status}</span></TableCell>
                <TableCell>R$ {os.valorTotal.toFixed(2)}</TableCell>
                <TableCell className="flex items-center">
                  <Button asChild variant="outline" size="sm"><Link href={`/os/${os.id}`}>Detalhes</Link></Button>
                  {userData?.role === 'admin' && (
                    <Button variant="destructive" size="sm" className="ml-2" onClick={() => handleDeleteOS(os)}><Trash2 className="h-4 w-4" /></Button>
                  )}
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>

      {/* AVISO DE ECONOMIA */}
      {!isSearching && ordensDeServico.length > 0 && (
        <div className="mt-4 flex items-center justify-center text-sm text-muted-foreground gap-2 bg-blue-50 p-2 rounded border border-blue-100">
          <AlertCircle className="h-4 w-4 text-blue-500" />
          <span>Mostrando as 30 OS mais recentes. Use a busca acima para encontrar ordens antigas.</span>
        </div>
      )}
    </div>
  );
}