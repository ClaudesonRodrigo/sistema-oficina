// src/app/(dashboard)/produtos/page.tsx
"use client";

import { useState, useEffect } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
// 1. IMPORTAÇÕES ADICIONADAS
import { collection, addDoc, onSnapshot, query, where, getDocs } from "firebase/firestore"; 
import { db } from "@/lib/firebase";
import { Search } from "lucide-react"; // Ícone de busca

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

// --- INTERFACE DO PRODUTO ATUALIZADA ---
interface Produto {
  id: string; 
  nome: string;
  codigoSku?: string;
  precoCusto: number;
  precoVenda: number;
  estoqueAtual: number;
  tipo: "peca" | "servico";
}

// Interface para os itens dentro de uma OS
interface ItemOS {
  id: string;
  qtde: number;
}

// --- SCHEMA DO FORMULÁRIO ATUALIZADO ---
const formSchema = z.object({
  nome: z.string().min(3, { message: "O nome deve ter pelo menos 3 caracteres." }),
  codigoSku: z.string().optional(),
  
  // ===== AQUI ESTÁ A SUA CORREÇÃO APLICADA =====
  // Simplificado para remover o objeto que causa o erro de build
  tipo: z.enum(["peca", "servico"]),
  // ============================================

  precoCusto: z.coerce.number().min(0, { message: "O custo deve ser positivo." }),
  precoVenda: z.coerce.number().min(0, { message: "O preço deve ser positivo." }),
  // Validação para tipo 'peca'
  estoqueAtual: z.coerce.number().int({ message: "O estoque deve ser um número inteiro." }),
}).refine((data) => {
  // Se for 'servico', o estoque não importa (será 0), mas se for 'peca', deve ser >= 0
  if (data.tipo === 'peca') {
    return data.estoqueAtual >= 0;
  }
  return true;
}, {
  message: "Estoque deve ser 0 ou mais para peças.",
  path: ["estoqueAtual"],
});


