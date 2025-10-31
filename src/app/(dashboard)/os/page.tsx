// src/app/(dashboard)/os/page.tsx
"use client";

import { useState, useEffect } from "react";
import { useForm, useFieldArray } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { collection, addDoc, onSnapshot, runTransaction, doc } from "firebase/firestore"; 
import { db } from "@/lib/firebase";
import { cn } from "@/lib/utils";
import { Check, ChevronsUpDown, Trash2 } from "lucide-react"; // Ícones

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
} from "@/components/ui/select"; // <-- NOVO
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover"; // <-- NOVO
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from "@/components/ui/command"; // <-- NOVO
import { Textarea } from "@/components/ui/textarea"; // <-- NOVO
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";

// --- Tipos de Dados (Interfaces) ---
// (Reaproveitando as que já definimos mentalmente)
interface Cliente {
  id: string;
  nome: string;
}
interface Produto {
  id: string;
  nome: string;
  precoVenda: number;
  estoqueAtual: number;
  tipo: "peca" | "servico";
}
interface OrdemDeServico {
  id: string;
  numeroOS: number;
  dataAbertura: { seconds: number }; // Formato do Firestore Timestamp
  nomeCliente: string;
  placaVeiculo: string;
  status: "aberta" | "finalizada" | "cancelada";
  valorTotal: number;
}

// --- Schema de Validação ZOD para o Formulário ---
const osFormSchema = z.object({
  clienteId: z.string().min(1, "Selecione um cliente."),
  veiculoPlaca: z.string().min(3, "Informe a placa."), // Simplificado
  veiculoModelo: z.string().optional(),
  servicosDescricao: z.string().optional(),
  // Array de itens. É aqui que o useFieldArray vai atuar
  itens: z.array(
    z.object({
      id: z.string(), // ID do produto no Firebase
      nome: z.string(),
      qtde: z.coerce.number().min(1, "Qtde deve ser 1+"),
      precoUnitario: z.coerce.number(),
      tipo: z.enum(["peca", "servico"]),
      estoqueAtual: z.number(), // Para sabermos o estoque
    })
  ).min(1, "Adicione pelo menos um item ou serviço."), // Pelo menos 1 item na OS
});

