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

export type Env = {
  DB: D1Database;
  IMAGES: R2Bucket;
  JWT_SECRET: string;
  ADMIN_EMAIL: string;
  ADMIN_SENHA: string;
  FRONTEND_URL: string;
  AMBIENTE: string;
};

export type AppType = { Bindings: Env; Variables: { adminEmail: string } };

const app = new Hono<{ Bindings: Env; Variables: { adminEmail: string } }>();

app.use('*', async (c, next) => {
  const corsMiddleware = cors({
    origin: [c.env.FRONTEND_URL, 'http://localhost:5173'],
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

app.get('/api/health', (c) => c.json({ status: 'ok' }));

export default app;
