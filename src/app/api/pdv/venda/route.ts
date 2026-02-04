// src/app/api/pdv/venda/route.ts
import { NextResponse } from 'next/server';
import { adminAuth, adminDb } from '@/lib/firebase-admin';
import * as admin from 'firebase-admin';

export async function POST(request: Request) {
  try {
    // 1. Segurança: Verificar Token
    const authHeader = request.headers.get('Authorization');
    if (!authHeader?.startsWith('Bearer ')) {
      return NextResponse.json({ error: 'Não autorizado' }, { status: 401 });
    }
    const token = authHeader.split('Bearer ')[1];
    const decodedToken = await adminAuth.verifyIdToken(token);

    // 2. Receber dados da venda
    const { itens, total, formaPagamento, ownerId, operadorNome } = await request.json();

    if (!itens || itens.length === 0) {
      return NextResponse.json({ error: 'Carrinho vazio' }, { status: 400 });
    }

    // 3. Executar Transação (Estoque + Caixa + Histórico)
    const vendaId = await adminDb.runTransaction(async (transaction) => {
      // A) Verificar Estoque de todos os itens
      const updates = [];
      
      for (const item of itens) {
        const produtoRef = adminDb.collection('produtos').doc(item.id);
        const produtoDoc = await transaction.get(produtoRef);

        if (!produtoDoc.exists) {
          throw new Error(`Produto ${item.nome} não encontrado.`);
        }

        const estoqueAtual = produtoDoc.data()?.estoqueAtual || 0;
        if (estoqueAtual < item.qtde) {
          throw new Error(`Estoque insuficiente para ${item.nome}. Restam apenas ${estoqueAtual}.`);
        }

        updates.push({ ref: produtoRef, novoEstoque: estoqueAtual - item.qtde });
      }

      // B) Criar registro da Venda (Histórico)
      const vendaRef = adminDb.collection('vendas').doc();
      transaction.set(vendaRef, {
        data: admin.firestore.FieldValue.serverTimestamp(),
        itens,
        total,
        formaPagamento,
        operadorNome,
        ownerId, // Para filtrar por dono depois
        tipo: "balcao"
      });

      // C) Lançar no Caixa (Movimentações)
      const movRef = adminDb.collection('movimentacoes').doc();
      transaction.set(movRef, {
        data: admin.firestore.FieldValue.serverTimestamp(),
        tipo: 'entrada',
        descricao: `Venda PDV #${vendaRef.id.slice(0, 5).toUpperCase()}`,
        valor: total,
        formaPagamento,
        categoria: 'Venda de Peças',
        ownerId,
        referenciaId: vendaRef.id
      });

      // D) Atualizar Estoques
      for (const update of updates) {
        transaction.update(update.ref, { estoqueAtual: update.novoEstoque });
      }

      return vendaRef.id;
    });

    return NextResponse.json({ success: true, vendaId });

  } catch (error: any) {
    console.error("Erro no PDV:", error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}