export default function OsPage() {
  const [isModalOpen, setIsModalOpen] = useState(false);
  
  // --- Estados para guardar os dados do Firebase ---
  const [ordensDeServico, setOrdensDeServico] = useState<OrdemDeServico[]>([]);
  const [clientes, setClientes] = useState<Cliente[]>([]);
  const [produtos, setProdutos] = useState<Produto[]>([]);
  
  // Popover do Combobox de produtos
  const [isComboboxOpen, setIsComboboxOpen] = useState(false);

  // --- Efeito para Buscar TODOS os dados ---
  useEffect(() => {
    // 1. Buscar Ordens de Serviço (para a tabela principal)
    const unsubOS = onSnapshot(collection(db, "ordensDeServico"), (snapshot) => {
      setOrdensDeServico(
        snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as OrdemDeServico))
      );
    });

    // 2. Buscar Clientes (para o <Select> do formulário)
    const unsubClientes = onSnapshot(collection(db, "clientes"), (snapshot) => {
      setClientes(
        snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Cliente))
      );
    });

    // 3. Buscar Produtos (para o <Combobox> do formulário)
    const unsubProdutos = onSnapshot(collection(db, "produtos"), (snapshot) => {
      setProdutos(
        snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Produto))
      );
    });

    // Função de limpeza para "desligar" os ouvintes
    return () => {
      unsubOS();
      unsubClientes();
      unsubProdutos();
    };
  }, []);

  // --- Configuração do Formulário ---
  const form = useForm<z.infer<typeof osFormSchema>>({
    resolver: zodResolver(osFormSchema),
    defaultValues: {
      clienteId: "",
      veiculoPlaca: "",
      veiculoModelo: "",
      servicosDescricao: "",
      itens: [],
    },
  });

  // Gerenciador do array de itens (aqui está a mágica)
  const { fields, append, remove } = useFieldArray({
    control: form.control,
    name: "itens",
  });

  // Função para adicionar um produto na OS
  const adicionarProduto = (produto: Produto) => {
    // Verifica se o item já está na lista
    const itemExistente = fields.find(field => field.id === produto.id);
    if (itemExistente) {
      // TODO: Incrementar a quantidade (futura melhoria)
      console.log("Item já adicionado");
      return;
    }
    // Adiciona o novo item ao array do formulário
    append({
      id: produto.id,
      nome: produto.nome,
      qtde: 1,
      precoUnitario: produto.precoVenda,
      tipo: produto.tipo,
      estoqueAtual: produto.estoqueAtual
    });
  };
  
  // Calcula o valor total da OS em tempo real
  const valorTotalOS = fields.reduce((total, item) => {
    return total + (item.precoUnitario * item.qtde);
  }, 0);

  // --- FUNÇÃO DE SALVAR A OS (A MAIS IMPORTANTE) ---
  async function onSubmit(values: z.infer<typeof osFormSchema>) {
    const clienteSelecionado = clientes.find(c => c.id === values.clienteId);
    if (!clienteSelecionado) {
      console.error("Cliente não encontrado");
      // TODO: Mostrar toast de erro
      return;
    }
    
    // 1. Dados para salvar na coleção 'ordensDeServico'
    const novaOS = {
      // TODO: Criar um contador de OS no Firebase (futura melhoria)
      numeroOS: Math.floor(Math.random() * 10000) + 1, 
      dataAbertura: new Date(),
      status: "aberta" as "aberta",
      // Copiamos os dados para facilitar a leitura na tabela
      clienteId: values.clienteId,
      nomeCliente: clienteSelecionado.nome,
      veiculoPlaca: values.veiculoPlaca.toUpperCase(),
      veiculoModelo: values.veiculoModelo,
      servicosDescricao: values.servicosDescricao,
      // Mapeamos os itens para um formato mais limpo
      itens: values.itens.map(item => ({
        id: item.id,
        nome: item.nome,
        qtde: item.qtde,
        precoUnitario: item.precoUnitario,
        tipo: item.tipo,
      })),
      valorTotal: valorTotalOS,
    };

    try {
      // 2. USAMOS UMA TRANSAÇÃO (Segurança Máxima)
      // Isso garante que só vamos salvar a OS se conseguirmos atualizar o estoque.
      // Se a atualização do estoque falhar, a OS inteira é cancelada (rollback).
      await runTransaction(db, async (transaction) => {
        // Passo A: Salva a nova Ordem de Serviço
        const osRef = doc(collection(db, "ordensDeServico"));
        transaction.set(osRef, novaOS);

        // Passo B: Atualiza o estoque de cada item (apenas se for 'peca')
        for (const item of values.itens) {
          if (item.tipo === "peca") {
            const produtoRef = doc(db, "produtos", item.id);
            const novoEstoque = item.estoqueAtual - item.qtde;
            
            // Validação de segurança
            if (novoEstoque < 0) {
              throw new Error(`Estoque insuficiente para ${item.nome}. Restam ${item.estoqueAtual}.`);
            }
            
            transaction.update(produtoRef, { estoqueAtual: novoEstoque });
          }
        }
      });

      console.log("OS salva e estoque atualizado com sucesso!");
      // TODO: Mostrar toast de sucesso
      form.reset();
      setIsModalOpen(false);

    } catch (error: any) {
      console.error("Erro na transação: ", error);
      // TODO: Mostrar toast de erro (ex: error.message)
    }
  }

  return (
    <div>
      <div className="flex justify-between items-center mb-6">
        <h1 className="text-4xl font-bold">Ordens de Serviço</h1>
        
        <Dialog open={isModalOpen} onOpenChange={setIsModalOpen}>
          <DialogTrigger asChild>
            <Button>Criar Nova OS</Button>
          </DialogTrigger>
          <DialogContent className="sm:max-w-3xl"> 
            <DialogHeader>
              <DialogTitle>Criar Nova Ordem de Serviço</DialogTitle>
              <DialogDescription>
                Preencha os dados do cliente, veículo e os serviços/peças.
              </DialogDescription>
            </DialogHeader>

            {/* --- INÍCIO DO FORMULÁRIO --- */}
            <Form {...form}>
              <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
                
                {/* --- SEÇÃO: CLIENTE E VEÍCULO --- */}
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  <FormField
                    control={form.control}
                    name="clienteId"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Cliente</FormLabel>
                        <Select onValueChange={field.onChange} defaultValue={field.value}>
                          <FormControl>
                            <SelectTrigger>
                              <SelectValue placeholder="Selecione um cliente" />
                            </SelectTrigger>
                          </FormControl>
                          <SelectContent>
                            {clientes.map(cliente => (
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
                    name="veiculoPlaca"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Placa do Veículo</FormLabel>
                        <FormControl>
                          <Input placeholder="ABC-1234" {...field} />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  <FormField
                    control={form.control}
                    name="veiculoModelo"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Modelo do Veículo</FormLabel>
                        <FormControl>
                          <Input placeholder="Ex: Toyota Corolla" {...field} />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                </div>

                {/* --- SEÇÃO: DESCRIÇÃO DOS SERVIÇOS --- */}
                <FormField
                  control={form.control}
                  name="servicosDescricao"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Descrição dos Serviços / Observações</FormLabel>
                      <FormControl>
                        <Textarea
                          placeholder="Descreva os serviços a serem realizados ou observações sobre o veículo..."
                          {...field}
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                {/* --- SEÇÃO: ADICIONAR ITENS (PEÇAS/SERVIÇOS) --- */}
                <div>
                  <FormLabel>Adicionar Peças e Serviços</FormLabel>
                  <Popover open={isComboboxOpen} onOpenChange={setIsComboboxOpen}>
                    <PopoverTrigger asChild>
                      <Button
                        variant="outline"
                        role="combobox"
                        className="w-full justify-between mt-2"
                      >
                        Selecione um item...
                        <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
                      </Button>
                    </PopoverTrigger>
                    <PopoverContent className="w-[--radix-popover-trigger-width] p-0">
                      <Command>
                        <CommandInput placeholder="Buscar item..." />
                        <CommandList>
                          <CommandEmpty>Nenhum item encontrado.</CommandEmpty>
                          <CommandGroup>
                            {produtos.map((produto) => (
                              <CommandItem
                                key={produto.id}
                                value={produto.nome}
                                onSelect={() => {
                                  adicionarProduto(produto);
                                  setIsComboboxOpen(false);
                                }}
                              >
                                <Check
                                  className={cn(
                                    "mr-2 h-4 w-4",
                                    fields.some(item => item.id === produto.id)
                                      ? "opacity-100"
                                      : "opacity-0"
                                  )}
                                />
                                {produto.nome} ({produto.tipo}) - Estoque: {produto.estoqueAtual}
                              </CommandItem>
                            ))}
                          </CommandGroup>
                        </CommandList>
                      </Command>
                    </PopoverContent>
                  </Popover>
                  <FormMessage>{form.formState.errors.itens?.message}</FormMessage>
                </div>
                
                {/* --- SEÇÃO: ITENS ADICIONADOS --- */}
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
                          <TableCell colSpan={5} className="text-center">
                            Nenhum item adicionado.
                          </TableCell>
                        </TableRow>
                      )}
                      {fields.map((item, index) => (
                        <TableRow key={item.id}>
                          <TableCell>{item.nome}</TableCell>
                          <TableCell>
                            {/* Input de Quantidade (controlado) */}
                            <FormField
                              control={form.control}
                              name={`itens.${index}.qtde`}
                              render={({ field }) => (
                                <Input
                                  type="number"
                                  className="h-8"
                                  {...field}
                                  // Validação de estoque
                                  onChange={(e) => {
                                    const novaQtde = parseInt(e.target.value) || 0;
                                    if(item.tipo === 'peca' && novaQtde > item.estoqueAtual) {
                                      form.setError(`itens.${index}.qtde`, { 
                                        type: 'manual', 
                                        message: `Max: ${item.estoqueAtual}`
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
                          <TableCell>R$ {(item.precoUnitario * item.qtde).toFixed(2)}</TableCell>
                          <TableCell>
                            <Button
                              type="button"
                              variant="destructive"
                              size="icon-sm"
                              onClick={() => remove(index)} // Remove o item
                            >
                              <Trash2 className="h-4 w-4" />
                            </Button>
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>

                {/* --- SEÇÃO: TOTAL --- */}
                <div className="flex justify-end">
                  <h2 className="text-2xl font-bold">
                    Total da OS: R$ {valorTotalOS.toFixed(2)}
                  </h2>
                </div>

                <DialogFooter>
                  <Button 
                    type="submit" 
                    disabled={form.formState.isSubmitting} // Desativa o botão enquanto salva
                  >
                    {form.formState.isSubmitting ? "Salvando..." : "Salvar Ordem de Serviço"}
                  </Button>
                </DialogFooter>
              </form>
            </Form>
            {/* --- FIM DO FORMULÁRIO --- */}
            
          </DialogContent>
        </Dialog>
      </div>

      {/* --- TABELA PRINCIPAL DE ORDENS DE SERVIÇO --- */}
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
            {ordensDeServico.map((os) => (
              <TableRow key={os.id}>
                <TableCell>{os.numeroOS}</TableCell>
                <TableCell className="font-medium">{os.nomeCliente}</TableCell>
                <TableCell>{os.placaVeiculo}</TableCell>
                <TableCell>{new Date(os.dataAbertura.seconds * 1000).toLocaleDateString()}</TableCell>
                <TableCell>{os.status}</TableCell>
                <TableCell>R$ {os.valorTotal.toFixed(2)}</TableCell>
                <TableCell>{/* TODO: Botões de Ver/Editar */}</TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>
    </div>
  );
}