// netlify/functions/fixAdminClaim.ts
import { Handler } from "@netlify/functions";
import * as admin from 'firebase-admin';

// FUNÇÃO PARA RODAR UMA SÓ VEZ E CORRIGIR SEU ADMIN

// COLOQUE O E-MAIL DO SEU USUÁRIO ADMIN PRINCIPAL AQUI
const SEU_EMAIL_ADMIN = "claudesonborges@gmail.com";

// --- Configuração do Admin SDK (igual à outra função) ---
if (!admin.apps.length) {
  try {
    admin.initializeApp({
      credential: admin.credential.cert({
        projectId: process.env.FIREBASE_PROJECT_ID,
        clientEmail: process.env.FIREBASE_CLIENT_EMAIL,
        privateKey: process.env.FIREBASE_PRIVATE_KEY!.replace(/\\n/g, '\n'),
      }),
    });
  } catch (e) {
    console.error("Erro ao inicializar Firebase Admin:", e);
  }
}
// --- Fim da Configuração ---

const db = admin.firestore();
const auth = admin.auth();

const handler: Handler = async () => {
  if (!SEU_EMAIL_ADMIN.includes('@')) {
    return {
      statusCode: 500,
      body: JSON.stringify({ error: "ERRO: Você não atualizou a variável SEU_EMAIL_ADMIN no topo do arquivo da função." }),
    };
  }

  try {
    // 1. Encontra o usuário no Firebase Auth pelo e-mail
    console.log(`Buscando usuário: ${SEU_EMAIL_ADMIN}`);
    const user = await auth.getUserByEmail(SEU_EMAIL_ADMIN);

    // 2. Define a "role: admin" na CHAVE DE ACESSO (Custom Claim)
    await auth.setCustomUserClaims(user.uid, { role: 'admin' });
    
    // 3. Garante que no banco de dados também esteja correto
    const userDocRef = db.collection('usuarios').doc(user.uid);
    await userDocRef.set({
      role: 'admin'
    }, { merge: true }); // 'merge: true' para não apagar outros dados

    console.log(`Sucesso! Usuário ${user.email} (UID: ${user.uid}) agora é admin no Token e no Firestore.`);

    return {
      statusCode: 200,
      body: JSON.stringify({ message: `Sucesso! O usuário ${user.email} agora tem a 'role' de admin. Por favor, faça logout e login novamente.` }),
    };

  } catch (error: any) {
    console.error("Erro ao definir claim de admin:", error);
    return {
      statusCode: 500,
      body: JSON.stringify({ error: error.message }),
    };
  }
};

export { handler };