// src/app/(dashboard)/entrada-estoque/page.tsx
"use client";

import { useState, useEffect } from "react";
import { useForm, useFieldArray } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import {
  collection,
  addDoc,
  onSnapshot,
  runTransaction,
  doc,
  updateDoc,
  query,
  where
} from "firebase/firestore";
import { db } from "@/lib/firebase";
import { cn } from "@/lib/utils";
import { Check, ChevronsUpDown, Trash2 } from "lucide-react";

// --- Importações dos componentes Shadcn ---
import { Button } from "@/components/ui/button";
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
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
// --- CORREÇÃO: Importações do Card e Footer ---
import { Card, CardContent } from "@/components/ui/card";
import { DialogFooter } from "@/components/ui/dialog"; // Usado para o espaçamento do botão


// --- Tipos de Dados (Interfaces) ---
interface Fornecedor {
  id: string;
  nome: string;
}
interface Produto {
  id: string;
  nome: string;
  precoCusto: number;
  estoqueAtual: number;
  tipo: "peca" | "servico";
}

// --- Schema de Validação ZOD ---
// Este schema é mais simples e não deve dar erro no build
const compraFormSchema = z.object({
  fornecedorId: z.string().min(1, "Selecione um fornecedor."),
  formaPagamento: z.enum(["pix", "dinheiro", "cartao_debito"]),
  notaFiscal: z.string().optional(), // Número da NF-e de compra
  itens: z
    .array(
      z.object({
        id: z.string(), // ID do produto
        nome: z.string(),
        qtde: z.coerce.number().min(1, "Qtde deve ser 1+"),
        precoCustoUnitario: z.coerce.number().min(0, "Custo deve ser 0+"), // O novo custo
        estoqueAntigo: z.number(), // O estoque antes da compra
      })
    )
    .min(1, "Adicione pelo menos uma peça."),
});

