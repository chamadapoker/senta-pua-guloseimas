import { Hono } from 'hono';
import { authMiddleware } from '../middleware/auth';
import { validarArquivo, detectarTipo, contentTypeDe, TIPOS_IMAGEM, CONTENT_TYPES_IMAGEM } from '../lib/arquivo';
import type { AppType } from '../index';

const images = new Hono<AppType>();

// Prefixos privados: nunca servidos por esta rota pública (comprovante = dado financeiro/pessoal;
// é servido só por GET /api/comprovantes/:id/imagem, com login)
const PREFIXOS_PRIVADOS = new Set(['comprovantes']);

// Admin: upload de imagem
images.post('/upload', authMiddleware, async (c) => {
  const formData = await c.req.formData();
  const v = await validarArquivo(formData.get('file'), TIPOS_IMAGEM);
  if (!v.ok) return c.json({ error: v.erro }, 400);

  const key = `produtos/${crypto.randomUUID()}.${v.arquivo.ext}`;
  await c.env.IMAGES.put(key, v.arquivo.bytes, {
    httpMetadata: { contentType: v.arquivo.contentType },
  });

  const url = `/api/images/${key}`;
  return c.json({ url, key });
});

// Público: servir imagem (suporta paths aninhados ex: usuarios/1/foto.jpg)
images.get('/:prefix/:rest{.+}', async (c) => {
  const prefix = c.req.param('prefix');
  const rest = c.req.param('rest');
  if (PREFIXOS_PRIVADOS.has(prefix.toLowerCase())) return c.json({ error: 'Não encontrado' }, 404);
  const key = `${prefix}/${rest}`;

  const object = await c.env.IMAGES.get(key);
  if (!object) return c.json({ error: 'Não encontrado' }, 404);

  // Só serve imagem. Uploads novos gravam o tipo derivado do conteúdo; para objetos antigos (tipo
  // vindo do cliente, possivelmente vazio/errado) confere a assinatura dos primeiros bytes.
  // Qualquer coisa que não seja imagem => 404.
  let contentType = (object.httpMetadata?.contentType || '').toLowerCase();
  if (!CONTENT_TYPES_IMAGEM.has(contentType)) {
    await object.body?.cancel();
    const inicio = await c.env.IMAGES.get(key, { range: { offset: 0, length: 16 } });
    const tipo = inicio ? detectarTipo(new Uint8Array(await inicio.arrayBuffer())) : null;
    if (!tipo || !TIPOS_IMAGEM.includes(tipo)) return c.json({ error: 'Não encontrado' }, 404);
    contentType = contentTypeDe(tipo);
    const completo = await c.env.IMAGES.get(key);
    if (!completo) return c.json({ error: 'Não encontrado' }, 404);
    return servir(completo.body, contentType);
  }
  return servir(object.body, contentType);
});

function servir(body: ReadableStream, contentType: string): Response {
  const headers = new Headers();
  headers.set('Content-Type', contentType);
  headers.set('Cache-Control', 'public, max-age=31536000, immutable');
  headers.set('X-Content-Type-Options', 'nosniff');
  return new Response(body, { headers });
}

// Admin: deletar imagem
images.delete('/:prefix/:rest{.+}', authMiddleware, async (c) => {
  const prefix = c.req.param('prefix');
  const rest = c.req.param('rest');
  const key = `${prefix}/${rest}`;

  await c.env.IMAGES.delete(key);
  return c.json({ ok: true });
});

export default images;
