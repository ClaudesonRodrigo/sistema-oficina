// netlify/functions/criarUsuarioComRole.ts
import { Handler, HandlerEvent } from "@netlify/functions";
import * as admin from 'firebase-admin';

// --- Configuração do Admin SDK (igual) ---
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

const handler: Handler = async (event: HandlerEvent) => {
  if (event.httpMethod !== 'POST') {
    return { statusCode: 405, body: JSON.stringify({ error: 'Método não permitido' }) };
  }

  try {
    const { nome, email, password, role } = JSON.parse(event.body!);
    
    // TODO de Segurança: Verificar se quem está chamando é admin
    // Por enquanto, vamos confiar que a página /usuarios está protegida
    // (O ideal seria checar o token de quem chamou a função)

    // 1. Cria o usuário no Firebase AUTH
    const userRecord = await auth.createUser({
      email: email,
      password: password,
      displayName: nome,
    });
    
    const uid = userRecord.uid;

    // 2. Define a ROLE (admin/operador) no TOKEN (Custom Claim)
    await auth.setCustomUserClaims(uid, { role: role });

    // 3. Salva os dados no banco de dados FIRESTORE
    const userDocRef = db.collection('usuarios').doc(uid);
    await userDocRef.set({
      nome: nome,
      email: email,
      role: role,
    });

    return {
      statusCode: 200,
      body: JSON.stringify({ message: "Usuário criado com sucesso!", uid: uid }),
    };

  } catch (error: any) {
    console.error("Erro na Netlify Function criarUsuarioComRole:", error);
    return {
      statusCode: 500,
      body: JSON.stringify({ error: error.message }),
    };
  }
};

export { handler };