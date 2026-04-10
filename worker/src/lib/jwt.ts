const encoder = new TextEncoder();

async function getKey(secret: string): Promise<CryptoKey> {
  return crypto.subtle.importKey(
    'raw',
    encoder.encode(secret),
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign', 'verify']
  );
}

function base64url(data: ArrayBuffer | Uint8Array): string {
  const bytes = data instanceof Uint8Array ? data : new Uint8Array(data);
  let binary = '';
  for (const b of bytes) binary += String.fromCharCode(b);
  return btoa(binary).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

function base64urlDecode(str: string): Uint8Array {
  const padded = str.replace(/-/g, '+').replace(/_/g, '/');
  const binary = atob(padded);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
  return bytes;
}

export async function sign(payload: Record<string, unknown>, secret: string, expiresInHours = 8): Promise<string> {
  const header = { alg: 'HS256', typ: 'JWT' };
  const now = Math.floor(Date.now() / 1000);
  const body = { ...payload, iat: now, exp: now + expiresInHours * 3600 };

  const headerB64 = base64url(encoder.encode(JSON.stringify(header)));
  const bodyB64 = base64url(encoder.encode(JSON.stringify(body)));
  const message = `${headerB64}.${bodyB64}`;

  const key = await getKey(secret);
  const signature = await crypto.subtle.sign('HMAC', key, encoder.encode(message));

  return `${message}.${base64url(signature)}`;
}

export async function verify(token: string, secret: string): Promise<Record<string, unknown> | null> {
  const parts = token.split('.');
  if (parts.length !== 3) return null;

  const [headerB64, bodyB64, signatureB64] = parts;
  const message = `${headerB64}.${bodyB64}`;

  const key = await getKey(secret);
  const signature = base64urlDecode(signatureB64);
  const valid = await crypto.subtle.verify('HMAC', key, signature, encoder.encode(message));

  if (!valid) return null;

  const payload = JSON.parse(new TextDecoder().decode(base64urlDecode(bodyB64)));
  if (payload.exp && payload.exp < Math.floor(Date.now() / 1000)) return null;

  return payload;
}