export default function ProdutosPage() {
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [produtos, setProdutos] = useState<Produto[]>([]);

  // --- 2. NOVOS ESTADOS PARA O RELATÓRIO ---
  const [isReportModalOpen, setIsReportModalOpen] = useState(false);
  const [selectedProduto, setSelectedProduto] = useState<Produto | null>(null);
  const [totalVendido, setTotalVendido] = useState<number | null>(null);
  const [loadingReport, setLoadingReport] = useState(false);

  useEffect(() => {
    const unsub = onSnapshot(collection(db, "produtos"), (querySnapshot) => {
      const listaDeProdutos: Produto[] = [];
      querySnapshot.forEach((doc) => {
        listaDeProdutos.push({
          id: doc.id,
          ...doc.data()
        } as Produto); 
      });
      setProdutos(listaDeProdutos);
    });
    return () => unsub();
  }, []); 

  const form = useForm<z.infer<typeof formSchema>>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      nome: "",
      codigoSku: "",
      tipo: "peca",
      precoCusto: 0,
      precoVenda: 0,
      estoqueAtual: 0,
    },
  });

  const tipoProduto = form.watch("tipo");

  async function onSubmit(values: z.infer<typeof formSchema>) {
    try {
      const dadosParaSalvar = {
        ...values,
        // Se for serviço, força o estoque para 0, senão usa o valor digitado
        estoqueAtual: values.tipo === 'servico' ? 0 : values.estoqueAtual
      };

      const docRef = await addDoc(collection(db, "produtos"), dadosParaSalvar);
      console.log("Produto salvo com ID: ", docRef.id);
      
      form.reset();
      setIsModalOpen(false);

    } catch (error) {
      console.error("Erro ao salvar produto: ", error);
    }
  }

  // --- 3. NOVA FUNÇÃO PARA ABRIR O MODAL E CALCULAR VENDAS ---
  const handleVerRelatorio = async (produto: Produto) => {
    setSelectedProduto(produto);
    setIsReportModalOpen(true);
    setLoadingReport(true);
    setTotalVendido(null);

    try {
      // Esta query é pesada: ela busca em TODAS as OS
      const osRef = collection(db, "ordensDeServico");
      const q = query(osRef, where("status", "==", "finalizada"));
      const querySnapshot = await getDocs(q);

      let total = 0;
      querySnapshot.forEach((doc) => {
        const os = doc.data();
        const itens = os.itens as ItemOS[];
        
        // Loop dentro dos itens de cada OS
        if (itens && itens.length > 0) {
          itens.forEach((item) => {
            if (item.id === produto.id) {
              total += item.qtde;
            }
          });
        }
      });
      
      setTotalVendido(total);
    } catch (error) {
      console.error("Erro ao calcular total vendido: ", error);
      setTotalVendido(0); // Mostra 0 em caso de erro
    } finally {
      setLoadingReport(false);
    }
  };


  return (
    <div>
      <div className="flex justify-between items-center mb-6">
        <h1 className="text-4xl font-bold">Produtos e Peças</h1>
        
        <Dialog open={isModalOpen} onOpenChange={setIsModalOpen}>
          <DialogTrigger asChild>
            <Button>Adicionar Novo</Button>
          </DialogTrigger>
          <DialogContent className="sm:max-w-[425px]">
            <DialogHeader>
              <DialogTitle>Adicionar Novo Item</DialogTitle>
              <DialogDescription>
                Preencha as informações da nova peça ou serviço.
              </DialogDescription>
            </DialogHeader>

            <Form {...form}>
              <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
                
                <FormField
                  control={form.control}
                  name="nome"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Nome do Item</FormLabel>
                      <FormControl>
                        <Input placeholder="Ex: Filtro de Ar ou Troca de Óleo" {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                
                <FormField
                  control={form.control}
                  name="tipo"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Tipo</FormLabel>
                       <Select onValueChange={field.onChange} defaultValue={field.value}>
                        <FormControl>
                          <SelectTrigger>
                            <SelectValue placeholder="Selecione se é peça ou serviço" />
                          </SelectTrigger>
                        </FormControl>
                        <SelectContent>
                          <SelectItem value="peca">Peça</SelectItem>
                          <SelectItem value="servico">Serviço</SelectItem>
                        </SelectContent>
                      </Select>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="codigoSku"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Código (SKU)</FormLabel>
                      <FormControl>
                        <Input placeholder="Opcional" {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <div className="grid grid-cols-2 gap-4">
                   <FormField
                    control={form.control}
                    name="precoCusto"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Valor de Custo (R$)</FormLabel>
                        <FormControl>
                          <Input type="number" step="0.01" {...field} />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  <FormField
                    control={form.control}
                    name="precoVenda"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Valor de Venda (R$)</FormLabel>
                        <FormControl>
                          <Input type="number" step="0.01" {...field} />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                </div>
                
                {/* MOSTRA O CAMPO ESTOQUE APENAS SE FOR 'PECA' */}
                {tipoProduto === 'peca' && (
                  <FormField
                    control={form.control}
                    name="estoqueAtual"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Estoque Atual</FormLabel>
                        <FormControl>
                          <Input type="number" {...field} />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                )}

                <DialogFooter>
                  <Button 
                    type="submit" 
                    disabled={form.formState.isSubmitting}
                  >
                    {form.formState.isSubmitting ? "Salvando..." : "Salvar Item"}
                  </Button>
                </DialogFooter>

              </form>
            </Form>
          </DialogContent>
        </Dialog>
      </div>

      {/* --- TABELA ATUALIZADA COM BOTÃO DE RELATÓRIO --- */}
      <div className="rounded-md border">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Nome</TableHead>
              <TableHead>Tipo</TableHead>
              <TableHead>Estoque</TableHead>
              <TableHead>Custo (R$)</TableHead>
              <TableHead>Venda (R$)</TableHead>
              <TableHead>Ações</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {produtos.map((produto) => (
              <TableRow key={produto.id}>
                <TableCell className="font-medium">{produto.nome}</TableCell>
                <TableCell className="capitalize">{produto.tipo}</TableCell>
                <TableCell>{produto.tipo === 'peca' ? produto.estoqueAtual : 'N/A'}</TableCell>
                <TableCell>{produto.precoCusto?.toFixed(2)}</TableCell>
                <TableCell>{produto.precoVenda.toFixed(2)}</TableCell>
                <TableCell>
                  {/* --- 4. NOVO BOTÃO DE RELATÓRIO --- */}
                  <Button variant="ghost" size="sm" onClick={() => handleVerRelatorio(produto)}>
                    <Search className="h-4 w-4 mr-2" />
                    Relatório
                  </Button>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>

      {/* --- 5. NOVO MODAL DE RELATÓRIO --- */}
      <Dialog open={isReportModalOpen} onOpenChange={setIsReportModalOpen}>
        <DialogContent className="sm:max-w-[425px]">
          <DialogHeader>
            <DialogTitle>Relatório de Produto</DialogTitle>
            <DialogDescription>
              {selectedProduto?.nome}
            </DialogDescription>
          </DialogHeader>
          <div className="py-4 space-y-4">
            <div className="flex justify-between items-center">
              <span className="font-medium">Estoque Atual:</span>
              <span className="text-2xl font-bold">
                {selectedProduto?.tipo === 'peca' ? selectedProduto?.estoqueAtual : 'N/A (Serviço)'}
              </span>
            </div>
            <div className="flex justify-between items-center">
              <span className="font-medium">Total Vendido (em OS Finalizadas):</span>
              <span className="text-2xl font-bold">
                {loadingReport ? 'Calculando...' : totalVendido}
              </span>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setIsReportModalOpen(false)}>
              Fechar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}