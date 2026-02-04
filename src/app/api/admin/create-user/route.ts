// src/app/api/admin/create-user/route.ts
import { NextResponse } from 'next/server';
import { adminAuth, adminDb } from '@/lib/firebase-admin';

export async function POST(request: Request) {
  try {
    // 1. Segurança: Verificar Token do Admin
    const authHeader = request.headers.get('Authorization');
    if (!authHeader?.startsWith('Bearer ')) {
      return NextResponse.json({ error: 'Token não fornecido' }, { status: 401 });
    }

    const token = authHeader.split('Bearer ')[1];
    const decodedToken = await adminAuth.verifyIdToken(token);

    if (decodedToken.role !== 'admin') {
      return NextResponse.json({ error: 'Apenas administradores podem criar usuários.' }, { status: 403 });
    }

    // 2. Pegar dados
    const { nome, email, password, role } = await request.json();

    if (!email || !password || !role) {
      return NextResponse.json({ error: 'Dados incompletos' }, { status: 400 });
    }

    // 3. Criar no Auth
    const userRecord = await adminAuth.createUser({
      email,
      password,
      displayName: nome,
    });

    // 4. Definir Role (Custom Claims)
    await adminAuth.setCustomUserClaims(userRecord.uid, { role });

    // 5. Salvar no Firestore
    await adminDb.collection('usuarios').doc(userRecord.uid).set({
      nome,
      email,
      role,
      uid: userRecord.uid,
      createdAt: new Date().toISOString()
    });

    return NextResponse.json({ 
      success: true, 
      message: "Usuário criado com sucesso!", 
      uid: userRecord.uid 
    });

  } catch (error: any) {
    console.error("Erro na API create-user:", error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}