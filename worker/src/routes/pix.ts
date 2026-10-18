import { Hono } from 'hono';
import type { AppType } from '../index';

const pix = new Hono<AppType>();

// Webhook PIX: NÃO implementado. Responde 501 sem ler nem processar nada (antes respondia ok:true a
// qualquer um). A implementação real precisa, ANTES de tocar em qualquer pedido: validar a
// assinatura/autenticação do provedor (HMAC do corpo bruto com segredo em secret do Worker, ou mTLS),
// rejeitar replays (timestamp/id do evento), conferir valor e txid com o pedido e ser idempotente.
pix.post('/webhook', (c) => {
  return c.json({ error: 'Integração PIX automática não configurada' }, 501);
});

export default pix;
