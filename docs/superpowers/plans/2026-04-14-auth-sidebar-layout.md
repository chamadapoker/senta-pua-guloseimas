# Auth + Sidebar + Layout Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add user authentication (email+password), replace tab-based navigation with a collapsible sidebar, and unify the app layout for all user types (visitor, user, admin).

**Architecture:** New `usuarios` table in D1 with PBKDF2 password hashing. Unified `AppLayout` component with collapsible sidebar that shows different menu items based on auth state. Separate Zustand store for user auth (`useUserAuth`) alongside existing admin auth (`useAuth`). Checkout requires user login.

**Tech Stack:** React 19, TypeScript, Hono (Cloudflare Workers), Cloudflare D1, Cloudflare R2, Zustand, TailwindCSS, Web Crypto API (PBKDF2)

---

## File Structure

### New Files (Worker)
- `worker/src/db/migrations/011_usuarios.sql` — migration to create `usuarios` table
- `worker/src/routes/usuarios.ts` — user auth endpoints (cadastro, login, me, foto, admin management)
- `worker/src/lib/password.ts` — PBKDF2 hash/verify functions
- `worker/src/middleware/userAuth.ts` — middleware for user-authenticated routes

### New Files (App)
- `app/src/hooks/useUserAuth.ts` — Zustand store for user authentication
- `app/src/components/Sidebar.tsx` — collapsible sidebar component
- `app/src/components/AppLayout.tsx` — unified layout (header + sidebar + content)
- `app/src/pages/UserLogin.tsx` — user login page
- `app/src/pages/UserCadastro.tsx` — user registration page
- `app/src/pages/Perfil.tsx` — user profile page

### Modified Files (Worker)
- `worker/src/index.ts` — mount `/api/usuarios` route, update AppType with user variables
- `worker/src/middleware/auth.ts` — recognize both admin and user tokens
- `worker/src/routes/pedidos.ts` — accept user token for checkout, auto-fill trigrama
- `worker/src/routes/images.ts` — add user foto upload endpoint

### Modified Files (App)
- `app/src/App.tsx` — new routes, replace AdminGuard, add UserGuard
- `app/src/components/Layout.tsx` — remove (replaced by AppLayout + Sidebar)
- `app/src/pages/Checkout.tsx` — require user login, auto-fill from user data
- `app/src/pages/Home.tsx` — use AppLayout instead of PublicLayout
- `app/src/pages/admin/Login.tsx` — use AppLayout
- `app/src/services/api.ts` — support dual tokens (admin + user)
- `app/src/types/index.ts` — add Usuario type
- All pages that import PublicLayout or AdminLayout — switch to AppLayout

---

## Task 1: Password Hashing Library

**Files:**
- Create: `worker/src/lib/password.ts`

- [ ] **Step 1: Create password.ts with PBKDF2 hash and verify**

```typescript
// worker/src/lib/password.ts
const encoder = new TextEncoder();

export async function hashPassword(password: string): Promise<string> {
  const salt = crypto.getRandomValues(new Uint8Array(16));
  const keyMaterial = await crypto.subtle.importKey(
    'raw', encoder.encode(password), 'PBKDF2', false, ['deriveBits']
  );
  const hash = await crypto.subtle.deriveBits(
    { name: 'PBKDF2', salt, iterations: 100000, hash: 'SHA-256' },
    keyMaterial, 256
  );
  const saltHex = [...salt].map(b => b.toString(16).padStart(2, '0')).join('');
  const hashHex = [...new Uint8Array(hash)].map(b => b.toString(16).padStart(2, '0')).join('');
  return `${saltHex}:${hashHex}`;
}

export async function verifyPassword(password: string, stored: string): Promise<boolean> {
  const [saltHex, hashHex] = stored.split(':');
  const salt = new Uint8Array(saltHex.match(/.{2}/g)!.map(h => parseInt(h, 16)));
  const keyMaterial = await crypto.subtle.importKey(
    'raw', encoder.encode(password), 'PBKDF2', false, ['deriveBits']
  );
  const hash = await crypto.subtle.deriveBits(
    { name: 'PBKDF2', salt, iterations: 100000, hash: 'SHA-256' },
    keyMaterial, 256
  );
  const computedHex = [...new Uint8Array(hash)].map(b => b.toString(16).padStart(2, '0')).join('');
  return computedHex === hashHex;
}
```

- [ ] **Step 2: Commit**

```bash
git add worker/src/lib/password.ts
git commit -m "feat: add PBKDF2 password hashing library"
```

---

## Task 2: Database Migration

**Files:**
- Create: `worker/src/db/migrations/011_usuarios.sql`

- [ ] **Step 1: Create migration file**

```sql
-- worker/src/db/migrations/011_usuarios.sql
CREATE TABLE IF NOT EXISTS usuarios (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  email TEXT NOT NULL UNIQUE,
  senha_hash TEXT NOT NULL,
  trigrama TEXT NOT NULL UNIQUE,
  saram TEXT NOT NULL UNIQUE,
  whatsapp TEXT NOT NULL,
  foto_url TEXT,
  ativo INTEGER NOT NULL DEFAULT 1,
  created_at TEXT DEFAULT (datetime('now'))
);
```

- [ ] **Step 2: Run migration against D1**

```bash
cd worker
npx wrangler d1 execute senta-pua-db --remote --file=src/db/migrations/011_usuarios.sql
```

- [ ] **Step 3: Commit**

```bash
git add worker/src/db/migrations/011_usuarios.sql
git commit -m "feat: add usuarios table migration"
```

---

## Task 3: User Auth Middleware

**Files:**
- Create: `worker/src/middleware/userAuth.ts`
- Modify: `worker/src/index.ts` (AppType)

- [ ] **Step 1: Update AppType to include user variables**

In `worker/src/index.ts`, change line 25-27:

```typescript
// Old:
export type AppType = { Bindings: Env; Variables: { adminEmail: string } };

const app = new Hono<{ Bindings: Env; Variables: { adminEmail: string } }>();

// New:
export type AppType = { Bindings: Env; Variables: { adminEmail: string; userId: number; userEmail: string; userTrigrama: string } };

const app = new Hono<AppType>();
```

- [ ] **Step 2: Create userAuth middleware**

```typescript
// worker/src/middleware/userAuth.ts
import { Context, Next } from 'hono';
import { verify } from '../lib/jwt';
import type { AppType } from '../index';

export async function userAuthMiddleware(c: Context<AppType>, next: Next) {
  const header = c.req.header('Authorization');
  if (!header?.startsWith('Bearer ')) {
    return c.json({ error: 'Token não fornecido' }, 401);
  }

  const token = header.slice(7);
  const payload = await verify(token, c.env.JWT_SECRET);
  if (!payload || payload.tipo !== 'usuario') {
    return c.json({ error: 'Token inválido ou expirado' }, 401);
  }

  c.set('userId', payload.id as number);
  c.set('userEmail', payload.email as string);
  c.set('userTrigrama', payload.trigrama as string);
  await next();
}
```

- [ ] **Step 3: Commit**

```bash
git add worker/src/middleware/userAuth.ts worker/src/index.ts
git commit -m "feat: add user auth middleware and update AppType"
```

---

## Task 4: User Routes (Backend)

**Files:**
- Create: `worker/src/routes/usuarios.ts`
- Modify: `worker/src/index.ts` (mount route)

- [ ] **Step 1: Create usuarios route with cadastro, login, me, update, foto, admin endpoints**

