// src/app/api/os/create/route.ts
import { NextResponse } from 'next/server';
import { adminDb, adminAuth } from '@/lib/firebase-admin';

export async function POST(request: Request) {
  try {
    // 1. Segurança Básica (Verificar se está logado)
    const authHeader = request.headers.get('Authorization');
    if (!authHeader?.startsWith('Bearer ')) {
      return NextResponse.json({ error: 'Não autorizado' }, { status: 401 });
    }
    // Validamos o token para garantir que a requisição vem do app logado
    const token = authHeader.split('Bearer ')[1];
    await adminAuth.verifyIdToken(token);

    // 2. Receber dados
    const { novaOS, itens } = await request.json();

    if (!novaOS || !itens) {
      return NextResponse.json({ error: 'Dados da OS inválidos' }, { status: 400 });
    }

    // 3. Executar Transação (Estoque + OS)
    await adminDb.runTransaction(async (transaction) => {
      // Ajuste de data
      const dataAbertura = new Date(novaOS.dataAbertura);
      const osRef = adminDb.collection("ordensDeServico").doc();
      
      const produtosParaAtualizar = [];

      // A) Leitura (Verificar estoque)
      for (const item of itens) {
        if (item.tipo === "peca") {
          const produtoRef = adminDb.collection("produtos").doc(item.id);
          const produtoDoc = await transaction.get(produtoRef);

          if (!produtoDoc.exists) {
            throw new Error(`Produto ${item.nome} não encontrado.`);
          }

          const estoqueAtual = produtoDoc.data()?.estoqueAtual || 0;
          const novoEstoque = estoqueAtual - item.qtde;

          if (novoEstoque < 0) {
            throw new Error(`Estoque insuficiente para ${item.nome}. Atual: ${estoqueAtual}`);
          }

          produtosParaAtualizar.push({ ref: produtoRef, novoEstoque });
        }
      }

      // B) Escrita (Salvar OS e Atualizar Estoque)
      transaction.set(osRef, { ...novaOS, dataAbertura, id: osRef.id });

      for (const p of produtosParaAtualizar) {
        transaction.update(p.ref, { estoqueAtual: p.novoEstoque });
      }
    });

    return NextResponse.json({ success: true, message: "OS criada com sucesso!" });

  } catch (error: any) {
    console.error("Erro na API create-os:", error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}