export default function EntradaEstoquePage() {
  const [fornecedores, setFornecedores] = useState<Fornecedor[]>([]);
  const [produtos, setProdutos] = useState<Produto[]>([]);
  const [isComboboxOpen, setIsComboboxOpen] = useState(false);

  // --- Efeito para Buscar Fornecedores e Produtos ---
  useEffect(() => {
    // 1. Buscar Fornecedores
    const unsubForn = onSnapshot(collection(db, "fornecedores"), (snapshot) => {
      setFornecedores(
        snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Fornecedor))
      );
    });

    // 2. Buscar Produtos (apenas do tipo 'peca')
    const q = query(collection(db, "produtos"), where("tipo", "==", "peca"));
    const unsubProd = onSnapshot(q, (snapshot) => {
      setProdutos(
        snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Produto))
      );
    });

    return () => {
      unsubForn();
      unsubProd();
    };
  }, []);

  // --- Configuração do Formulário ---
  const form = useForm<z.infer<typeof compraFormSchema>>({
    resolver: zodResolver(compraFormSchema),
    defaultValues: {
      fornecedorId: "",
      formaPagamento: "pix",
      notaFiscal: "",
      itens: [],
    },
  });

  const { fields, append, remove, update } = useFieldArray({
    control: form.control,
    name: "itens",
  });

  // Função para adicionar um produto na lista de compra
  const adicionarProduto = (produto: Produto) => {
    const itemIndex = fields.findIndex((field) => field.id === produto.id);

    if (itemIndex > -1) {
      alert("Item já está na lista. Altere a quantidade manualmente.");
      return;
    }
    
    append({
      id: produto.id,
      nome: produto.nome,
      qtde: 1,
      precoCustoUnitario: produto.precoCusto, // Puxa o último custo cadastrado
      estoqueAntigo: produto.estoqueAtual,
    });
    setIsComboboxOpen(false);
  };

  const watchedItens = form.watch("itens");
  // Calcula o Custo Total da Compra
  const custoTotalCompra = watchedItens.reduce((total, item) => {
    const quantidade = item.qtde || 0;
    const custo = item.precoCustoUnitario || 0;
    return total + (custo * quantidade);
  }, 0);

  // --- FUNÇÃO DE SALVAR A COMPRA ---
  async function onSubmit(values: z.infer<typeof compraFormSchema>) {
    const fornecedorSelecionado = fornecedores.find(f => f.id === values.fornecedorId);
    if (!fornecedorSelecionado) {
      alert("Erro: Fornecedor não encontrado.");
      return;
    }

    try {
      // Usamos uma transação para garantir que tudo (estoque e despesa) funcione
      await runTransaction(db, async (transaction) => {
        // 1. Atualiza o estoque e o custo de cada produto
        for (const item of values.itens) {
          const produtoRef = doc(db, "produtos", item.id);
          const novoEstoque = item.estoqueAntigo + item.qtde;
          
          transaction.update(produtoRef, { 
            estoqueAtual: novoEstoque,
            precoCusto: item.precoCustoUnitario // Atualiza o custo da peça
          });
        }

        // 2. Registra a "saída" (despesa) no Livro Caixa
        const movRef = doc(collection(db, "movimentacoes"));
        transaction.set(movRef, {
          data: new Date(),
          tipo: "saida", // Compra é uma SAÍDA de caixa
          descricao: `Compra NF #${values.notaFiscal || 'S/N'} - Forn: ${fornecedorSelecionado.nome}`,
          valor: custoTotalCompra,
          formaPagamento: values.formaPagamento,
          referenciaId: values.notaFiscal, // Guarda a NF da compra
        });
      });

      console.log("Compra registrada e estoque atualizado!");
      form.reset();
      
    } catch (error: any) {
      console.error("Erro na transação de compra: ", error);
      alert("Erro ao registrar a compra: " + error.message);
    }
  }

  return (
    <div>
      <h1 className="text-4xl font-bold mb-6">Registrar Entrada de Estoque (Compra)</h1>
      
      <Card>
        <CardContent className="pt-6">
          <Form {...form}>
            <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
              {/* --- SEÇÃO: FORNECEDOR E PAGAMENTO --- */}
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <FormField
                  control={form.control}
                  name="fornecedorId"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Fornecedor</FormLabel>
                      <Select onValueChange={field.onChange} defaultValue={field.value}>
                        <FormControl>
                          <SelectTrigger>
                            <SelectValue placeholder="Selecione um fornecedor" />
                          </SelectTrigger>
                        </FormControl>
                        <SelectContent>
                          {fornecedores.map(f => (
                            <SelectItem key={f.id} value={f.id}>
                              {f.nome}
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
                  name="formaPagamento"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Forma de Pagamento</FormLabel>
                      <Select onValueChange={field.onChange} defaultValue={field.value}>
                        <FormControl>
                          <SelectTrigger>
                            <SelectValue placeholder="Selecione..." />
                          </SelectTrigger>
                        </FormControl>
                        <SelectContent>
                          <SelectItem value="dinheiro">Dinheiro</SelectItem>
                          <SelectItem value="pix">Pix</SelectItem>
                          <SelectItem value="cartao_debito">Cartão de Débito</SelectItem>
                        </SelectContent>
                      </Select>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={form.control}
                  name="notaFiscal"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Nº Nota Fiscal (Opcional)</FormLabel>
                      <FormControl>
                        <Input placeholder="Nº da NF-e" {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>

              {/* --- SEÇÃO: ADICIONAR PEÇAS --- */}
              <div>
                <FormLabel>Adicionar Peças Compradas</FormLabel>
                <Popover open={isComboboxOpen} onOpenChange={setIsComboboxOpen}>
                  <PopoverTrigger asChild>
                    <Button variant="outline" role="combobox" className="w-full justify-between mt-2">
                      Selecione uma peça...
                      <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
                    </Button>
                  </PopoverTrigger>
                  <PopoverContent className="w-[--radix-popover-trigger-width] p-0">
                    <Command>
                      <CommandInput placeholder="Buscar peça..." />
                      <CommandList>
                        <CommandEmpty>Nenhuma peça encontrada.</CommandEmpty>
                        <CommandGroup>
                          {produtos.map((produto) => (
                            <CommandItem
                              key={produto.id}
                              value={produto.nome}
                              onSelect={() => { adicionarProduto(produto); }}
                            >
                              <Check
                                className={cn("mr-2 h-4 w-4", fields.some((item) => item.id === produto.id) ? "opacity-100" : "opacity-0")}
                              />
                              {produto.nome} (Estoque atual: {produto.estoqueAtual})
                            </CommandItem>
                          ))}
                        </CommandGroup>
                      </CommandList>
                    </Command>
                  </PopoverContent>
                </Popover>
                <FormMessage>{form.formState.errors.itens?.message}</FormMessage>
              </div>

              {/* --- SEÇÃO: ITENS DA COMPRA --- */}
              <div className="rounded-md border">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Peça</TableHead>
                      <TableHead className="w-[120px]">Qtde Comprada</TableHead>
                      <TableHead className="w-[150px]">Custo Unit. (R$)</TableHead>
                      <TableHead className="w-[120px]">Custo Total</TableHead>
                      <TableHead className="w-[50px]">Ações</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {fields.length === 0 && (
                      <TableRow>
                        <TableCell colSpan={5} className="text-center">Nenhuma peça adicionada.</TableCell>
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
                              <Input type="number" className="h-8" {...field} />
                            )}
                          />
                        </TableCell>
                        <TableCell>
                          <FormField
                            control={form.control}
                            name={`itens.${index}.precoCustoUnitario`}
                            render={({ field }) => (
                              <Input type="number" step="0.01" className="h-8" {...field} />
                            )}
                          />
                        </TableCell>
                        <TableCell>
                          R$ {( (item.precoCustoUnitario || 0) * (item.qtde || 0) ).toFixed(2)}
                        </TableCell>
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

              {/* --- SEÇÃO: TOTAL --- */}
              <div className="flex justify-end">
                <h2 className="text-2xl font-bold">
                  Custo Total da Compra: R$ {custoTotalCompra.toFixed(2)}
                </h2>
              </div>

              <DialogFooter className="pt-4">
                <Button type="submit" disabled={form.formState.isSubmitting}>
                  {form.formState.isSubmitting ? "Salvando..." : "Registrar Compra"}
                </Button>
              </DialogFooter>
            </form>
          </Form>
        </CardContent>
      </Card>
    </div>
  );
}