```typescript
// worker/src/routes/usuarios.ts
import { Hono } from 'hono';
import { sign } from '../lib/jwt';
import { hashPassword, verifyPassword } from '../lib/password';
import { userAuthMiddleware } from '../middleware/userAuth';
import { authMiddleware } from '../middleware/auth';
import type { AppType } from '../index';

const usuarios = new Hono<AppType>();

// Publico: cadastro
usuarios.post('/cadastro', async (c) => {
  const { email, senha, trigrama, saram, whatsapp } = await c.req.json<{
    email: string; senha: string; trigrama: string; saram: string; whatsapp: string;
  }>();

  if (!email || !senha || !trigrama || !saram || !whatsapp) {
    return c.json({ error: 'Todos os campos são obrigatórios' }, 400);
  }

  if (senha.length < 6) {
    return c.json({ error: 'Senha deve ter no mínimo 6 caracteres' }, 400);
  }

  const trigramaClean = trigrama.trim().toUpperCase();
  if (!/^[A-ZÀ-ÚÖ]{3}$/.test(trigramaClean)) {
    return c.json({ error: 'Trigrama deve ter exatamente 3 letras' }, 400);
  }

  const saramClean = saram.trim();
  if (!/^\d+$/.test(saramClean)) {
    return c.json({ error: 'SARAM deve conter apenas números' }, 400);
  }

  // Check duplicates
  const existEmail = await c.env.DB.prepare('SELECT id FROM usuarios WHERE email = ?').bind(email.trim().toLowerCase()).first();
  if (existEmail) return c.json({ error: 'Email já cadastrado' }, 409);

  const existTrigrama = await c.env.DB.prepare('SELECT id FROM usuarios WHERE trigrama = ?').bind(trigramaClean).first();
  if (existTrigrama) return c.json({ error: 'Trigrama já cadastrado' }, 409);

  const existSaram = await c.env.DB.prepare('SELECT id FROM usuarios WHERE saram = ?').bind(saramClean).first();
  if (existSaram) return c.json({ error: 'SARAM já cadastrado' }, 409);

  const senhaHash = await hashPassword(senha);

  const { results } = await c.env.DB.prepare(
    'INSERT INTO usuarios (email, senha_hash, trigrama, saram, whatsapp) VALUES (?, ?, ?, ?, ?) RETURNING id'
  ).bind(email.trim().toLowerCase(), senhaHash, trigramaClean, saramClean, whatsapp.trim()).all<{ id: number }>();

  const userId = results[0].id;

  // Create or link cliente
  const existCliente = await c.env.DB.prepare(
    'SELECT id FROM clientes WHERE nome_guerra = ? COLLATE NOCASE'
  ).bind(trigramaClean).first();

  if (!existCliente) {
    await c.env.DB.prepare(
      'INSERT INTO clientes (nome_guerra, whatsapp) VALUES (?, ?)'
    ).bind(trigramaClean, whatsapp.trim()).run();
  }

  const token = await sign({ tipo: 'usuario', id: userId, email: email.trim().toLowerCase(), trigrama: trigramaClean }, c.env.JWT_SECRET, 720);
  return c.json({ token, user: { id: userId, email: email.trim().toLowerCase(), trigrama: trigramaClean, saram: saramClean, whatsapp: whatsapp.trim(), foto_url: null } }, 201);
});

// Publico: login
usuarios.post('/login', async (c) => {
  const { email, senha } = await c.req.json<{ email: string; senha: string }>();

  if (!email || !senha) {
    return c.json({ error: 'Email e senha obrigatórios' }, 400);
  }

  const user = await c.env.DB.prepare(
    'SELECT id, email, senha_hash, trigrama, saram, whatsapp, foto_url, ativo FROM usuarios WHERE email = ?'
  ).bind(email.trim().toLowerCase()).first<{
    id: number; email: string; senha_hash: string; trigrama: string; saram: string; whatsapp: string; foto_url: string | null; ativo: number;
  }>();

  if (!user) return c.json({ error: 'Email ou senha incorretos' }, 401);
  if (!user.ativo) return c.json({ error: 'Conta desativada. Procure o administrador.' }, 403);

  const valid = await verifyPassword(senha, user.senha_hash);
  if (!valid) return c.json({ error: 'Email ou senha incorretos' }, 401);

  const token = await sign({ tipo: 'usuario', id: user.id, email: user.email, trigrama: user.trigrama }, c.env.JWT_SECRET, 720);
  return c.json({ token, user: { id: user.id, email: user.email, trigrama: user.trigrama, saram: user.saram, whatsapp: user.whatsapp, foto_url: user.foto_url } });
});

// Usuario logado: dados do perfil
usuarios.get('/me', userAuthMiddleware, async (c) => {
  const userId = c.get('userId');
  const user = await c.env.DB.prepare(
    'SELECT id, email, trigrama, saram, whatsapp, foto_url, created_at FROM usuarios WHERE id = ?'
  ).bind(userId).first();

  if (!user) return c.json({ error: 'Usuário não encontrado' }, 404);
  return c.json(user);
});

// Usuario logado: atualizar perfil
usuarios.put('/me', userAuthMiddleware, async (c) => {
  const userId = c.get('userId');
  const { whatsapp, saram } = await c.req.json<{ whatsapp?: string; saram?: string }>();

  const updates: string[] = [];
  const params: unknown[] = [];

  if (whatsapp) { updates.push('whatsapp = ?'); params.push(whatsapp.trim()); }
  if (saram) {
    if (!/^\d+$/.test(saram.trim())) return c.json({ error: 'SARAM deve conter apenas números' }, 400);
    const existSaram = await c.env.DB.prepare('SELECT id FROM usuarios WHERE saram = ? AND id != ?').bind(saram.trim(), userId).first();
    if (existSaram) return c.json({ error: 'SARAM já cadastrado por outro usuário' }, 409);
    updates.push('saram = ?'); params.push(saram.trim());
  }

  if (!updates.length) return c.json({ error: 'Nenhum campo para atualizar' }, 400);

  params.push(userId);
  await c.env.DB.prepare(`UPDATE usuarios SET ${updates.join(', ')} WHERE id = ?`).bind(...params).run();

  // Also update whatsapp in clientes
  if (whatsapp) {
    const trigrama = c.get('userTrigrama');
    await c.env.DB.prepare('UPDATE clientes SET whatsapp = ? WHERE nome_guerra = ? COLLATE NOCASE').bind(whatsapp.trim(), trigrama).run();
  }

  const user = await c.env.DB.prepare(
    'SELECT id, email, trigrama, saram, whatsapp, foto_url, created_at FROM usuarios WHERE id = ?'
  ).bind(userId).first();
  return c.json(user);
});

// Usuario logado: upload foto
usuarios.post('/me/foto', userAuthMiddleware, async (c) => {
  const userId = c.get('userId');
  const formData = await c.req.formData();
  const file = formData.get('foto') as File | null;

  if (!file) return c.json({ error: 'Nenhum arquivo enviado' }, 400);

  if (file.size > 2 * 1024 * 1024) return c.json({ error: 'Arquivo muito grande. Máximo 2MB' }, 400);

  const ext = file.name.split('.').pop()?.toLowerCase() || 'jpg';
  if (!['jpg', 'jpeg', 'png', 'webp'].includes(ext)) {
    return c.json({ error: 'Formato não suportado. Use: jpg, png, webp' }, 400);
  }

  // Delete old photo if exists
  const current = await c.env.DB.prepare('SELECT foto_url FROM usuarios WHERE id = ?').bind(userId).first<{ foto_url: string | null }>();
  if (current?.foto_url) {
    const oldKey = current.foto_url.replace('/api/images/', '');
    await c.env.IMAGES.delete(oldKey).catch(() => {});
  }

  const key = `usuarios/${userId}/foto.${ext}`;
  await c.env.IMAGES.put(key, file.stream(), { httpMetadata: { contentType: file.type } });

  const fotoUrl = `/api/images/${key}`;
  await c.env.DB.prepare('UPDATE usuarios SET foto_url = ? WHERE id = ?').bind(fotoUrl, userId).run();

  return c.json({ foto_url: fotoUrl });
});

// Usuario logado: remover foto
usuarios.delete('/me/foto', userAuthMiddleware, async (c) => {
  const userId = c.get('userId');
  const current = await c.env.DB.prepare('SELECT foto_url FROM usuarios WHERE id = ?').bind(userId).first<{ foto_url: string | null }>();

  if (current?.foto_url) {
    const key = current.foto_url.replace('/api/images/', '');
    await c.env.IMAGES.delete(key).catch(() => {});
  }

  await c.env.DB.prepare('UPDATE usuarios SET foto_url = NULL WHERE id = ?').bind(userId).run();
  return c.json({ ok: true });
});

// Admin: listar usuarios
usuarios.get('/admin/lista', authMiddleware, async (c) => {
  const { results } = await c.env.DB.prepare(
    'SELECT id, email, trigrama, saram, whatsapp, foto_url, ativo, created_at FROM usuarios ORDER BY trigrama'
  ).all();
  return c.json(results);
});

// Admin: resetar senha
usuarios.put('/admin/:id/senha', authMiddleware, async (c) => {
  const id = c.req.param('id');
  const { nova_senha } = await c.req.json<{ nova_senha: string }>();

  if (!nova_senha || nova_senha.length < 6) {
    return c.json({ error: 'Senha deve ter no mínimo 6 caracteres' }, 400);
  }

  const senhaHash = await hashPassword(nova_senha);
  const result = await c.env.DB.prepare('UPDATE usuarios SET senha_hash = ? WHERE id = ?').bind(senhaHash, id).run();

  if (!result.meta.changes) return c.json({ error: 'Usuário não encontrado' }, 404);
  return c.json({ ok: true });
});

// Admin: desativar usuario
usuarios.put('/admin/:id/desativar', authMiddleware, async (c) => {
  const id = c.req.param('id');
  const result = await c.env.DB.prepare('UPDATE usuarios SET ativo = 0 WHERE id = ?').bind(id).run();
  if (!result.meta.changes) return c.json({ error: 'Usuário não encontrado' }, 404);
  return c.json({ ok: true });
});

// Admin: ativar usuario
usuarios.put('/admin/:id/ativar', authMiddleware, async (c) => {
  const id = c.req.param('id');
  const result = await c.env.DB.prepare('UPDATE usuarios SET ativo = 1 WHERE id = ?').bind(id).run();
  if (!result.meta.changes) return c.json({ error: 'Usuário não encontrado' }, 404);
  return c.json({ ok: true });
});

export default usuarios;
```

- [ ] **Step 2: Mount route in index.ts**

In `worker/src/index.ts`, add after the existing imports:

```typescript
import usuarios from './routes/usuarios';
```

And after `app.route('/api/ximboca', ximboca);`:

```typescript
app.route('/api/usuarios', usuarios);
```

- [ ] **Step 3: Commit**

```bash
git add worker/src/routes/usuarios.ts worker/src/index.ts
git commit -m "feat: add user registration, login, profile, and admin management endpoints"
```

---

