import { Hono } from 'hono';
import { sign } from '../lib/jwt';
import { authMiddleware } from '../middleware/auth';
import type { AppType } from '../index';

const auth = new Hono<AppType>();

auth.post('/login', async (c) => {
  const { email, senha } = await c.req.json<{ email: string; senha: string }>();

  if (!email || !senha) {
    return c.json({ error: 'Email e senha obrigatórios' }, 400);
  }

  if (email !== c.env.ADMIN_EMAIL || senha !== c.env.ADMIN_SENHA) {
    return c.json({ error: 'Credenciais inválidas' }, 401);
  }

  const token = await sign({ email }, c.env.JWT_SECRET);
  return c.json({ token });
});

auth.get('/me', authMiddleware, async (c) => {
  const email = c.get('adminEmail');
  return c.json({ email });
});

export default auth;
