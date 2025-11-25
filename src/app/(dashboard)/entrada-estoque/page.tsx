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

import { useAuth } from "@/context/AuthContext";
import { useRouter } from "next/navigation";

// Componentes Shadcn
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
import { Card, CardContent } from "@/components/ui/card";
import { DialogFooter } from "@/components/ui/dialog"; 

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

const compraFormSchema = z.object({
  fornecedorId: z.string().min(1, "Selecione um fornecedor."),
  formaPagamento: z.enum(["pix", "dinheiro", "cartao_debito"]),
  notaFiscal: z.string().optional(),
  itens: z
    .array(
      z.object({
        id: z.string(),
        nome: z.string(),
        qtde: z.coerce.number().min(1, "Qtde deve ser 1+"),
        precoCustoUnitario: z.coerce.number().min(0, "Custo deve ser 0+"),
        estoqueAntigo: z.number(),
      })
    )
    .min(1, "Adicione pelo menos uma peça."),
});

export default function EntradaEstoquePage() {
  const [fornecedores, setFornecedores] = useState<Fornecedor[]>([]);
  const [produtos, setProdutos] = useState<Produto[]>([]);
  const [isComboboxOpen, setIsComboboxOpen] = useState(false);

  const { userData, loading: authLoading } = useAuth();
  const router = useRouter();

  if (authLoading) {
    return (
      <div className="flex h-screen w-full items-center justify-center">
        Carregando permissões...
      </div>
    );
  }

  // Acesso restrito a Admin (se quiser liberar para operador, remova este bloco if)
  if (!userData || userData.role !== 'admin') {
    router.push('/');
    return (
       <div className="flex h-screen w-full items-center justify-center">
         Acesso negado. Redirecionando...
       </div>
    );
  }

  useEffect(() => {
    if (userData) {
      
      // --- CORREÇÃO: Busca TODOS os fornecedores (sem filtro de ownerId) ---
      const qForn = query(collection(db, "fornecedores"));
      
      const unsubForn = onSnapshot(qForn, (snapshot) => {
        setFornecedores(
          snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Fornecedor))
        );
      });

      // Busca Produtos
      const qProd = query(collection(db, "produtos"), where("tipo", "==", "peca"));
      const unsubProd = onSnapshot(qProd, (snapshot) => {
        setProdutos(
          snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Produto))
        );
      });

      return () => {
        unsubForn();
        unsubProd();
      };
    }
  }, [userData]);

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
      precoCustoUnitario: produto.precoCusto,
      estoqueAntigo: produto.estoqueAtual,
    });
    setIsComboboxOpen(false);
  };

  const watchedItens = form.watch("itens");
  const custoTotalCompra = watchedItens.reduce((total, item) => {
    const quantidade = item.qtde || 0;
    const custo = item.precoCustoUnitario || 0;
    return total + (custo * quantidade);
  }, 0);

  async function onSubmit(values: z.infer<typeof compraFormSchema>) {
    if (!userData) {
      alert("Erro: Usuário não autenticado.");
      return;
    }
    
    const fornecedorSelecionado = fornecedores.find(f => f.id === values.fornecedorId);
    if (!fornecedorSelecionado) {
      alert("Erro: Fornecedor não encontrado.");
      return;
    }

    try {
      await runTransaction(db, async (transaction) => {
        // 1. Atualiza Estoque e Custo
        for (const item of values.itens) {
          const produtoRef = doc(db, "produtos", item.id);
          const novoEstoque = item.estoqueAntigo + item.qtde;
          
          transaction.update(produtoRef, { 
            estoqueAtual: novoEstoque,
            precoCusto: item.precoCustoUnitario
          });
        }

        // 2. Registra Saída no Caixa
        const movRef = doc(collection(db, "movimentacoes"));
        transaction.set(movRef, {
          data: new Date(),
          tipo: "saida",
          descricao: `Compra NF #${values.notaFiscal || 'S/N'} - Forn: ${fornecedorSelecionado.nome}`,
          valor: custoTotalCompra,
          formaPagamento: values.formaPagamento,
          referenciaId: values.notaFiscal,
          ownerId: userData.id
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
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <FormField
                  control={form.control}
                  name="fornecedorId"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Fornecedor</FormLabel>
                      <FormControl>
                        <Select onValueChange={field.onChange} value={field.value}>
                          <SelectTrigger>
                            <SelectValue placeholder="Selecione um fornecedor" />
                          </SelectTrigger>
                          <SelectContent>
                            {fornecedores.map(f => (
                              <SelectItem key={f.id} value={f.id}>
                                {f.nome}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </FormControl>
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
                      <FormControl>
                        <Select onValueChange={field.onChange} value={field.value}>
                          <SelectTrigger>
                            <SelectValue placeholder="Selecione..." />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="dinheiro">Dinheiro</SelectItem>
                            <SelectItem value="pix">Pix</SelectItem>
                            <SelectItem value="cartao_debito">Cartão de Débito</SelectItem>
                          </SelectContent>
                        </Select>
                      </FormControl>
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