## Task 5: Update Image Routes for User Photos

**Files:**
- Modify: `worker/src/routes/images.ts`

- [ ] **Step 1: Add serving for user photos (already works via /:prefix/:filename)**

The existing `images.get('/:prefix/:filename')` route already serves any file from R2 including `usuarios/*/foto.*`. No changes needed to images.ts — the `usuarios.ts` route handles upload/delete directly to R2.

However, we need to support the nested path `usuarios/:id/foto.ext`. Update the image serving route:

In `worker/src/routes/images.ts`, change the GET route (line 32-45):

```typescript
// Old:
images.get('/:prefix/:filename', async (c) => {
  const prefix = c.req.param('prefix');
  const filename = c.req.param('filename');
  const key = `${prefix}/${filename}`;

// New:
images.get('/:prefix/:rest{.+}', async (c) => {
  const prefix = c.req.param('prefix');
  const rest = c.req.param('rest');
  const key = `${prefix}/${rest}`;
```

Also update the DELETE route similarly (line 48-55):

```typescript
// Old:
images.delete('/:prefix/:filename', authMiddleware, async (c) => {
  const prefix = c.req.param('prefix');
  const filename = c.req.param('filename');
  const key = `${prefix}/${filename}`;

// New:
images.delete('/:prefix/:rest{.+}', authMiddleware, async (c) => {
  const prefix = c.req.param('prefix');
  const rest = c.req.param('rest');
  const key = `${prefix}/${rest}`;
```

- [ ] **Step 2: Commit**

```bash
git add worker/src/routes/images.ts
git commit -m "fix: support nested image paths for user photos"
```

---

## Task 6: Types and API Service Updates (Frontend)

**Files:**
- Modify: `app/src/types/index.ts`
- Modify: `app/src/services/api.ts`

- [ ] **Step 1: Add Usuario type**

At the end of `app/src/types/index.ts`, add:

```typescript
export interface Usuario {
  id: number;
  email: string;
  trigrama: string;
  saram: string;
  whatsapp: string;
  foto_url: string | null;
  created_at?: string;
}
```

- [ ] **Step 2: Update api.ts to support dual tokens**

Replace `app/src/services/api.ts` entirely:

```typescript
const BASE_URL = import.meta.env.VITE_WORKER_URL || '';

async function request<T>(path: string, options?: RequestInit): Promise<T> {
  const headers: Record<string, string> = {
    ...((options?.headers as Record<string, string>) || {}),
  };

  if (options?.body && !(options.body instanceof FormData)) {
    headers['Content-Type'] = 'application/json';
  }

  // Use admin token for /api/auth and /api/admin routes, user token for everything else
  const isAdmin = path.startsWith('/api/auth') || path.startsWith('/api/admin') ||
    (path.startsWith('/api/') && ['produtos', 'clientes', 'pedidos', 'config', 'loja', 'cafe', 'ximboca', 'images/upload']
      .some(r => path.includes(r) && localStorage.getItem('token')));

  const token = isAdmin ? localStorage.getItem('token') : (localStorage.getItem('user_token') || localStorage.getItem('token'));

  if (token) {
    headers['Authorization'] = `Bearer ${token}`;
  }

  const res = await fetch(`${BASE_URL}${path}`, {
    ...options,
    headers,
  });

  if (!res.ok) {
    const body = await res.json().catch(() => ({ error: 'Erro desconhecido' }));
    throw new Error((body as { error?: string }).error || `HTTP ${res.status}`);
  }

  return res.json() as Promise<T>;
}

export const api = {
  get: <T>(path: string) => request<T>(path),
  post: <T>(path: string, data: unknown) => request<T>(path, { method: 'POST', body: JSON.stringify(data) }),
  put: <T>(path: string, data: unknown) => request<T>(path, { method: 'PUT', body: JSON.stringify(data) }),
  delete: <T>(path: string) => request<T>(path, { method: 'DELETE' }),
  upload: <T>(path: string, formData: FormData) => request<T>(path, { method: 'POST', body: formData }),
};
```

- [ ] **Step 3: Commit**

```bash
git add app/src/types/index.ts app/src/services/api.ts
git commit -m "feat: add Usuario type and dual-token API support"
```

---

## Task 7: User Auth Zustand Store

**Files:**
- Create: `app/src/hooks/useUserAuth.ts`

- [ ] **Step 1: Create user auth store**

```typescript
// app/src/hooks/useUserAuth.ts
import { create } from 'zustand';
import { api } from '../services/api';
import type { Usuario } from '../types';

interface UserAuthState {
  token: string | null;
  user: Usuario | null;
  loading: boolean;
  login: (email: string, senha: string) => Promise<void>;
  cadastrar: (dados: { email: string; senha: string; trigrama: string; saram: string; whatsapp: string }) => Promise<void>;
  logout: () => void;
  checkAuth: () => Promise<boolean>;
  updateProfile: (dados: { whatsapp?: string; saram?: string }) => Promise<void>;
  updateFoto: (file: File) => Promise<void>;
  removeFoto: () => Promise<void>;
  setUser: (user: Usuario) => void;
}

export const useUserAuth = create<UserAuthState>((set, get) => ({
  token: localStorage.getItem('user_token'),
  user: null,
  loading: false,

  login: async (email, senha) => {
    set({ loading: true });
    try {
      const { token, user } = await api.post<{ token: string; user: Usuario }>('/api/usuarios/login', { email, senha });
      localStorage.setItem('user_token', token);
      set({ token, user, loading: false });
    } catch (e) {
      set({ loading: false });
      throw e;
    }
  },

  cadastrar: async (dados) => {
    set({ loading: true });
    try {
      const { token, user } = await api.post<{ token: string; user: Usuario }>('/api/usuarios/cadastro', dados);
      localStorage.setItem('user_token', token);
      set({ token, user, loading: false });
    } catch (e) {
      set({ loading: false });
      throw e;
    }
  },

  logout: () => {
    localStorage.removeItem('user_token');
    set({ token: null, user: null });
  },

  checkAuth: async () => {
    const token = localStorage.getItem('user_token');
    if (!token) return false;
    try {
      const user = await api.get<Usuario>('/api/usuarios/me');
      set({ token, user });
      return true;
    } catch {
      localStorage.removeItem('user_token');
      set({ token: null, user: null });
      return false;
    }
  },

  updateProfile: async (dados) => {
    const user = await api.put<Usuario>('/api/usuarios/me', dados);
    set({ user });
  },

  updateFoto: async (file) => {
    const formData = new FormData();
    formData.append('foto', file);
    const { foto_url } = await api.upload<{ foto_url: string }>('/api/usuarios/me/foto', formData);
    const current = get().user;
    if (current) set({ user: { ...current, foto_url } });
  },

  removeFoto: async () => {
    await api.delete('/api/usuarios/me/foto');
    const current = get().user;
    if (current) set({ user: { ...current, foto_url: null } });
  },

  setUser: (user) => set({ user }),
}));
```

- [ ] **Step 2: Commit**

```bash
git add app/src/hooks/useUserAuth.ts
git commit -m "feat: add user auth Zustand store"
```

---

## Task 8: Sidebar Component

**Files:**
- Create: `app/src/components/Sidebar.tsx`

- [ ] **Step 1: Create Sidebar component**

