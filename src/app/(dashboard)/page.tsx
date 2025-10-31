// src/app/page.tsx
export default function HomePage() {
  return (
    <div>
      <h1 className="text-4xl font-bold mb-6">Dashboard</h1>
      <p className="text-lg">Bem-vindo ao seu painel de controle, Carioca!</p>
      {/* No futuro, vamos adicionar cards aqui:
          - Total de OS hoje
          - Produtos com estoque baixo
          - Faturamento do dia
      */}
    </div>
  );
}