const ADMIN_WHATSAPP = import.meta.env.VITE_ADMIN_WHATSAPP || '5599999999999';

export function montarLinkCobranca(nome: string, valor: number): string {
  const texto = `Olá ${nome}, sua dívida na Senta Pua Guloseimas é de R$ ${valor.toFixed(2)}. Esquadrão Poker.`;
  return `https://wa.me/${ADMIN_WHATSAPP}?text=${encodeURIComponent(texto)}`;
}

export function montarLinkGenerico(numero: string, texto: string): string {
  return `https://wa.me/${numero}?text=${encodeURIComponent(texto)}`;
}
