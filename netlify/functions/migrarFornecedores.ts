// netlify/functions/migrarFornecedores.ts
import { Handler, HandlerEvent } from "@netlify/functions";
import * as admin from 'firebase-admin';

let db: admin.firestore.Firestore;
let initializationError: string | null = null;

// --- Configuração do Admin SDK ---
try {
  const projectId = process.env.FIREBASE_PROJECT_ID;
  const clientEmail = process.env.FIREBASE_CLIENT_EMAIL;
  const privateKey = process.env.FIREBASE_PRIVATE_KEY;

  if (!projectId || !clientEmail || !privateKey) {
    throw new Error("Faltam variáveis de ambiente do Firebase.");
  }

  if (!admin.apps.length) {
    admin.initializeApp({
      credential: admin.credential.cert({
        projectId: projectId,
        clientEmail: clientEmail,
        privateKey: privateKey.replace(/\\n/g, '\n'),
      }),
    });
    console.log("Firebase Admin (migrarFornecedores) inicializado.");
  }

  db = admin.firestore();

} catch (e: any) {
  console.error("ERRO CRÍTICO AO INICIALIZAR FIREBASE ADMIN:", e.message);
  initializationError = e.message;
}

const handler: Handler = async (event: HandlerEvent) => {
  if (initializationError || !db) {
    return { statusCode: 500, body: JSON.stringify({ error: initializationError }) };
  }

  if (event.httpMethod !== 'POST') {
    return { statusCode: 405, body: "Method Not Allowed" };
  }

  try {
    const { targetUserId } = JSON.parse(event.body || "{}");

    if (!targetUserId) {
      return { statusCode: 400, body: JSON.stringify({ error: "ID do usuário não fornecido." }) };
    }

    const snapshot = await db.collection("fornecedores").get();
    const batch = db.batch();
    let contador = 0;

    snapshot.forEach((doc) => {
      const data = doc.data();
      if (!data.ownerId) {
        batch.update(doc.ref, { ownerId: targetUserId });
        contador++;
      }
    });

    if (contador > 0) {
      await batch.commit();
    }

    return {
      statusCode: 200,
      body: JSON.stringify({ 
        message: contador > 0 
          ? `Sucesso! ${contador} fornecedores antigos foram recuperados.` 
          : "Nenhum fornecedor precisava de correção."
      }),
    };

  } catch (error: any) {
    console.error("Erro na migração:", error);
    return {
      statusCode: 500,
      body: JSON.stringify({ error: error.message }),
    };
  }
};

export { handler };