```typescript
// app/src/components/Sidebar.tsx
import { Link, useLocation } from 'react-router-dom';
import { useState, useEffect } from 'react';
import { useAuth } from '../hooks/useAuth';
import { useUserAuth } from '../hooks/useUserAuth';

const WORKER_URL = import.meta.env.VITE_WORKER_URL || '';
function resolveImg(url: string | null): string | null {
  if (!url) return null;
  return url.startsWith('/api') ? `${WORKER_URL}${url}` : url;
}

interface NavItem {
  to: string;
  label: string;
  icon: string;
  children?: { to: string; label: string }[];
}

function getVisitorNav(): NavItem[] {
  return [
    { to: '/', label: 'Catálogo', icon: '🛒' },
    { to: '/loja', label: 'Loja', icon: '🎖️' },
    { to: '/cafe', label: 'Café', icon: '☕' },
  ];
}

function getUserNav(): NavItem[] {
  return [
    { to: '/', label: 'Catálogo', icon: '🛒' },
    { to: '/loja', label: 'Loja', icon: '🎖️' },
    { to: '/cafe', label: 'Café', icon: '☕' },
    { to: '/perfil', label: 'Meu Perfil', icon: '👤' },
  ];
}

function getAdminNav(): NavItem[] {
  return [
    { to: '/admin', label: 'Guloseimas', icon: '🍬', children: [
      { to: '/admin', label: 'Dashboard' },
      { to: '/admin/pedidos', label: 'Pedidos' },
      { to: '/admin/produtos', label: 'Produtos' },
      { to: '/admin/clientes', label: 'Militares' },
      { to: '/admin/relatorios', label: 'Relatórios' },
    ]},
    { to: '/admin/loja', label: 'Loja', icon: '🎖️', children: [
      { to: '/admin/loja', label: 'Dashboard' },
      { to: '/admin/loja/pedidos', label: 'Pedidos' },
      { to: '/admin/loja/produtos', label: 'Produtos' },
    ]},
    { to: '/admin/cafe', label: 'Café', icon: '☕', children: [
      { to: '/admin/cafe', label: 'Dashboard' },
      { to: '/admin/cafe/mensalidades', label: 'Mensalidades' },
      { to: '/admin/cafe/insumos', label: 'Insumos' },
      { to: '/admin/cafe/assinantes', label: 'Assinantes' },
    ]},
    { to: '/admin/ximboca', label: 'Ximboca', icon: '🍖', children: [
      { to: '/admin/ximboca', label: 'Dashboard' },
      { to: '/admin/ximboca/eventos', label: 'Eventos' },
      { to: '/admin/ximboca/estoque', label: 'Estoque' },
    ]},
    { to: '/admin/config', label: 'Configurações', icon: '⚙️' },
  ];
}

interface SidebarProps {
  open: boolean;
  onClose: () => void;
}

export function Sidebar({ open, onClose }: SidebarProps) {
  const location = useLocation();
  const { token: adminToken, logout: adminLogout } = useAuth();
  const { user, logout: userLogout } = useUserAuth();
  const [collapsed, setCollapsed] = useState(() => localStorage.getItem('sidebar_collapsed') === 'true');
  const [openMenus, setOpenMenus] = useState<Record<string, boolean>>({});

  const isAdmin = !!adminToken;
  const isUser = !!user;

  const nav = isAdmin ? getAdminNav() : isUser ? getUserNav() : getVisitorNav();

  useEffect(() => {
    localStorage.setItem('sidebar_collapsed', String(collapsed));
  }, [collapsed]);

  // Close on mobile nav
  useEffect(() => {
    onClose();
  }, [location.pathname]);

  const toggleMenu = (key: string) => {
    setOpenMenus(prev => ({ ...prev, [key]: !prev[key] }));
  };

  const isActive = (to: string) => location.pathname === to;
  const isInSection = (item: NavItem) =>
    location.pathname === item.to || item.children?.some(c => location.pathname === c.to);

  const sidebarWidth = collapsed ? 'w-16' : 'w-64';

  return (
    <>
      {/* Mobile backdrop */}
      {open && (
        <div className="fixed inset-0 bg-black/40 z-40 lg:hidden" onClick={onClose} />
      )}

      <aside className={`fixed top-0 left-0 h-full bg-white border-r border-borda z-50 flex flex-col transition-all duration-300
        ${sidebarWidth}
        ${open ? 'translate-x-0' : '-translate-x-full lg:translate-x-0'}
      `}>
        {/* Logo + collapse toggle */}
        <div className="flex items-center justify-between px-3 py-4 border-b border-borda">
          {!collapsed && (
            <Link to={isAdmin ? '/admin' : '/'} className="flex items-center gap-2">
              <img src="/logo.png" alt="Logo" className="w-8 h-8 object-contain" />
              <span className="font-display text-azul text-lg tracking-wider">APP RP</span>
            </Link>
          )}
          {collapsed && (
            <Link to={isAdmin ? '/admin' : '/'} className="mx-auto">
              <img src="/logo.png" alt="Logo" className="w-8 h-8 object-contain" />
            </Link>
          )}
          <button
            onClick={() => setCollapsed(!collapsed)}
            className="hidden lg:flex w-7 h-7 items-center justify-center rounded-lg hover:bg-fundo text-texto-fraco"
          >
            <svg className={`w-4 h-4 transition-transform ${collapsed ? 'rotate-180' : ''}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 19l-7-7 7-7" />
            </svg>
          </button>
        </div>

        {/* Nav items */}
        <nav className="flex-1 overflow-y-auto py-2 px-2">
          {nav.map((item) => (
            <div key={item.to}>
              {item.children ? (
                <>
                  <button
                    onClick={() => toggleMenu(item.to)}
                    className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium transition-all mb-0.5
                      ${isInSection(item) ? 'bg-azul/10 text-azul' : 'text-texto-fraco hover:bg-fundo hover:text-texto'}
                    `}
                  >
                    <span className="text-base flex-shrink-0">{item.icon}</span>
                    {!collapsed && (
                      <>
                        <span className="flex-1 text-left">{item.label}</span>
                        <svg className={`w-4 h-4 transition-transform ${openMenus[item.to] || isInSection(item) ? 'rotate-90' : ''}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                        </svg>
                      </>
                    )}
                  </button>
                  {!collapsed && (openMenus[item.to] || isInSection(item)) && (
                    <div className="ml-8 space-y-0.5 mb-1">
                      {item.children.map(child => (
                        <Link
                          key={child.to}
                          to={child.to}
                          className={`block px-3 py-2 rounded-lg text-sm transition-all
                            ${isActive(child.to) ? 'bg-azul text-white font-medium' : 'text-texto-fraco hover:bg-fundo hover:text-texto'}
                          `}
                        >
                          {child.label}
                        </Link>
                      ))}
                    </div>
                  )}
                </>
              ) : (
                <Link
                  to={item.to}
                  className={`flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium transition-all mb-0.5
                    ${isActive(item.to) ? 'bg-azul text-white' : 'text-texto-fraco hover:bg-fundo hover:text-texto'}
                  `}
                >
                  <span className="text-base flex-shrink-0">{item.icon}</span>
                  {!collapsed && <span>{item.label}</span>}
                </Link>
              )}
            </div>
          ))}
        </nav>

        {/* Bottom: auth actions */}
        <div className="border-t border-borda p-2">
          {isAdmin && (
            <button onClick={() => { adminLogout(); }} className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium text-vermelho hover:bg-red-50 transition-all`}>
              <span className="text-base flex-shrink-0">🚪</span>
              {!collapsed && <span>Sair (Admin)</span>}
            </button>
          )}
          {!isAdmin && isUser && (
            <button onClick={() => { userLogout(); }} className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium text-vermelho hover:bg-red-50 transition-all`}>
              <span className="text-base flex-shrink-0">🚪</span>
              {!collapsed && <span>Sair</span>}
            </button>
          )}
          {!isAdmin && !isUser && (
            <Link to="/login" className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium text-azul hover:bg-azul/10 transition-all`}>
              <span className="text-base flex-shrink-0">🔑</span>
              {!collapsed && <span>Entrar / Cadastrar</span>}
            </Link>
          )}
        </div>
      </aside>
    </>
  );
}
```

- [ ] **Step 2: Commit**

```bash
git add app/src/components/Sidebar.tsx
git commit -m "feat: add collapsible sidebar component"
```

---

## Task 9: Unified AppLayout Component

**Files:**
- Create: `app/src/components/AppLayout.tsx`

- [ ] **Step 1: Create AppLayout**

```typescript
// app/src/components/AppLayout.tsx
import { useState } from 'react';
import { Link } from 'react-router-dom';
import { Sidebar } from './Sidebar';
import { useAuth } from '../hooks/useAuth';
import { useUserAuth } from '../hooks/useUserAuth';

const WORKER_URL = import.meta.env.VITE_WORKER_URL || '';
function resolveImg(url: string | null): string | null {
  if (!url) return null;
  return url.startsWith('/api') ? `${WORKER_URL}${url}` : url;
}

export function AppLayout({ children }: { children: React.ReactNode }) {
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const { token: adminToken } = useAuth();
  const { user } = useUserAuth();
  const isAdmin = !!adminToken;

  return (
    <div className="min-h-screen bg-fundo">
      <Sidebar open={sidebarOpen} onClose={() => setSidebarOpen(false)} />

      {/* Header */}
      <header className="bg-white border-b border-borda sticky top-0 z-30 shadow-sm lg:pl-16" id="app-header">
        <div className="px-4 py-3 flex items-center justify-between">
          {/* Mobile: hamburger */}
          <button
            onClick={() => setSidebarOpen(true)}
            className="lg:hidden w-10 h-10 flex items-center justify-center rounded-xl hover:bg-fundo"
          >
            <svg className="w-6 h-6 text-texto" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" />
            </svg>
          </button>

          {/* Logo (mobile centered, desktop left) */}
          <Link to={isAdmin ? '/admin' : '/'} className="flex items-center gap-2 lg:hidden">
            <img src="/logo.png" alt="Logo" className="w-8 h-8 object-contain" />
            <span className="font-display text-azul text-lg tracking-wider">APP RP POKER</span>
          </Link>

          {/* Desktop: spacer for left side */}
          <div className="hidden lg:block" />

          {/* Right: avatar or login */}
          <div className="flex items-center gap-2">
            {user ? (
              <Link to="/perfil" className="flex items-center gap-2">
                {resolveImg(user.foto_url) ? (
                  <img src={resolveImg(user.foto_url)!} alt={user.trigrama} className="w-9 h-9 rounded-full object-cover border-2 border-borda" />
                ) : (
                  <div className="w-9 h-9 rounded-full bg-azul/10 flex items-center justify-center text-azul font-display text-sm">
                    {user.trigrama}
                  </div>
                )}
              </Link>
            ) : !isAdmin ? (
              <Link to="/login" className="w-9 h-9 rounded-full bg-fundo flex items-center justify-center border border-borda hover:bg-azul/10 transition-colors">
                <svg className="w-5 h-5 text-texto-fraco" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
                </svg>
              </Link>
            ) : (
              <div className="w-9 h-9 rounded-full bg-azul flex items-center justify-center text-white font-display text-xs">
                ADM
              </div>
            )}
          </div>
        </div>
      </header>

      {/* Main content */}
      <main className="lg:pl-16 transition-all duration-300">
        <div className="max-w-5xl mx-auto px-4 py-5">
          {children}
        </div>
      </main>

      <footer className="lg:pl-16 text-center py-4 text-[10px] text-texto-fraco tracking-wider">
        Desenvolvido pelo 3S TIN HÖEHR
      </footer>
    </div>
  );
}
```

- [ ] **Step 2: Commit**

```bash
git add app/src/components/AppLayout.tsx
git commit -m "feat: add unified AppLayout with header and sidebar"
```

---

## Task 10: User Login Page

**Files:**
- Create: `app/src/pages/UserLogin.tsx`

- [ ] **Step 1: Create login page**

```typescript
// app/src/pages/UserLogin.tsx
import { useState } from 'react';
import { useNavigate, Link, useLocation } from 'react-router-dom';
import { AppLayout } from '../components/AppLayout';
import { Button } from '../components/ui/Button';
import { useUserAuth } from '../hooks/useUserAuth';

export function UserLogin() {
  const [email, setEmail] = useState('');
  const [senha, setSenha] = useState('');
  const [erro, setErro] = useState('');
  const { login, loading } = useUserAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const returnTo = (location.state as { returnTo?: string })?.returnTo || '/';

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault(); setErro('');
    try {
      await login(email, senha);
      navigate(returnTo, { replace: true });
    } catch (err) {
      setErro(err instanceof Error ? err.message : 'Erro ao fazer login');
    }
  };

  return (
    <AppLayout>
      <div className="max-w-sm mx-auto py-10 animate-fade-in">
        <h1 className="font-display text-3xl text-azul tracking-wider mb-6 text-center">ENTRAR</h1>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-texto-fraco mb-1.5">Email</label>
            <input type="email" value={email} onChange={(e) => setEmail(e.target.value)}
              className="w-full bg-white border border-borda rounded-xl px-4 py-3 focus:outline-none focus:ring-2 focus:ring-azul/30 focus:border-azul" required />
          </div>
          <div>
            <label className="block text-sm font-medium text-texto-fraco mb-1.5">Senha</label>
            <input type="password" value={senha} onChange={(e) => setSenha(e.target.value)}
              className="w-full bg-white border border-borda rounded-xl px-4 py-3 focus:outline-none focus:ring-2 focus:ring-azul/30 focus:border-azul" required />
          </div>
          {erro && <p className="text-vermelho text-sm bg-red-50 border border-red-200 rounded-xl px-3 py-2">{erro}</p>}
          <Button type="submit" size="lg" className="w-full" disabled={loading}>{loading ? 'Entrando...' : 'Entrar'}</Button>
        </form>
        <p className="text-center text-sm text-texto-fraco mt-4">
          Não tem conta? <Link to="/cadastro" state={{ returnTo }} className="text-azul font-medium hover:underline">Cadastre-se</Link>
        </p>
        <p className="text-center text-xs text-texto-fraco mt-6">
          <Link to="/admin/login" className="hover:underline">Acesso administrativo</Link>
        </p>
      </div>
    </AppLayout>
  );
}
```

- [ ] **Step 2: Commit**

```bash
git add app/src/pages/UserLogin.tsx
git commit -m "feat: add user login page"
```

---

## Task 11: User Registration Page

**Files:**
- Create: `app/src/pages/UserCadastro.tsx`

- [ ] **Step 1: Create registration page**

```typescript
// app/src/pages/UserCadastro.tsx
import { useState, useRef } from 'react';
import { useNavigate, Link, useLocation } from 'react-router-dom';
import { AppLayout } from '../components/AppLayout';
import { Button } from '../components/ui/Button';
import { useUserAuth } from '../hooks/useUserAuth';

export function UserCadastro() {
  const [email, setEmail] = useState('');
  const [senha, setSenha] = useState('');
  const [confirmarSenha, setConfirmarSenha] = useState('');
  const [trigrama, setTrigrama] = useState('');
  const [saram, setSaram] = useState('');
  const [whatsapp, setWhatsapp] = useState('');
  const [foto, setFoto] = useState<File | null>(null);
  const [fotoPreview, setFotoPreview] = useState<string | null>(null);
  const [erro, setErro] = useState('');
  const fileRef = useRef<HTMLInputElement>(null);
  const { cadastrar, updateFoto, loading } = useUserAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const returnTo = (location.state as { returnTo?: string })?.returnTo || '/';

  const handleFoto = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (file.size > 2 * 1024 * 1024) { setErro('Foto deve ter no máximo 2MB'); return; }
    setFoto(file);
    setFotoPreview(URL.createObjectURL(file));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault(); setErro('');

    if (senha.length < 6) { setErro('Senha deve ter no mínimo 6 caracteres'); return; }
    if (senha !== confirmarSenha) { setErro('Senhas não conferem'); return; }

    const trigramaClean = trigrama.trim().toUpperCase();
    if (!/^[A-ZÀ-ÚÖ]{3}$/.test(trigramaClean)) { setErro('Trigrama deve ter exatamente 3 letras'); return; }

    if (!/^\d+$/.test(saram.trim())) { setErro('SARAM deve conter apenas números'); return; }
    if (!whatsapp.trim()) { setErro('WhatsApp é obrigatório'); return; }

    try {
      await cadastrar({ email, senha, trigrama: trigramaClean, saram: saram.trim(), whatsapp: whatsapp.trim() });
      if (foto) {
        try { await updateFoto(foto); } catch { /* foto is optional, ignore error */ }
      }
      navigate(returnTo, { replace: true });
    } catch (err) {
      setErro(err instanceof Error ? err.message : 'Erro ao cadastrar');
    }
  };

  return (
    <AppLayout>
      <div className="max-w-sm mx-auto py-6 animate-fade-in">
        <h1 className="font-display text-3xl text-azul tracking-wider mb-6 text-center">CADASTRO</h1>
        <form onSubmit={handleSubmit} className="space-y-4">
          {/* Foto opcional */}
          <div className="flex justify-center">
            <button type="button" onClick={() => fileRef.current?.click()}
              className="w-24 h-24 rounded-full bg-fundo border-2 border-dashed border-borda flex items-center justify-center overflow-hidden hover:border-azul transition-colors">
              {fotoPreview ? (
                <img src={fotoPreview} alt="Preview" className="w-full h-full object-cover" />
              ) : (
                <div className="text-center">
                  <svg className="w-8 h-8 text-texto-fraco mx-auto" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M3 9a2 2 0 012-2h.93a2 2 0 001.664-.89l.812-1.22A2 2 0 0110.07 4h3.86a2 2 0 011.664.89l.812 1.22A2 2 0 0018.07 7H19a2 2 0 012 2v9a2 2 0 01-2 2H5a2 2 0 01-2-2V9z" />
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M15 13a3 3 0 11-6 0 3 3 0 016 0z" />
                  </svg>
                  <span className="text-[10px] text-texto-fraco">Foto</span>
                </div>
              )}
            </button>
            <input ref={fileRef} type="file" accept="image/jpeg,image/png,image/webp" onChange={handleFoto} className="hidden" />
          </div>

          <div>
            <label className="block text-sm font-medium text-texto-fraco mb-1.5">Email</label>
            <input type="email" value={email} onChange={(e) => setEmail(e.target.value)}
              className="w-full bg-white border border-borda rounded-xl px-4 py-3 focus:outline-none focus:ring-2 focus:ring-azul/30 focus:border-azul" required />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-sm font-medium text-texto-fraco mb-1.5">Trigrama</label>
              <input type="text" value={trigrama} onChange={(e) => setTrigrama(e.target.value.toUpperCase().replace(/[^A-ZÀ-ÚÖ]/g, '').slice(0, 3))}
                maxLength={3} placeholder="Ex: RET"
                className="w-full bg-white border border-borda rounded-xl px-4 py-3 focus:outline-none focus:ring-2 focus:ring-azul/30 focus:border-azul uppercase tracking-widest font-display text-lg text-center" required />
            </div>
            <div>
              <label className="block text-sm font-medium text-texto-fraco mb-1.5">SARAM</label>
              <input type="text" value={saram} onChange={(e) => setSaram(e.target.value.replace(/\D/g, ''))}
                placeholder="Nº identificação"
                className="w-full bg-white border border-borda rounded-xl px-4 py-3 focus:outline-none focus:ring-2 focus:ring-azul/30 focus:border-azul" required />
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-texto-fraco mb-1.5">WhatsApp</label>
            <input type="tel" value={whatsapp} onChange={(e) => setWhatsapp(e.target.value.replace(/\D/g, ''))}
              placeholder="Ex: 62999998888"
              className="w-full bg-white border border-borda rounded-xl px-4 py-3 focus:outline-none focus:ring-2 focus:ring-azul/30 focus:border-azul" required />
          </div>

          <div>
            <label className="block text-sm font-medium text-texto-fraco mb-1.5">Senha</label>
            <input type="password" value={senha} onChange={(e) => setSenha(e.target.value)}
              placeholder="Mínimo 6 caracteres"
              className="w-full bg-white border border-borda rounded-xl px-4 py-3 focus:outline-none focus:ring-2 focus:ring-azul/30 focus:border-azul" required />
          </div>

          <div>
            <label className="block text-sm font-medium text-texto-fraco mb-1.5">Confirmar Senha</label>
            <input type="password" value={confirmarSenha} onChange={(e) => setConfirmarSenha(e.target.value)}
              className="w-full bg-white border border-borda rounded-xl px-4 py-3 focus:outline-none focus:ring-2 focus:ring-azul/30 focus:border-azul" required />
          </div>

          {erro && <p className="text-vermelho text-sm bg-red-50 border border-red-200 rounded-xl px-3 py-2">{erro}</p>}
          <Button type="submit" size="lg" className="w-full" disabled={loading}>{loading ? 'Cadastrando...' : 'Cadastrar'}</Button>
        </form>
        <p className="text-center text-sm text-texto-fraco mt-4">
          Já tem conta? <Link to="/login" state={{ returnTo }} className="text-azul font-medium hover:underline">Entrar</Link>
        </p>
      </div>
    </AppLayout>
  );
}
```

- [ ] **Step 2: Commit**

```bash
git add app/src/pages/UserCadastro.tsx
git commit -m "feat: add user registration page"
```

---

## Task 12: User Profile Page

**Files:**
- Create: `app/src/pages/Perfil.tsx`

- [ ] **Step 1: Create profile page**

```typescript
// app/src/pages/Perfil.tsx
import { useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { AppLayout } from '../components/AppLayout';
import { Button } from '../components/ui/Button';
import { useUserAuth } from '../hooks/useUserAuth';

const WORKER_URL = import.meta.env.VITE_WORKER_URL || '';
function resolveImg(url: string | null): string | null {
  if (!url) return null;
  return url.startsWith('/api') ? `${WORKER_URL}${url}` : url;
}

export function Perfil() {
  const { user, checkAuth, updateProfile, updateFoto, removeFoto, logout } = useUserAuth();
  const [whatsapp, setWhatsapp] = useState('');
  const [saram, setSaram] = useState('');
  const [salvando, setSalvando] = useState(false);
  const [msg, setMsg] = useState('');
  const [erro, setErro] = useState('');
  const fileRef = useRef<HTMLInputElement>(null);
  const navigate = useNavigate();

  useEffect(() => {
    checkAuth().then(ok => { if (!ok) navigate('/login'); });
  }, []);

  useEffect(() => {
    if (user) {
      setWhatsapp(user.whatsapp);
      setSaram(user.saram);
    }
  }, [user]);

  if (!user) return <AppLayout><div className="text-center py-20 text-gray-400">Carregando...</div></AppLayout>;

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault(); setErro(''); setMsg('');
    setSalvando(true);
    try {
      await updateProfile({ whatsapp: whatsapp.trim(), saram: saram.trim() });
      setMsg('Dados atualizados!');
    } catch (err) {
      setErro(err instanceof Error ? err.message : 'Erro ao salvar');
    } finally { setSalvando(false); }
  };

  const handleFoto = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (file.size > 2 * 1024 * 1024) { setErro('Foto deve ter no máximo 2MB'); return; }
    try {
      await updateFoto(file);
      setMsg('Foto atualizada!');
    } catch (err) {
      setErro(err instanceof Error ? err.message : 'Erro ao enviar foto');
    }
  };

  const handleRemoveFoto = async () => {
    try {
      await removeFoto();
      setMsg('Foto removida!');
    } catch (err) {
      setErro(err instanceof Error ? err.message : 'Erro ao remover foto');
    }
  };

  return (
    <AppLayout>
      <div className="max-w-sm mx-auto py-6 animate-fade-in">
        <h1 className="font-display text-3xl text-azul tracking-wider mb-6 text-center">MEU PERFIL</h1>

        {/* Foto */}
        <div className="flex flex-col items-center mb-6">
          <button type="button" onClick={() => fileRef.current?.click()}
            className="w-28 h-28 rounded-full bg-fundo border-2 border-borda flex items-center justify-center overflow-hidden hover:border-azul transition-colors mb-2">
            {resolveImg(user.foto_url) ? (
              <img src={resolveImg(user.foto_url)!} alt={user.trigrama} className="w-full h-full object-cover" />
            ) : (
              <span className="font-display text-3xl text-azul">{user.trigrama}</span>
            )}
          </button>
          <input ref={fileRef} type="file" accept="image/jpeg,image/png,image/webp" onChange={handleFoto} className="hidden" />
          <div className="flex gap-2 text-xs">
            <button type="button" onClick={() => fileRef.current?.click()} className="text-azul hover:underline">Trocar foto</button>
            {user.foto_url && (
              <button type="button" onClick={handleRemoveFoto} className="text-vermelho hover:underline">Remover</button>
            )}
          </div>
        </div>

        {/* Info fixa */}
        <div className="bg-white rounded-xl border border-borda p-4 mb-4 space-y-2">
          <div className="flex justify-between text-sm">
            <span className="text-texto-fraco">Email</span>
            <span className="font-medium">{user.email}</span>
          </div>
          <div className="flex justify-between text-sm">
            <span className="text-texto-fraco">Trigrama</span>
            <span className="font-display text-azul text-lg tracking-widest">{user.trigrama}</span>
          </div>
        </div>

        {/* Editaveis */}
        <form onSubmit={handleSave} className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-texto-fraco mb-1.5">SARAM</label>
            <input type="text" value={saram} onChange={(e) => setSaram(e.target.value.replace(/\D/g, ''))}
              className="w-full bg-white border border-borda rounded-xl px-4 py-3 focus:outline-none focus:ring-2 focus:ring-azul/30 focus:border-azul" />
          </div>
          <div>
            <label className="block text-sm font-medium text-texto-fraco mb-1.5">WhatsApp</label>
            <input type="tel" value={whatsapp} onChange={(e) => setWhatsapp(e.target.value.replace(/\D/g, ''))}
              className="w-full bg-white border border-borda rounded-xl px-4 py-3 focus:outline-none focus:ring-2 focus:ring-azul/30 focus:border-azul" />
          </div>

          {erro && <p className="text-vermelho text-sm bg-red-50 border border-red-200 rounded-xl px-3 py-2">{erro}</p>}
          {msg && <p className="text-verde text-sm bg-green-50 border border-green-200 rounded-xl px-3 py-2">{msg}</p>}

          <Button type="submit" size="lg" className="w-full" disabled={salvando}>{salvando ? 'Salvando...' : 'Salvar Alterações'}</Button>
        </form>

        <button onClick={() => { logout(); navigate('/'); }} className="w-full mt-4 text-center text-vermelho text-sm font-medium py-3 hover:underline">
          Sair da conta
        </button>
      </div>
    </AppLayout>
  );
}
```

- [ ] **Step 2: Commit**

```bash
git add app/src/pages/Perfil.tsx
git commit -m "feat: add user profile page"
```

---

## Task 13: Update Checkout to Require Login

**Files:**
- Modify: `app/src/pages/Checkout.tsx`

- [ ] **Step 1: Rewrite Checkout to use user auth**

Replace `app/src/pages/Checkout.tsx` entirely:

```typescript
// app/src/pages/Checkout.tsx
import { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { AppLayout } from '../components/AppLayout';
import { Button } from '../components/ui/Button';
import { useCart } from '../hooks/useCart';
import { useUserAuth } from '../hooks/useUserAuth';
import { api } from '../services/api';

const WORKER_URL = import.meta.env.VITE_WORKER_URL || '';
function resolveImg(url: string | null): string | null {
  if (!url) return null;
  return url.startsWith('/api') ? `${WORKER_URL}${url}` : url;
}

export function Checkout() {
  const { itens, total, alterarQuantidade, remover, limpar } = useCart();
  const { user } = useUserAuth();
  const [loading, setLoading] = useState(false);
  const [erro, setErro] = useState('');
  const navigate = useNavigate();

  if (itens.length === 0) { navigate('/'); return null; }

  // Not logged in -> show login prompt
  if (!user) {
    return (
      <AppLayout>
        <div className="max-w-sm mx-auto py-16 text-center animate-fade-in">
          <div className="w-20 h-20 rounded-full bg-azul/10 flex items-center justify-center mx-auto mb-6">
            <svg className="w-10 h-10 text-azul" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
            </svg>
          </div>
          <h1 className="font-display text-2xl text-azul tracking-wider mb-3">IDENTIFICAÇÃO</h1>
          <p className="text-texto-fraco text-sm mb-8">Para finalizar seu pedido, entre na sua conta ou cadastre-se.</p>
          <div className="space-y-3">
            <Link to="/login" state={{ returnTo: '/checkout' }}>
              <Button size="lg" className="w-full">Entrar</Button>
            </Link>
            <Link to="/cadastro" state={{ returnTo: '/checkout' }}>
              <Button variant="outline" size="lg" className="w-full">Cadastrar</Button>
            </Link>
          </div>
        </div>
      </AppLayout>
    );
  }

  const enviarPedido = async (metodo: 'pix' | 'fiado') => {
    setLoading(true); setErro('');
    try {
      const body: Record<string, unknown> = {
        nome_guerra: user.trigrama,
        itens: itens.map((i) => ({ produto_id: i.produto.id, quantidade: i.quantidade })),
        metodo,
        whatsapp: user.whatsapp,
      };
      const data = await api.post<{ pedido_id: string }>('/api/pedidos', body);
      limpar();
      if (metodo === 'pix') navigate(`/pix/${data.pedido_id}`);
      else navigate('/obrigado', { state: { nome: user.trigrama, metodo } });
    } catch (e) {
      setErro(e instanceof Error ? e.message : 'Erro ao enviar pedido');
    } finally { setLoading(false); }
  };

  return (
    <AppLayout>
      <h1 className="font-display text-2xl text-azul tracking-wider mb-5">FECHAR PEDIDO</h1>

      {/* Militar identificado */}
      <div className="bg-white rounded-xl border border-borda p-4 mb-5 flex items-center gap-3">
        <div className="w-10 h-10 rounded-full bg-azul/10 flex items-center justify-center font-display text-azul text-sm">
          {user.trigrama}
        </div>
        <div className="flex-1">
          <div className="text-sm font-medium">{user.trigrama}</div>
          <div className="text-xs text-texto-fraco">{user.whatsapp}</div>
        </div>
        <Link to="/perfil" className="text-xs text-azul hover:underline">Editar</Link>
      </div>

      <div className="space-y-2 mb-6">
        {itens.map(({ produto, quantidade }) => (
          <div key={produto.id} className="bg-white rounded-xl p-3 flex items-center gap-3 border border-borda shadow-sm">
            {resolveImg(produto.imagem_url) ? (
              <img src={resolveImg(produto.imagem_url)!} alt={produto.nome} className="w-12 h-12 rounded-lg object-cover" />
            ) : (
              <div className="w-12 h-12 rounded-lg bg-fundo flex items-center justify-center text-xl">{produto.emoji}</div>
            )}
            <div className="flex-1 min-w-0">
              <div className="font-medium text-sm truncate">{produto.nome}</div>
              <div className="text-azul text-sm font-bold">R$ {(produto.preco * quantidade).toFixed(2)}</div>
            </div>
            <div className="flex items-center gap-1.5">
              <button onClick={() => alterarQuantidade(produto.id, quantidade - 1)} className="w-9 h-9 rounded-lg bg-fundo text-base font-bold border border-borda">-</button>
              <span className="w-6 text-center font-medium text-sm">{quantidade}</span>
              <button onClick={() => alterarQuantidade(produto.id, quantidade + 1)} className="w-9 h-9 rounded-lg bg-fundo text-base font-bold border border-borda">+</button>
              <button
                onClick={() => remover(produto.id)}
                className="ml-1 w-9 h-9 rounded-lg bg-red-50 border border-red-200 flex items-center justify-center text-vermelho hover:bg-red-100 transition-colors"
              >
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                </svg>
              </button>
            </div>
          </div>
        ))}
      </div>

      <div className="bg-azul rounded-2xl p-5 mb-6 text-center shadow-sm">
        <div className="text-xs text-white/70 uppercase tracking-widest">Total</div>
        <div className="font-display text-2xl sm:text-3xl text-white tracking-wider mt-1">R$ {total().toFixed(2)}</div>
      </div>

      {erro && <p className="text-vermelho text-sm mb-3 bg-red-50 border border-red-200 rounded-xl px-3 py-2">{erro}</p>}

      <div className="space-y-3 pb-4">
        <Button variant="success" size="lg" className="w-full" onClick={() => enviarPedido('pix')} disabled={loading}>
          Pagar via PIX
        </Button>
        <Button variant="outline" size="lg" className="w-full" onClick={() => enviarPedido('fiado')} disabled={loading}>
          Anotar no Fiado
        </Button>
      </div>
    </AppLayout>
  );
}
```

- [ ] **Step 2: Commit**

```bash
git add app/src/pages/Checkout.tsx
git commit -m "feat: checkout requires user login, auto-fills trigrama/whatsapp"
```

---

## Task 14: Update All Pages to Use AppLayout

**Files:**
- Modify: `app/src/pages/Home.tsx`
- Modify: `app/src/pages/admin/Login.tsx`
- Modify: All pages importing `PublicLayout` or `AdminLayout`

- [ ] **Step 1: Update Home.tsx**

Replace `import { PublicLayout } from '../components/Layout';` with `import { AppLayout } from '../components/AppLayout';` and replace `<PublicLayout>` with `<AppLayout>` and `</PublicLayout>` with `</AppLayout>`.

- [ ] **Step 2: Update admin/Login.tsx**

Replace `import { PublicLayout } from '../../components/Layout';` with `import { AppLayout } from '../../components/AppLayout';` and replace `<PublicLayout>` with `<AppLayout>` and `</PublicLayout>` with `</AppLayout>`.

- [ ] **Step 3: Find and update all other pages using PublicLayout or AdminLayout**

Run grep to find all files:

```bash
grep -rl "PublicLayout\|AdminLayout" app/src/pages/
```

For each file found:
- Replace the import to use `AppLayout` from `../components/AppLayout` (adjust path depth)
- Replace `<PublicLayout>` or `<AdminLayout>` with `<AppLayout>`
- Replace `</PublicLayout>` or `</AdminLayout>` with `</AppLayout>`

These pages need updating (based on project exploration):
- `app/src/pages/Catalogo.tsx` — PublicLayout -> AppLayout
- `app/src/pages/PixPage.tsx` — PublicLayout -> AppLayout
- `app/src/pages/Obrigado.tsx` — PublicLayout -> AppLayout
- `app/src/pages/LojaPublica.tsx` — PublicLayout -> AppLayout
- `app/src/pages/CafePublico.tsx` — PublicLayout -> AppLayout
- `app/src/pages/admin/Dashboard.tsx` — AdminLayout -> AppLayout
- `app/src/pages/admin/Produtos.tsx` — AdminLayout -> AppLayout
- `app/src/pages/admin/Clientes.tsx` — AdminLayout -> AppLayout
- `app/src/pages/admin/ClienteExtrato.tsx` — AdminLayout -> AppLayout
- `app/src/pages/admin/Pedidos.tsx` — AdminLayout -> AppLayout
- `app/src/pages/admin/Configuracoes.tsx` — AdminLayout -> AppLayout
- `app/src/pages/admin/Relatorios.tsx` — AdminLayout -> AppLayout
- `app/src/pages/admin/loja/LojaDashboard.tsx` — AdminLayout -> AppLayout
- `app/src/pages/admin/loja/LojaProdutos.tsx` — AdminLayout -> AppLayout
- `app/src/pages/admin/loja/LojaPedidos.tsx` — AdminLayout -> AppLayout
- `app/src/pages/admin/cafe/CafeDashboard.tsx` — AdminLayout -> AppLayout
- `app/src/pages/admin/cafe/CafeMensalidades.tsx` — AdminLayout -> AppLayout
- `app/src/pages/admin/cafe/CafeInsumos.tsx` — AdminLayout -> AppLayout
- `app/src/pages/admin/cafe/CafeAssinantes.tsx` — AdminLayout -> AppLayout
- `app/src/pages/admin/ximboca/XimbocaDashboard.tsx` — AdminLayout -> AppLayout
- `app/src/pages/admin/ximboca/XimbocaEventos.tsx` — AdminLayout -> AppLayout
- `app/src/pages/admin/ximboca/XimbocaEvento.tsx` — AdminLayout -> AppLayout
- `app/src/pages/admin/ximboca/XimbocaEstoque.tsx` — AdminLayout -> AppLayout

For admin pages (in subdirectories), the import path will be:
- `app/src/pages/admin/*.tsx` -> `import { AppLayout } from '../../components/AppLayout';`
- `app/src/pages/admin/loja/*.tsx` -> `import { AppLayout } from '../../../components/AppLayout';`
- `app/src/pages/admin/cafe/*.tsx` -> `import { AppLayout } from '../../../components/AppLayout';`
- `app/src/pages/admin/ximboca/*.tsx` -> `import { AppLayout } from '../../../components/AppLayout';`

- [ ] **Step 4: Commit**

```bash
git add app/src/pages/
git commit -m "refactor: migrate all pages from PublicLayout/AdminLayout to AppLayout"
```

---

## Task 15: Update App.tsx Routes

**Files:**
- Modify: `app/src/App.tsx`

- [ ] **Step 1: Add new imports and routes, add UserGuard**

Replace `app/src/App.tsx` entirely:

```typescript
// app/src/App.tsx
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { useEffect, useState } from 'react';
import { Home } from './pages/Home';
import { Catalogo } from './pages/Catalogo';
import { Checkout } from './pages/Checkout';
import { PixPage } from './pages/PixPage';
import { Obrigado } from './pages/Obrigado';
import { UserLogin } from './pages/UserLogin';
import { UserCadastro } from './pages/UserCadastro';
import { Perfil } from './pages/Perfil';
import { Login } from './pages/admin/Login';
import { Dashboard } from './pages/admin/Dashboard';
import { Produtos } from './pages/admin/Produtos';
import { Clientes } from './pages/admin/Clientes';
import { ClienteExtrato } from './pages/admin/ClienteExtrato';
import { Pedidos } from './pages/admin/Pedidos';
import { Configuracoes } from './pages/admin/Configuracoes';
import { Relatorios } from './pages/admin/Relatorios';
import { LojaDashboard } from './pages/admin/loja/LojaDashboard';
import { LojaProdutos } from './pages/admin/loja/LojaProdutos';
import { LojaPedidos } from './pages/admin/loja/LojaPedidos';
import { CafeDashboard } from './pages/admin/cafe/CafeDashboard';
import { CafeMensalidades } from './pages/admin/cafe/CafeMensalidades';
import { CafeInsumos } from './pages/admin/cafe/CafeInsumos';
import { CafeAssinantes } from './pages/admin/cafe/CafeAssinantes';
import { XimbocaDashboard } from './pages/admin/ximboca/XimbocaDashboard';
import { XimbocaEventos } from './pages/admin/ximboca/XimbocaEventos';
import { XimbocaEvento } from './pages/admin/ximboca/XimbocaEvento';
import { XimbocaEstoque } from './pages/admin/ximboca/XimbocaEstoque';
import { CafePublico } from './pages/CafePublico';
import { LojaPublica } from './pages/LojaPublica';
import { useAuth } from './hooks/useAuth';
import { useUserAuth } from './hooks/useUserAuth';
import { api } from './services/api';
import { setPixDefaults } from './services/pix';

// Load PIX config once on app start
api.get<Record<string, string>>('/api/config').then(c => {
  setPixDefaults(
    c.pix_guloseimas_chave || '',
    c.pix_guloseimas_nome || '',
    c.pix_guloseimas_cidade || 'ANAPOLIS'
  );
}).catch(() => {});

function AdminGuard({ children }: { children: React.ReactNode }) {
  const { token, checkAuth } = useAuth();
  const [verificando, setVerificando] = useState(true);
  const [autenticado, setAutenticado] = useState(false);

  useEffect(() => {
    if (!token) { setVerificando(false); return; }
    checkAuth().then((ok) => { setAutenticado(ok); setVerificando(false); });
  }, [token, checkAuth]);

  if (verificando) return <div className="text-center py-20 text-gray-400">Verificando...</div>;
  if (!autenticado) return <Navigate to="/admin/login" replace />;
  return <>{children}</>;
}

// Auto-check user auth on app start
function UserAuthLoader() {
  const { token, checkAuth } = useUserAuth();
  useEffect(() => {
    if (token) checkAuth();
  }, []);
  return null;
}

export function App() {
  return (
    <BrowserRouter>
      <UserAuthLoader />
      <Routes>
        {/* Public */}
        <Route path="/" element={<Home />} />
        <Route path="/catalogo/:categoria" element={<Catalogo />} />
        <Route path="/checkout" element={<Checkout />} />
        <Route path="/pix/:pedidoId" element={<PixPage />} />
        <Route path="/obrigado" element={<Obrigado />} />
        <Route path="/loja" element={<LojaPublica />} />
        <Route path="/cafe" element={<CafePublico />} />
        {/* User auth */}
        <Route path="/login" element={<UserLogin />} />
        <Route path="/cadastro" element={<UserCadastro />} />
        <Route path="/perfil" element={<Perfil />} />
        {/* Admin */}
        <Route path="/admin/login" element={<Login />} />
        <Route path="/admin" element={<AdminGuard><Dashboard /></AdminGuard>} />
        <Route path="/admin/produtos" element={<AdminGuard><Produtos /></AdminGuard>} />
        <Route path="/admin/clientes" element={<AdminGuard><Clientes /></AdminGuard>} />
        <Route path="/admin/clientes/:id" element={<AdminGuard><ClienteExtrato /></AdminGuard>} />
        <Route path="/admin/pedidos" element={<AdminGuard><Pedidos /></AdminGuard>} />
        <Route path="/admin/config" element={<AdminGuard><Configuracoes /></AdminGuard>} />
        <Route path="/admin/relatorios" element={<AdminGuard><Relatorios /></AdminGuard>} />
        <Route path="/admin/loja" element={<AdminGuard><LojaDashboard /></AdminGuard>} />
        <Route path="/admin/loja/produtos" element={<AdminGuard><LojaProdutos /></AdminGuard>} />
        <Route path="/admin/loja/pedidos" element={<AdminGuard><LojaPedidos /></AdminGuard>} />
        <Route path="/admin/cafe" element={<AdminGuard><CafeDashboard /></AdminGuard>} />
        <Route path="/admin/cafe/mensalidades" element={<AdminGuard><CafeMensalidades /></AdminGuard>} />
        <Route path="/admin/cafe/insumos" element={<AdminGuard><CafeInsumos /></AdminGuard>} />
        <Route path="/admin/cafe/assinantes" element={<AdminGuard><CafeAssinantes /></AdminGuard>} />
        <Route path="/admin/ximboca" element={<AdminGuard><XimbocaDashboard /></AdminGuard>} />
        <Route path="/admin/ximboca/eventos" element={<AdminGuard><XimbocaEventos /></AdminGuard>} />
        <Route path="/admin/ximboca/eventos/:id" element={<AdminGuard><XimbocaEvento /></AdminGuard>} />
        <Route path="/admin/ximboca/estoque" element={<AdminGuard><XimbocaEstoque /></AdminGuard>} />
      </Routes>
    </BrowserRouter>
  );
}
```

- [ ] **Step 2: Commit**

```bash
git add app/src/App.tsx
git commit -m "feat: add user auth routes and auto-check on app start"
```

---

## Task 16: Sidebar Responsive CSS + Header Adjustment

**Files:**
- Modify: `app/src/components/AppLayout.tsx`

- [ ] **Step 1: Add dynamic sidebar width tracking**

The sidebar width needs to adjust the header and main content. The `AppLayout` already uses `lg:pl-16` which accounts for the collapsed sidebar (64px = w-16). When the sidebar is expanded (w-64 = 256px), we need `lg:pl-64`.

Update `AppLayout.tsx` to read sidebar collapsed state from localStorage and adjust padding:

Add to `AppLayout` function, before the return:

```typescript
const [sidebarCollapsed, setSidebarCollapsed] = useState(() => localStorage.getItem('sidebar_collapsed') === 'true');

// Listen for sidebar collapse changes
useEffect(() => {
  const handleStorage = () => {
    setSidebarCollapsed(localStorage.getItem('sidebar_collapsed') === 'true');
  };
  window.addEventListener('storage', handleStorage);
  // Also poll for same-tab changes
  const interval = setInterval(() => {
    const current = localStorage.getItem('sidebar_collapsed') === 'true';
    setSidebarCollapsed(prev => prev !== current ? current : prev);
  }, 200);
  return () => { window.removeEventListener('storage', handleStorage); clearInterval(interval); };
}, []);

const sidebarPl = sidebarCollapsed ? 'lg:pl-16' : 'lg:pl-64';
```

Then replace the hardcoded `lg:pl-16` in header, main, and footer with `${sidebarPl}`:

```
<header className={`... ${sidebarPl}`} ...>
<main className={`${sidebarPl} transition-all duration-300`}>
<footer className={`${sidebarPl} ...`}>
```

- [ ] **Step 2: Commit**

```bash
git add app/src/components/AppLayout.tsx
git commit -m "feat: dynamic sidebar width tracking in AppLayout"
```

---

## Task 17: Remove Old Layout Components

**Files:**
- Modify: `app/src/components/Layout.tsx`

- [ ] **Step 1: Verify no imports remain**

```bash
grep -r "from.*Layout'" app/src/pages/ --include="*.tsx" | grep -v AppLayout
```

If any results, fix those imports first.

- [ ] **Step 2: Delete or gut Layout.tsx**

Since Layout.tsx exports `PublicLayout` and `AdminLayout`, and all pages now use `AppLayout`, we can remove the file. But first verify:

```bash
grep -r "Layout" app/src/ --include="*.tsx" --include="*.ts" | grep -v AppLayout | grep -v node_modules
```

If only `Layout.tsx` itself shows up, delete it:

```bash
rm app/src/components/Layout.tsx
```

- [ ] **Step 3: Commit**

```bash
git add -A
git commit -m "refactor: remove old PublicLayout and AdminLayout"
```

---

## Task 18: Deploy and Test

- [ ] **Step 1: Run the D1 migration**

```bash
cd worker
npx wrangler d1 execute senta-pua-db --remote --file=src/db/migrations/011_usuarios.sql
```

- [ ] **Step 2: Build frontend to check for TypeScript errors**

```bash
cd app
npm run build
```

Fix any type errors that come up.

- [ ] **Step 3: Deploy worker**

```bash
cd worker
npx wrangler deploy
```

- [ ] **Step 4: Test locally**

```bash
cd app
npm run dev
```

Test these flows:
1. Visit home page — sidebar visible, no login required
2. Click "Entrar / Cadastrar" in sidebar
3. Register new account with email, senha, trigrama, saram, whatsapp
4. After register, sidebar shows "Meu Perfil" and "Sair"
5. Add items to cart, go to checkout — sees trigrama auto-filled
6. Complete a PIX order
7. Go to profile, change photo and whatsapp
8. Logout and login again
9. Test admin login at /admin/login — admin sidebar with all systems
10. Test sidebar collapse/expand on desktop
11. Test mobile hamburger menu

- [ ] **Step 5: Final commit and push**

```bash
git add -A
git commit -m "feat: user auth + sidebar + unified layout complete"
git push
```
