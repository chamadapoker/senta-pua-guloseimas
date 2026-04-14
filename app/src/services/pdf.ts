import { jsPDF } from 'jspdf';
import autoTable from 'jspdf-autotable';
import type { Pedido } from '../types';
import { api } from './api';

let _configCache: Record<string, string> | null = null;
async function getConfig(): Promise<Record<string, string>> {
  if (_configCache) return _configCache;
  try {
    _configCache = await api.get<Record<string, string>>('/api/config');
  } catch { _configCache = {}; }
  return _configCache;
}
async function getPixChave(): Promise<string> {
  const c = await getConfig();
  return c.pix_guloseimas_chave || '';
}
async function getCafeNome(tipo: string): Promise<string> {
  const c = await getConfig();
  return tipo === 'oficial' ? (c.nome_cafe_oficiais || 'Sala dos Oficiais') : (c.nome_cafe_graduados || 'Sala do Lange');
}

interface DebitoUnificado {
  guloseimas: { itens: string; valor: number; data: string }[];
  loja: { itens: string; valor: number; data: string; parcelas?: number }[];
  cafe: { referencia: string; valor: number; tipo: string }[];
  ximboca: { evento: string; data: string; valor: number }[];
}

export async function gerarExtratoUnificadoPDF(nome: string, debitos: DebitoUnificado, totalGeral: number, cafeGraduado = false) {
  const doc = new jsPDF();
  const azul: [number, number, number] = [26, 58, 107];
  const vermelho: [number, number, number] = [192, 57, 43];
  const pageWidth = doc.internal.pageSize.getWidth();

  // Header
  doc.setFillColor(...azul);
  doc.rect(0, 0, pageWidth, 38, 'F');
  doc.setFillColor(...vermelho);
  doc.rect(0, 38, pageWidth, 2, 'F');

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(20);
  doc.setTextColor(255, 255, 255);
  doc.text('SENTA PUA', pageWidth / 2, 16, { align: 'center' });

  doc.setFontSize(10);
  doc.setTextColor(212, 168, 67);
  doc.text('1/10 GAV — App RP', pageWidth / 2, 24, { align: 'center' });

  doc.setFontSize(9);
  doc.setTextColor(200, 200, 200);
  doc.text('EXTRATO UNIFICADO DE DEBITOS', pageWidth / 2, 32, { align: 'center' });

  // Dados do militar
  const yStart = 50;
  doc.setFillColor(240, 240, 240);
  doc.roundedRect(14, yStart - 4, pageWidth - 28, 22, 3, 3, 'F');

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(12);
  doc.setTextColor(...azul);
  doc.text(`Militar: ${nome}`, 20, yStart + 4);

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(9);
  doc.setTextColor(100, 100, 100);
  doc.text(`Data de emissao: ${new Date().toLocaleDateString('pt-BR')}`, 20, yStart + 12);

  let currentY = yStart + 28;

  // Guloseimas
  if (debitos.guloseimas.length > 0) {
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(11);
    doc.setTextColor(...azul);
    doc.text('CANTINA', 14, currentY);
    currentY += 2;

    autoTable(doc, {
      startY: currentY,
      head: [['Data', 'Itens', 'Valor']],
      body: debitos.guloseimas.map(d => [d.data, d.itens, `R$ ${d.valor.toFixed(2)}`]),
      theme: 'grid',
      headStyles: { fillColor: azul, textColor: [255, 255, 255], fontSize: 8, halign: 'center' },
      bodyStyles: { fontSize: 8 },
      columnStyles: { 0: { halign: 'center', cellWidth: 25 }, 2: { halign: 'right', cellWidth: 25 } },
      margin: { left: 14, right: 14 },
    });
    currentY = (doc as any).lastAutoTable.finalY + 6;
  }

  // Loja
  if (debitos.loja.length > 0) {
    if (currentY > 250) { doc.addPage(); currentY = 20; }
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(11);
    doc.setTextColor(...azul);
    doc.text('LOJA MILITAR', 14, currentY);
    currentY += 2;

    autoTable(doc, {
      startY: currentY,
      head: [['Data', 'Itens', 'Parcelas', 'Valor']],
      body: debitos.loja.map(d => [d.data, d.itens, d.parcelas && d.parcelas > 1 ? `${d.parcelas}x` : '1x', `R$ ${d.valor.toFixed(2)}`]),
      theme: 'grid',
      headStyles: { fillColor: azul, textColor: [255, 255, 255], fontSize: 8, halign: 'center' },
      bodyStyles: { fontSize: 8 },
      columnStyles: { 0: { halign: 'center', cellWidth: 25 }, 2: { halign: 'center', cellWidth: 20 }, 3: { halign: 'right', cellWidth: 25 } },
      margin: { left: 14, right: 14 },
    });
    currentY = (doc as any).lastAutoTable.finalY + 6;
  }

  // Cafe
  if (debitos.cafe.length > 0) {
    if (currentY > 250) { doc.addPage(); currentY = 20; }
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(11);
    doc.setTextColor(...azul);
    doc.text('CAIXINHA DO CAFE', 14, currentY);
    currentY += 2;

    autoTable(doc, {
      startY: currentY,
      head: [['Referencia', 'Tipo', 'Valor']],
      body: debitos.cafe.map(d => [d.referencia, d.tipo, `R$ ${d.valor.toFixed(2)}`]),
      theme: 'grid',
      headStyles: { fillColor: azul, textColor: [255, 255, 255], fontSize: 8, halign: 'center' },
      bodyStyles: { fontSize: 8 },
      columnStyles: { 0: { halign: 'center' }, 1: { halign: 'center' }, 2: { halign: 'right', cellWidth: 25 } },
      margin: { left: 14, right: 14 },
    });
    currentY = (doc as any).lastAutoTable.finalY + 6;
  }

  // Ximboca
  if (debitos.ximboca.length > 0) {
    if (currentY > 250) { doc.addPage(); currentY = 20; }
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(11);
    doc.setTextColor(...azul);
    doc.text('XIMBOCA', 14, currentY);
    currentY += 2;

    autoTable(doc, {
      startY: currentY,
      head: [['Evento', 'Data', 'Valor']],
      body: debitos.ximboca.map(d => [d.evento, d.data, `R$ ${d.valor.toFixed(2)}`]),
      theme: 'grid',
      headStyles: { fillColor: azul, textColor: [255, 255, 255], fontSize: 8, halign: 'center' },
      bodyStyles: { fontSize: 8 },
      columnStyles: { 1: { halign: 'center', cellWidth: 25 }, 2: { halign: 'right', cellWidth: 25 } },
      margin: { left: 14, right: 14 },
    });
    currentY = (doc as any).lastAutoTable.finalY + 6;
  }

  // Total geral
  if (currentY > 260) { doc.addPage(); currentY = 20; }
  doc.setFillColor(...vermelho);
  doc.roundedRect(14, currentY + 2, pageWidth - 28, 20, 3, 3, 'F');
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(14);
  doc.setTextColor(255, 255, 255);
  doc.text(`TOTAL GERAL PENDENTE: R$ ${totalGeral.toFixed(2)}`, pageWidth / 2, currentY + 15, { align: 'center' });

  // Rodape
  const footerY = currentY + 34;
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(8);
  doc.setTextColor(150, 150, 150);
  doc.text('Documento gerado automaticamente pelo sistema Senta Pua.', pageWidth / 2, footerY, { align: 'center' });
  const pixChaveDoc = await getPixChave();
  doc.text(`PIX: ${pixChaveDoc}`, pageWidth / 2, footerY + 5, { align: 'center' });

  doc.save(`extrato-unificado-${nome.toLowerCase().replace(/\s+/g, '-')}.pdf`);
}

