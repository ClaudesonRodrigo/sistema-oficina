// src/app/(dashboard)/pdv/page.tsx
"use client";

import { useState, useEffect, useRef } from "react";
import { collection, onSnapshot, query } from "firebase/firestore";
import { db, auth } from "@/lib/firebase";
import { useAuth } from "@/context/AuthContext";
import { Search, ShoppingCart, Trash2, CreditCard, Banknote, QrCode, Printer, CheckCircle2 } from "lucide-react";
import { toast } from "sonner";

// UI Components
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";

// --- CORREÇÃO 1: Adicionado o tipo na interface ---
interface Produto {
  id: string;
  nome: string;
  codigoSku?: string;
  precoVenda: number;
  estoqueAtual: number;
  tipo?: "peca" | "servico"; 
}

interface ItemCarrinho extends Produto {
  qtde: number;
}

// Formatador Universal de Moeda
const formatCurrency = (value: number) => {
  return new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(value);
};

export default function PdvPage() {
  const { userData } = useAuth();
  
  // Estados Principais
  const [produtos, setProdutos] = useState<Produto[]>([]);
  const [busca, setBusca] = useState("");
  const [carrinho, setCarrinho] = useState<ItemCarrinho[]>([]);
  const [formaPagamento, setFormaPagamento] = useState("dinheiro");
  const [loading, setLoading] = useState(false);

  // Estados de Pós-Venda (Recibo)
  const [modalSucessoAberto, setModalSucessoAberto] = useState(false);
  const [ultimaVenda, setUltimaVenda] = useState<{
    itens: ItemCarrinho[];
    total: number;
    pagamento: string;
    data: Date;
    operador: string;
  } | null>(null);

  // Referência para focar no input após adicionar
  const inputBuscaRef = useRef<HTMLInputElement>(null);

  // 1. Carregar Produtos
  useEffect(() => {
    if (!userData) return;
    const q = query(collection(db, "produtos"));
    const unsub = onSnapshot(q, (snapshot) => {
      setProdutos(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Produto)));
    });
    return () => unsub();
  }, [userData]);

  // 2. Filtro de Produtos
  const produtosFiltrados = produtos.filter(p => {
    if (!busca) return false;
    const termo = busca.toLowerCase();
    const matchNome = p.nome.toLowerCase().includes(termo);
    const matchSku = p.codigoSku?.toLowerCase().includes(termo);
    return matchNome || matchSku;
  }).slice(0, 5); 

  // 3. Adicionar ao Carrinho
  const adicionarAoCarrinho = (produto: Produto) => {
    const itemNoCarrinho = carrinho.find(i => i.id === produto.id);
    const qtdeAtual = itemNoCarrinho ? itemNoCarrinho.qtde : 0;

    // --- CORREÇÃO 2: Só bloqueia estoque se for PEÇA ---
    if (produto.tipo !== "servico" && qtdeAtual + 1 > produto.estoqueAtual) {
      toast.error(`Estoque insuficiente! Restam apenas ${produto.estoqueAtual} unid.`);
      return;
    }

    if (itemNoCarrinho) {
      setCarrinho(carrinho.map(i => i.id === produto.id ? { ...i, qtde: i.qtde + 1 } : i));
    } else {
      setCarrinho([...carrinho, { ...produto, qtde: 1 }]);
    }
    
    setBusca(""); 
    inputBuscaRef.current?.focus(); 
    toast.success("Item adicionado.");
  };

  // 4. Remover do Carrinho
  const removerItem = (id: string) => {
    setCarrinho(carrinho.filter(i => i.id !== id));
  };

  const total = carrinho.reduce((acc, item) => acc + (item.precoVenda * item.qtde), 0);

  // 5. Finalizar Venda
  const finalizarVenda = async () => {
    if (carrinho.length === 0) {
      toast.warning("O carrinho está vazio!");
      return;
    }

    setLoading(true);
    const toastId = toast.loading("Processando venda...");

    try {
      const token = await auth.currentUser?.getIdToken();
      
      const response = await fetch('/api/pdv/venda', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
        body: JSON.stringify({
          itens: carrinho,
          total,
          formaPagamento,
          ownerId: userData?.id,
          operadorNome: userData?.nome || "Operador"
        })
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || "Erro desconhecido na API");
      }

      toast.dismiss(toastId);
      toast.success("Venda Concluída!");

      setUltimaVenda({
        itens: [...carrinho],
        total,
        pagamento: formaPagamento,
        data: new Date(),
        operador: userData?.nome || "Operador"
      });

      setCarrinho([]); 
      setBusca("");
      setFormaPagamento("dinheiro");
      setModalSucessoAberto(true);

    } catch (error: any) {
      toast.dismiss(toastId);
      console.error(error);
      toast.error(error.message || "Erro ao processar venda.");
    } finally {
      setLoading(false);
    }
  };

  // Atalho F2
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "F2") {
        e.preventDefault();
        if (carrinho.length > 0 && !loading && !modalSucessoAberto) {
          finalizarVenda();
        }
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [carrinho, loading, modalSucessoAberto]);

  // 6. Lógica Ninja de Impressão (Bala de Prata para PDV)
  const handlePrint = () => {
    if (!ultimaVenda) return;

    const janelaImpressao = window.open('', '_blank', 'width=400,height=600');
    if (!janelaImpressao) {
      toast.error("O navegador bloqueou a impressão. Permita os pop-ups!");
      return;
    }

    const linhasItens = ultimaVenda.itens.map(item => `
      <tr>
        <td style="padding-bottom: 4px;">${item.qtde}x ${item.nome}</td>
        <td style="text-align: right; padding-bottom: 4px;">${item.precoVenda.toFixed(2)}</td>
        <td style="text-align: right; font-weight: bold; padding-bottom: 4px;">${(item.qtde * item.precoVenda).toFixed(2)}</td>
      </tr>
    `).join('');

    janelaImpressao.document.write(`
      <html>
        <head>
          <title>Recibo</title>
          <style>
            @page { margin: 0; }
            body { 
              font-family: monospace; 
              margin: 0; 
              padding: 10px; 
              width: 80mm; 
              font-size: 12px; 
              color: #000; 
            }
            table { width: 100%; border-collapse: collapse; margin: 10px 0; }
            th { text-align: left; border-bottom: 1px dashed #000; padding-bottom: 4px; }
            .text-right { text-align: right; }
            .center { text-align: center; }
            .linha-tracejada { border-top: 1px dashed #000; margin: 8px 0; }
          </style>
        </head>
        <body>
          <div class="center">
            <h2 style="margin: 0; font-size: 16px;">RODRIGO SKAP</h2>
            <p style="margin: 2px 0;">avenida Euclides Figueiredo,439, Aracaju</p>
            <p style="margin: 2px 0;">Recibo Não Fiscal</p>
            <p style="margin: 2px 0;">Data: ${ultimaVenda.data.toLocaleDateString()} ${ultimaVenda.data.toLocaleTimeString()}</p>
            <p style="margin: 2px 0;">Operador: ${ultimaVenda.operador}</p>
          </div>
          
          <div class="linha-tracejada"></div>
          
          <table>
            <thead>
              <tr>
                <th>Item</th>
                <th class="text-right">Unit</th>
                <th class="text-right">Total</th>
              </tr>
            </thead>
            <tbody>
              ${linhasItens}
            </tbody>
          </table>
          
          <div class="linha-tracejada"></div>
          
          <div style="display: flex; justify-content: space-between; font-weight: bold; font-size: 14px;">
            <span>TOTAL:</span>
            <span>R$ ${ultimaVenda.total.toFixed(2)}</span>
          </div>
          <div style="display: flex; justify-content: space-between; font-size: 12px; margin-top: 4px; text-transform: uppercase;">
            <span>Pagamento:</span>
            <span>${ultimaVenda.pagamento}</span>
          </div>
          
          <div class="linha-tracejada"></div>
          
          <div class="center" style="margin-top: 15px; font-style: italic;">
            <p style="margin: 2px 0;">Obrigado pela preferência!</p>
            <p style="margin: 2px 0;">Volte Sempre</p>
          </div>
          
          <div style="margin-top: 30px;" class="center">.</div>
        </body>
      </html>
    `);

    janelaImpressao.document.close();
    janelaImpressao.focus();

    setTimeout(() => {
      janelaImpressao.print();
      janelaImpressao.close(); 
      fecharModalNovaVenda(); 
    }, 500);
  };

  const fecharModalNovaVenda = () => {
    setModalSucessoAberto(false);
    setUltimaVenda(null);
    inputBuscaRef.current?.focus();
  };

  return (
    <div className="flex flex-col h-[calc(100vh-100px)] gap-4">
      <h1 className="text-3xl font-bold flex items-center gap-2">
        <ShoppingCart className="h-8 w-8" /> PDV - Venda Rápida
      </h1>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6 h-full">
        <div className="md:col-span-2 flex flex-col gap-4">
          <Card className="border-2 border-primary/20">
            <CardContent className="p-4">
              <div className="relative">
                <Search className="absolute left-3 top-3 h-5 w-5 text-gray-400" />
                <Input 
                  ref={inputBuscaRef}
                  placeholder="Bipe o código ou digite o nome..." 
                  className="pl-10 text-xl h-12"
                  value={busca}
                  onChange={(e) => setBusca(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') {
                      if (produtosFiltrados.length === 1) {
                        adicionarAoCarrinho(produtosFiltrados[0]);
                      } else {
                        e.preventDefault();
                      }
                    }
                  }}
                />
              </div>
              
              {busca && (
                <div className="mt-2 border rounded-md shadow-lg bg-white absolute w-full md:w-[65%] z-50">
                  {produtosFiltrados.map(p => (
                    <div 
                      key={p.id} 
                      className="p-3 hover:bg-gray-100 cursor-pointer border-b flex justify-between items-center"
                      onClick={() => adicionarAoCarrinho(p)}
                    >
                      <div>
                        <p className="font-bold text-lg">{p.nome}</p>
                        <p className="text-sm text-gray-500">
                          {p.tipo === 'servico' ? "Serviço" : `SKU: ${p.codigoSku || "S/N"}`}
                        </p>
                      </div>
                      <div className="flex flex-col items-end">
                        <span className="text-green-600 font-bold text-lg">{formatCurrency(p.precoVenda)}</span>
                        <span className="text-gray-500 text-sm">
                          {p.tipo === 'servico' ? "Ilimitado" : `Estoque: ${p.estoqueAtual}`}
                        </span>
                      </div>
                    </div>
                  ))}
                  {produtosFiltrados.length === 0 && <div className="p-4 text-center text-gray-500 font-medium">Produto não encontrado.</div>}
                </div>
              )}
            </CardContent>
          </Card>

          <Card className="flex-1 overflow-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Produto/Serviço</TableHead>
                  <TableHead className="w-[100px]">Qtd</TableHead>
                  <TableHead className="text-right">Total</TableHead>
                  <TableHead className="w-[50px]"></TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {carrinho.map((item) => (
                  <TableRow key={item.id}>
                    <TableCell>
                      <div className="font-medium text-lg">{item.nome}</div>
                      <div className="text-sm text-gray-500">Unit: {formatCurrency(item.precoVenda)}</div>
                    </TableCell>
                    <TableCell>
                      <Input 
                        type="number" 
                        className="h-10 w-20 text-center font-bold" 
                        value={item.qtde}
                        onChange={(e) => {
                          const novaQtde = parseInt(e.target.value);
                          if (novaQtde > 0) {
                            // --- CORREÇÃO 3: Só bloqueia se for PEÇA ---
                            if(item.tipo !== "servico" && novaQtde > item.estoqueAtual) {
                              toast.error(`Máximo disponível: ${item.estoqueAtual}`);
                              return;
                            }
                            setCarrinho(carrinho.map(i => i.id === item.id ? { ...i, qtde: novaQtde } : i));
                          }
                        }} 
                      />
                    </TableCell>
                    <TableCell className="text-right font-bold text-lg">
                      {formatCurrency(item.precoVenda * item.qtde)}
                    </TableCell>
                    <TableCell>
                      <Button variant="ghost" size="icon" onClick={() => removerItem(item.id)}>
                        <Trash2 className="h-5 w-5 text-red-500" />
                      </Button>
                    </TableCell>
                  </TableRow>
                ))}
                {carrinho.length === 0 && (
                  <TableRow>
                    <TableCell colSpan={4} className="text-center py-20 text-gray-400">
                      <ShoppingCart className="h-12 w-12 mx-auto mb-4 opacity-20" />
                      <p className="text-lg">Carrinho vazio. Bipe um produto para começar.</p>
                    </TableCell>
                  </TableRow>
                )}
              </TableBody>
            </Table>
          </Card>
        </div>

        <div className="flex flex-col gap-4">
          <Card className="bg-slate-50 border-2">
            <CardHeader>
              <CardTitle>Resumo da Venda</CardTitle>
            </CardHeader>
            <CardContent className="space-y-6">
              <div className="flex justify-between items-center text-lg">
                <span className="text-gray-600">Total de Itens:</span>
                <span className="font-bold">{carrinho.reduce((acc, i) => acc + i.qtde, 0)}</span>
              </div>
              <div className="flex justify-between items-center text-4xl font-black text-green-600 border-t border-b py-4 border-gray-200">
                <span>Total:</span>
                <span>{formatCurrency(total)}</span>
              </div>

              <div className="space-y-2">
                <label className="text-sm font-bold text-gray-700 uppercase tracking-wider">Forma de Pagamento</label>
                <Select value={formaPagamento} onValueChange={setFormaPagamento}>
                  <SelectTrigger className="h-14 text-lg bg-white">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="dinheiro"><div className="flex items-center gap-2"><Banknote className="h-5 w-5 text-green-600"/> Dinheiro</div></SelectItem>
                    <SelectItem value="pix"><div className="flex items-center gap-2"><QrCode className="h-5 w-5 text-blue-600"/> PIX</div></SelectItem>
                    <SelectItem value="credito"><div className="flex items-center gap-2"><CreditCard className="h-5 w-5 text-orange-600"/> Cartão Crédito</div></SelectItem>
                    <SelectItem value="debito"><div className="flex items-center gap-2"><CreditCard className="h-5 w-5 text-purple-600"/> Cartão Débito</div></SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <Button 
                size="lg" 
                className="w-full h-20 text-2xl font-bold mt-4 shadow-lg" 
                onClick={finalizarVenda}
                disabled={loading || carrinho.length === 0}
              >
                {loading ? "Processando..." : "FINALIZAR (F2)"}
              </Button>
            </CardContent>
          </Card>
        </div>
      </div>

      {/* MODAL PÓS-VENDA */}
      <Dialog open={modalSucessoAberto} onOpenChange={(open) => {
        if (!open) fecharModalNovaVenda();
      }}>
        <DialogContent className="sm:max-w-md text-center">
          <DialogHeader>
            <DialogTitle className="flex flex-col items-center gap-4 text-2xl">
              <CheckCircle2 className="h-16 w-16 text-green-500" />
              Venda Registrada!
            </DialogTitle>
            <DialogDescription className="text-center text-lg">
              O valor foi lançado no caixa com sucesso.
            </DialogDescription>
          </DialogHeader>
          <div className="py-6 flex justify-center gap-4">
            <Button onClick={handlePrint} size="lg" className="flex-1 h-14 text-lg gap-2" variant="outline">
              <Printer className="h-5 w-5" /> Imprimir Recibo
            </Button>
            <Button onClick={fecharModalNovaVenda} size="lg" className="flex-1 h-14 text-lg">
              Nova Venda
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}