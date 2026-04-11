export function montarLinkCobranca(nome: string, valor: number, whatsapp?: string): string {
  const texto = `Olá ${nome}, sua dívida na cantina é de *R$ ${valor.toFixed(2)}*.\nFavor regularizar. 1/10 GAV - App RP.`;
  if (whatsapp) return `https://wa.me/${whatsapp}?text=${encodeURIComponent(texto)}`;
  return `https://wa.me/?text=${encodeURIComponent(texto)}`;
}

export function montarLinkGenerico(numero: string, texto: string): string {
  return `https://wa.me/${numero}?text=${encodeURIComponent(texto)}`;
}
