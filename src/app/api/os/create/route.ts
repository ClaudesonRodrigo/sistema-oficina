import { NextResponse } from 'next/server';
import { adminDb, adminAuth } from '@/lib/firebase-admin';
import * as admin from 'firebase-admin';

export async function POST(request: Request) {
  try {
    // 1. Segurança: Verificar se o usuário está logado
    const authHeader = request.headers.get('Authorization');
    if (!authHeader?.startsWith('Bearer ')) {
      return NextResponse.json({ error: 'Não autorizado' }, { status: 401 });
    }
    const token = authHeader.split('Bearer ')[1];
    await adminAuth.verifyIdToken(token);

    // 2. Receber dados
    const { novaOS, itens } = await request.json();

    if (!novaOS || !itens) {
      return NextResponse.json({ error: 'Dados inválidos' }, { status: 400 });
    }

    // 3. Executar Transação (Garante que o estoque não fure)
    await adminDb.runTransaction(async (transaction) => {
      // Gera ID da nova OS
      const osRef = adminDb.collection("ordensDeServico").doc();
      
      const produtosParaAtualizar = [];

      // A) Verificar Estoque
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
            throw new Error(`Estoque insuficiente para ${item.nome}. Restam: ${estoqueAtual}`);
          }

          produtosParaAtualizar.push({ ref: produtoRef, novoEstoque });
        }
      }

      // B) Salvar OS (Converte datas strings para Timestamp se necessário)
      const dataAbertura = admin.firestore.FieldValue.serverTimestamp();
      
      transaction.set(osRef, { 
        ...novaOS, 
        dataAbertura, 
        id: osRef.id 
      });

      // C) Atualizar Estoque
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