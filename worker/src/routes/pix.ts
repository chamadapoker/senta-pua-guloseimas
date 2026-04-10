import { Hono } from 'hono';
import type { AppType } from '../index';

const pix = new Hono<AppType>();

// Placeholder para webhook PIX futuro
pix.post('/webhook', async (c) => {
  // TODO: Implementar quando definir provedor PIX
  return c.json({ ok: true });
});

export default pix;
