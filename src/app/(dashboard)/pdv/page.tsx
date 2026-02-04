// src/app/(dashboard)/pdv/page.tsx
"use client";

import { useState, useEffect, useRef } from "react";
import { collection, onSnapshot, query, where } from "firebase/firestore";
import { db, auth } from "@/lib/firebase";
import { useAuth } from "@/context/AuthContext";
import { Search, ShoppingCart, Trash2, CreditCard, Banknote, QrCode } from "lucide-react";

// UI Components
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

interface Produto {
  id: string;
  nome: string;
  codigoSku?: string;
  precoVenda: number;
  estoqueAtual: number;
}

interface ItemCarrinho extends Produto {
  qtde: number;
}

export default function PdvPage() {
  const { userData } = useAuth();
  
  // Estados
  const [produtos, setProdutos] = useState<Produto[]>([]);
  const [busca, setBusca] = useState("");
  const [carrinho, setCarrinho] = useState<ItemCarrinho[]>([]);
  const [formaPagamento, setFormaPagamento] = useState("dinheiro");
  const [loading, setLoading] = useState(false);

  // Referência para focar no input após adicionar
  const inputBuscaRef = useRef<HTMLInputElement>(null);

  // 1. Carregar Produtos (Em tempo real para pegar estoque atualizado)
  useEffect(() => {
    if (!userData) return;
    
    // Se for admin vê tudo, se não, vê só os do dono
    const q = userData.role === 'admin' 
      ? query(collection(db, "produtos"))
      : query(collection(db, "produtos")); // Ajuste aqui se tiver ownerId nos produtos

    const unsub = onSnapshot(q, (snapshot) => {
      setProdutos(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Produto)));
    });
    return () => unsub();
  }, [userData]);

  // 2. Filtro de Produtos (Por Nome ou Código)
  const produtosFiltrados = produtos.filter(p => {
    if (!busca) return false;
    const termo = busca.toLowerCase();
    const matchNome = p.nome.toLowerCase().includes(termo);
    const matchSku = p.codigoSku?.toLowerCase().includes(termo);
    return matchNome || matchSku;
  }).slice(0, 5); // Mostra só os 5 primeiros para não poluir

  // 3. Adicionar ao Carrinho
  const adicionarAoCarrinho = (produto: Produto) => {
    // Verificar estoque
    const itemNoCarrinho = carrinho.find(i => i.id === produto.id);
    const qtdeAtual = itemNoCarrinho ? itemNoCarrinho.qtde : 0;

    if (qtdeAtual + 1 > produto.estoqueAtual) {
      alert("Estoque insuficiente!");
      return;
    }

    if (itemNoCarrinho) {
      setCarrinho(carrinho.map(i => i.id === produto.id ? { ...i, qtde: i.qtde + 1 } : i));
    } else {
      setCarrinho([...carrinho, { ...produto, qtde: 1 }]);
    }
    
    setBusca(""); // Limpa busca
    inputBuscaRef.current?.focus(); // Devolve foco para continuar bipando
  };

  // 4. Remover do Carrinho
  const removerItem = (id: string) => {
    setCarrinho(carrinho.filter(i => i.id !== id));
  };

  // 5. Calcular Total
  const total = carrinho.reduce((acc, item) => acc + (item.precoVenda * item.qtde), 0);

  // 6. Finalizar Venda (Chama a API)
  const finalizarVenda = async () => {
    if (carrinho.length === 0) return alert("Carrinho vazio!");
    if (!confirm(`Confirmar venda de R$ ${total.toFixed(2)}?`)) return;

    setLoading(true);
    try {
      const token = await auth.currentUser?.getIdToken();
      
      const response = await fetch('/api/pdv/venda', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({
          itens: carrinho,
          total,
          formaPagamento,
          ownerId: userData?.id,
          operadorNome: userData?.nome
        })
      });

      const data = await response.json();

      if (!response.ok) throw new Error(data.error);

      alert("Venda realizada com sucesso! ✅");
      setCarrinho([]); // Limpa carrinho
      setBusca("");
    } catch (error: any) {
      alert("Erro ao processar venda: " + error.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="flex flex-col h-[calc(100vh-100px)] gap-4">
      <h1 className="text-3xl font-bold flex items-center gap-2">
        <ShoppingCart className="h-8 w-8" /> PDV - Venda Rápida
      </h1>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6 h-full">
        
        {/* LADO ESQUERDO: Busca e Lista de Produtos */}
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
                  // Dica: Se der ENTER e tiver só 1 produto, adiciona direto (Lógica de Scanner)
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' && produtosFiltrados.length === 1) {
                      adicionarAoCarrinho(produtosFiltrados[0]);
                    }
                  }}
                />
              </div>
              
              {/* Sugestões de Busca */}
              {busca && (
                <div className="mt-2 border rounded-md shadow-lg bg-white absolute w-full z-10 left-0">
                  {produtosFiltrados.map(p => (
                    <div 
                      key={p.id} 
                      className="p-3 hover:bg-gray-100 cursor-pointer border-b flex justify-between"
                      onClick={() => adicionarAoCarrinho(p)}
                    >
                      <span className="font-bold">{p.nome}</span>
                      <div className="flex gap-4">
                        <span className="text-gray-500 text-sm">Est: {p.estoqueAtual}</span>
                        <span className="text-green-600 font-bold">R$ {p.precoVenda.toFixed(2)}</span>
                      </div>
                    </div>
                  ))}
                  {produtosFiltrados.length === 0 && <div className="p-4 text-center text-gray-500">Nenhum produto encontrado</div>}
                </div>
              )}
            </CardContent>
          </Card>

          {/* Tabela do Carrinho */}
          <Card className="flex-1 overflow-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Produto</TableHead>
                  <TableHead className="w-[100px]">Qtd</TableHead>
                  <TableHead className="text-right">Total</TableHead>
                  <TableHead className="w-[50px]"></TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {carrinho.map((item) => (
                  <TableRow key={item.id}>
                    <TableCell>
                      <div className="font-medium">{item.nome}</div>
                      <div className="text-xs text-gray-500">Unit: R$ {item.precoVenda.toFixed(2)}</div>
                    </TableCell>
                    <TableCell>
                      <Input 
                        type="number" 
                        className="h-8 w-20" 
                        value={item.qtde}
                        onChange={(e) => {
                          const novaQtde = parseInt(e.target.value);
                          if (novaQtde > 0 && novaQtde <= item.estoqueAtual) {
                            setCarrinho(carrinho.map(i => i.id === item.id ? { ...i, qtde: novaQtde } : i));
                          }
                        }} 
                      />
                    </TableCell>
                    <TableCell className="text-right font-bold">
                      R$ {(item.precoVenda * item.qtde).toFixed(2)}
                    </TableCell>
                    <TableCell>
                      <Button variant="ghost" size="icon" onClick={() => removerItem(item.id)}>
                        <Trash2 className="h-4 w-4 text-red-500" />
                      </Button>
                    </TableCell>
                  </TableRow>
                ))}
                {carrinho.length === 0 && (
                  <TableRow>
                    <TableCell colSpan={4} className="text-center h-40 text-gray-400">
                      Carrinho vazio. Bipe um produto para começar.
                    </TableCell>
                  </TableRow>
                )}
              </TableBody>
            </Table>
          </Card>
        </div>

        {/* LADO DIREITO: Resumo e Pagamento */}
        <div className="flex flex-col gap-4">
          <Card className="bg-slate-50 border-2">
            <CardHeader>
              <CardTitle>Resumo da Venda</CardTitle>
            </CardHeader>
            <CardContent className="space-y-6">
              <div className="flex justify-between items-center text-lg">
                <span>Itens:</span>
                <span>{carrinho.reduce((acc, i) => acc + i.qtde, 0)}</span>
              </div>
              <div className="flex justify-between items-center text-4xl font-bold text-green-600">
                <span>Total:</span>
                <span>R$ {total.toFixed(2)}</span>
              </div>

              <div className="space-y-2">
                <label className="text-sm font-medium">Forma de Pagamento</label>
                <Select value={formaPagamento} onValueChange={setFormaPagamento}>
                  <SelectTrigger className="h-12 text-lg">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="dinheiro"><div className="flex items-center gap-2"><Banknote className="h-4 w-4"/> Dinheiro</div></SelectItem>
                    <SelectItem value="pix"><div className="flex items-center gap-2"><QrCode className="h-4 w-4"/> PIX</div></SelectItem>
                    <SelectItem value="credito"><div className="flex items-center gap-2"><CreditCard className="h-4 w-4"/> Cartão Crédito</div></SelectItem>
                    <SelectItem value="debito"><div className="flex items-center gap-2"><CreditCard className="h-4 w-4"/> Cartão Débito</div></SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <Button 
                size="lg" 
                className="w-full h-16 text-xl font-bold mt-4" 
                onClick={finalizarVenda}
                disabled={loading || carrinho.length === 0}
              >
                {loading ? "Processando..." : "FINALIZAR VENDA (F2)"}
              </Button>
            </CardContent>
          </Card>
        </div>

      </div>
    </div>
  );
}