import { Hono } from 'hono';
import { authMiddleware } from '../middleware/auth';
import type { AppType } from '../index';

const images = new Hono<AppType>();

// Admin: upload de imagem
images.post('/upload', authMiddleware, async (c) => {
  const formData = await c.req.formData();
  const file = formData.get('file') as File | null;

  if (!file) {
    return c.json({ error: 'Nenhum arquivo enviado' }, 400);
  }

  const ext = file.name.split('.').pop()?.toLowerCase() || 'jpg';
  const allowed = ['jpg', 'jpeg', 'png', 'webp', 'gif'];
  if (!allowed.includes(ext)) {
    return c.json({ error: 'Formato não suportado. Use: jpg, png, webp, gif' }, 400);
  }

  const key = `produtos/${crypto.randomUUID()}.${ext}`;
  await c.env.IMAGES.put(key, file.stream(), {
    httpMetadata: { contentType: file.type },
  });

  const url = `/api/images/${key}`;
  return c.json({ url, key });
});

// Público: servir imagem
images.get('/:prefix/:filename', async (c) => {
  const prefix = c.req.param('prefix');
  const filename = c.req.param('filename');
  const key = `${prefix}/${filename}`;

  const object = await c.env.IMAGES.get(key);
  if (!object) return c.notFound();

  const headers = new Headers();
  headers.set('Content-Type', object.httpMetadata?.contentType || 'image/jpeg');
  headers.set('Cache-Control', 'public, max-age=31536000, immutable');

  return new Response(object.body, { headers });
});

// Admin: deletar imagem
images.delete('/:prefix/:filename', authMiddleware, async (c) => {
  const prefix = c.req.param('prefix');
  const filename = c.req.param('filename');
  const key = `${prefix}/${filename}`;

  await c.env.IMAGES.delete(key);
  return c.json({ ok: true });
});

export default images;
