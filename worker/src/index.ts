import { Hono } from 'hono';
import { cors } from 'hono/cors';
import auth from './routes/auth';
import produtos from './routes/produtos';
import clientes from './routes/clientes';
import pedidos from './routes/pedidos';
import pix from './routes/pix';
import dashboard from './routes/dashboard';
import images from './routes/images';
import config from './routes/config';
import loja from './routes/loja';
import cafe from './routes/cafe';
import ximboca from './routes/ximboca';
import usuarios from './routes/usuarios';

export type Env = {
  DB: D1Database;
  IMAGES: R2Bucket;
  JWT_SECRET: string;
  ADMIN_EMAIL: string;
  ADMIN_SENHA: string;
  FRONTEND_URL: string;
  AMBIENTE: string;
};

export type AppType = { Bindings: Env; Variables: { adminEmail: string; userId: number; userEmail: string; userTrigrama: string } };

const app = new Hono<AppType>();

app.use('*', async (c, next) => {
  const corsMiddleware = cors({
    origin: [c.env.FRONTEND_URL, 'https://app-senta-pua.pages.dev', 'http://localhost:5173'],
    allowMethods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
    allowHeaders: ['Content-Type', 'Authorization'],
  });
  return corsMiddleware(c, next);
});

app.route('/api/auth', auth);
app.route('/api/produtos', produtos);
app.route('/api/clientes', clientes);
app.route('/api/pedidos', pedidos);
app.route('/api/pix', pix);
app.route('/api/admin', dashboard);
app.route('/api/images', images);
app.route('/api/config', config);
app.route('/api/loja', loja);
app.route('/api/cafe', cafe);
app.route('/api/ximboca', ximboca);
app.route('/api/usuarios', usuarios);

app.get('/api/health', (c) => c.json({ status: 'ok' }));

export default app;
