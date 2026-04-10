import type { Pedido } from '../types';

export async function gerarExtratoPDF(nome: string, pedidos: Pedido[], total: number) {
  const linhas = pedidos.map((p) =>
    `${new Date(p.created_at).toLocaleDateString('pt-BR')} | ${p.itens_resumo || '-'} | R$ ${p.total.toFixed(2)} | ${p.status}`
  ).join('\n');

  const conteudo = `
SENTA PUA GULOSEIMAS — ESQUADRÃO POKER
========================================
Extrato de Débitos
Cliente: ${nome}
Data: ${new Date().toLocaleDateString('pt-BR')}
========================================

Data       | Itens                | Valor     | Status
-------------------------------------------------------
${linhas}

========================================
TOTAL PENDENTE: R$ ${total.toFixed(2)}
========================================
  `.trim();

  const blob = new Blob([conteudo], { type: 'text/plain;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `extrato-${nome.toLowerCase().replace(/\s+/g, '-')}.txt`;
  a.click();
  URL.revokeObjectURL(url);
}
