// netlify/functions/fixAdminClaim.ts
import { Handler } from "@netlify/functions";
import * as admin from 'firebase-admin';

const SEU_EMAIL_ADMIN = "claudesonborges@gmail.com";

let db: admin.firestore.Firestore;
let auth: admin.auth.Auth;
let initializationError: string | null = null;

// --- Configuração do Admin SDK (Corrigida com .replace()) ---
try {
  const projectId = process.env.FIREBASE_PROJECT_ID;
  const clientEmail = process.env.FIREBASE_CLIENT_EMAIL;
  const privateKey = process.env.FIREBASE_PRIVATE_KEY; // Chave "crua"

  if (!projectId) throw new Error("Variável de ambiente FIREBASE_PROJECT_ID não foi encontrada.");
  if (!clientEmail) throw new Error("Variável de ambiente FIREBASE_CLIENT_EMAIL não foi encontrada.");
  if (!privateKey) throw new Error("Variável de ambiente FIREBASE_PRIVATE_KEY não foi encontrada.");

  if (!admin.apps.length) {
    admin.initializeApp({
      credential: admin.credential.cert({
        projectId: projectId,
        clientEmail: clientEmail,
        // --- ESTA É A CORREÇÃO DA SUA PESQUISA (Seção 1.3) ---
        privateKey: privateKey.replace(/\\n/g, '\n'),
      }),
    });
    console.log("Firebase Admin (fixAdminClaim) inicializado com SUCESSO.");
  }

  db = admin.firestore();
  auth = admin.auth();

} catch (e: any) {
  console.error("ERRO CRÍTICO AO INICIALIZAR FIREBASE ADMIN (fixAdminClaim):", e.message);
  initializationError = e.message;
}
// --- Fim da Configuração ---


const handler: Handler = async () => {
  if (!auth || !db || initializationError) {
     const errorMsg = `ERRO: O Firebase Admin não foi inicializado. Causa: ${initializationError || "Erro desconhecido"}`;
     console.error(errorMsg);
     return {
       statusCode: 500,
       body: JSON.stringify({ error: errorMsg }),
     };
  }
  
  if (!SEU_EMAIL_ADMIN.includes('@')) {
    return {
      statusCode: 500,
      body: JSON.stringify({ error: "ERRO: A variável SEU_EMAIL_ADMIN no topo do arquivo da função está incorreta." }),
    };
  }

  try {
    console.log(`Buscando usuário: ${SEU_EMAIL_ADMIN}`);
    const user = await auth.getUserByEmail(SEU_EMAIL_ADMIN);

    await auth.setCustomUserClaims(user.uid, { role: 'admin' });
    
    const userDocRef = db.collection('usuarios').doc(user.uid);
    await userDocRef.set({ role: 'admin' }, { merge: true });

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