export async function gerarExtratoPDF(nome: string, pedidos: Pedido[], total: number) {
  const doc = new jsPDF();
  const azul: [number, number, number] = [26, 58, 107];
  const vermelho: [number, number, number] = [192, 57, 43];
  const pageWidth = doc.internal.pageSize.getWidth();

  // ===== HEADER =====
  // Barra azul topo
  doc.setFillColor(...azul);
  doc.rect(0, 0, pageWidth, 38, 'F');

  // Linha vermelha
  doc.setFillColor(...vermelho);
  doc.rect(0, 38, pageWidth, 2, 'F');

  // Título no header
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(20);
  doc.setTextColor(255, 255, 255);
  doc.text('SENTA PUA', pageWidth / 2, 16, { align: 'center' });

  doc.setFontSize(10);
  doc.setTextColor(212, 168, 67); // dourado
  doc.text('1/10 GAV — App RP', pageWidth / 2, 24, { align: 'center' });

  doc.setFontSize(9);
  doc.setTextColor(200, 200, 200);
  doc.text('EXTRATO DE DÉBITOS', pageWidth / 2, 32, { align: 'center' });

  // ===== DADOS DO CLIENTE =====
  const yStart = 50;

  doc.setFillColor(240, 240, 240);
  doc.roundedRect(14, yStart - 4, pageWidth - 28, 22, 3, 3, 'F');

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(12);
  doc.setTextColor(26, 58, 107);
  doc.text(`Militar: ${nome}`, 20, yStart + 4);

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(9);
  doc.setTextColor(100, 100, 100);
  doc.text(`Data de emissão: ${new Date().toLocaleDateString('pt-BR')}`, 20, yStart + 12);

  // ===== TABELA DE PEDIDOS =====
  const tableData = pedidos.map((p) => {
    const dt = new Date(p.created_at + 'Z');
    const data = dt.toLocaleDateString('pt-BR', { timeZone: 'America/Sao_Paulo' });
    const hora = dt.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit', timeZone: 'America/Sao_Paulo' });
    return [
      `${data}\n${hora}`,
      p.itens_resumo || '-',
      `R$ ${p.total.toFixed(2)}`,
      p.status.toUpperCase(),
    ];
  });

  autoTable(doc, {
    startY: yStart + 26,
    head: [['Data / Hora', 'Itens', 'Valor', 'Status']],
    body: tableData,
    theme: 'grid',
    headStyles: {
      fillColor: azul,
      textColor: [255, 255, 255],
      fontStyle: 'bold',
      fontSize: 9,
      halign: 'center',
    },
    bodyStyles: {
      fontSize: 8,
      textColor: [50, 50, 50],
    },
    alternateRowStyles: {
      fillColor: [248, 248, 248],
    },
    columnStyles: {
      0: { halign: 'center', cellWidth: 30 },
      1: { cellWidth: 'auto' },
      2: { halign: 'right', cellWidth: 28 },
      3: { halign: 'center', cellWidth: 25 },
    },
    margin: { left: 14, right: 14 },
  });

  // ===== TOTAL =====
  const finalY = (doc as unknown as { lastAutoTable: { finalY: number } }).lastAutoTable.finalY + 8;

  doc.setFillColor(...vermelho);
  doc.roundedRect(14, finalY, pageWidth - 28, 18, 3, 3, 'F');

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(13);
  doc.setTextColor(255, 255, 255);
  doc.text(`TOTAL PENDENTE: R$ ${total.toFixed(2)}`, pageWidth / 2, finalY + 12, { align: 'center' });

  // ===== RODAPÉ =====
  const footerY = finalY + 32;
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(8);
  doc.setTextColor(150, 150, 150);
  doc.text('Documento gerado automaticamente pelo sistema Senta Pua.', pageWidth / 2, footerY, { align: 'center' });
  const pixChaveExtrato = await getPixChave();
  doc.text(`Chave PIX: ${pixChaveExtrato}`, pageWidth / 2, footerY + 5, { align: 'center' });

  // ===== DOWNLOAD =====
  doc.save(`extrato-${nome.toLowerCase().replace(/\s+/g, '-')}.pdf`);
}

export async function gerarCobrancaCafePDF(nome: string, tipo: string, mesesPendentes: { referencia: string; valor: number }[], totalDevido: number, pixChave: string) {
  const doc = new jsPDF();
  const azul: [number, number, number] = [26, 58, 107];
  const vermelho: [number, number, number] = [192, 57, 43];
  const amber: [number, number, number] = [180, 120, 30];
  const pageWidth = doc.internal.pageSize.getWidth();

  // Header
  doc.setFillColor(...azul);
  doc.rect(0, 0, pageWidth, 38, 'F');
  doc.setFillColor(...vermelho);
  doc.rect(0, 38, pageWidth, 2, 'F');

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(20);
  doc.setTextColor(255, 255, 255);
  doc.text('CAIXINHA DO CAFE', pageWidth / 2, 16, { align: 'center' });

  doc.setFontSize(10);
  doc.setTextColor(...amber);
  const nomeSalaCafe = await getCafeNome(tipo);
  doc.text(`1/10 GAV — ${nomeSalaCafe}`, pageWidth / 2, 24, { align: 'center' });

  doc.setFontSize(9);
  doc.setTextColor(200, 200, 200);
  doc.text('COBRANCA DE MENSALIDADE', pageWidth / 2, 32, { align: 'center' });

  // Dados
  const yStart = 50;
  doc.setFillColor(240, 240, 240);
  doc.roundedRect(14, yStart - 4, pageWidth - 28, 22, 3, 3, 'F');

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(12);
  doc.setTextColor(26, 58, 107);
  doc.text(`Militar: ${nome}`, 20, yStart + 4);

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(9);
  doc.setTextColor(100, 100, 100);
  doc.text(`Data de emissao: ${new Date().toLocaleDateString('pt-BR')}`, 20, yStart + 12);

  // Tabela
  const tableData = mesesPendentes.map(m => [m.referencia, `R$ ${m.valor.toFixed(2)}`, 'PENDENTE']);

  autoTable(doc, {
    startY: yStart + 26,
    head: [['Referencia', 'Valor', 'Status']],
    body: tableData,
    theme: 'grid',
    headStyles: { fillColor: azul, textColor: [255, 255, 255], fontStyle: 'bold', fontSize: 9, halign: 'center' },
    bodyStyles: { fontSize: 9, textColor: [50, 50, 50] },
    alternateRowStyles: { fillColor: [248, 248, 248] },
    columnStyles: { 0: { halign: 'center' }, 1: { halign: 'right' }, 2: { halign: 'center' } },
    margin: { left: 14, right: 14 },
  });

  // Total
  const finalY = (doc as unknown as { lastAutoTable: { finalY: number } }).lastAutoTable.finalY + 8;
  doc.setFillColor(...vermelho);
  doc.roundedRect(14, finalY, pageWidth - 28, 18, 3, 3, 'F');
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(13);
  doc.setTextColor(255, 255, 255);
  doc.text(`TOTAL PENDENTE: R$ ${totalDevido.toFixed(2)}`, pageWidth / 2, finalY + 12, { align: 'center' });

  // Rodape
  const footerY = finalY + 32;
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(8);
  doc.setTextColor(150, 150, 150);
  doc.text('Documento gerado automaticamente pelo sistema Caixinha do Cafe.', pageWidth / 2, footerY, { align: 'center' });
  doc.text(`Chave PIX: ${pixChave}`, pageWidth / 2, footerY + 5, { align: 'center' });

  doc.save(`cafe-cobranca-${nome.toLowerCase().replace(/\s+/g, '-')}.pdf`);
}

export async function gerarCobrancaXimbocaPDF(nomeEvento: string, dataEvento: string, participante: string, valor: number) {
  const doc = new jsPDF();
  const azul: [number, number, number] = [26, 58, 107];
  const vermelho: [number, number, number] = [192, 57, 43];
  const pageWidth = doc.internal.pageSize.getWidth();

  // Header
  doc.setFillColor(...azul);
  doc.rect(0, 0, pageWidth, 38, 'F');
  doc.setFillColor(...vermelho);
  doc.rect(0, 38, pageWidth, 2, 'F');

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(20);
  doc.setTextColor(255, 255, 255);
  doc.text('XIMBOCA', pageWidth / 2, 16, { align: 'center' });

  doc.setFontSize(10);
  doc.setTextColor(212, 168, 67);
  doc.text('1/10 GAV — App RP', pageWidth / 2, 24, { align: 'center' });

  doc.setFontSize(9);
  doc.setTextColor(200, 200, 200);
  doc.text('COBRANCA DE PARTICIPACAO', pageWidth / 2, 32, { align: 'center' });

  // Dados
  const yStart = 50;
  doc.setFillColor(240, 240, 240);
  doc.roundedRect(14, yStart - 4, pageWidth - 28, 34, 3, 3, 'F');

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(12);
  doc.setTextColor(26, 58, 107);
  doc.text(`Evento: ${nomeEvento}`, 20, yStart + 4);

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(10);
  doc.setTextColor(80, 80, 80);
  doc.text(`Data: ${dataEvento}`, 20, yStart + 13);
  doc.text(`Participante: ${participante}`, 20, yStart + 22);

  // Valor
  const valY = yStart + 44;
  doc.setFillColor(...vermelho);
  doc.roundedRect(14, valY, pageWidth - 28, 22, 3, 3, 'F');
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(16);
  doc.setTextColor(255, 255, 255);
  doc.text(`VALOR: R$ ${valor.toFixed(2)}`, pageWidth / 2, valY + 14, { align: 'center' });

  // Rodape
  const footerY = valY + 36;
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(8);
  doc.setTextColor(150, 150, 150);
  doc.text('Documento gerado automaticamente pelo sistema Ximboca.', pageWidth / 2, footerY, { align: 'center' });
  const pixChaveXimboca = await getPixChave();
  doc.text(`Chave PIX: ${pixChaveXimboca}`, pageWidth / 2, footerY + 5, { align: 'center' });

  doc.save(`ximboca-cobranca-${participante.toLowerCase().replace(/\s+/g, '-')}.pdf`);
}
