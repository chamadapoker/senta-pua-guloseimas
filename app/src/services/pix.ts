let PIX_KEY = '';
let MERCHANT_NAME = '';
let MERCHANT_CITY = '';

export function setPixDefaults(chave: string, nome: string, cidade: string) {
  PIX_KEY = chave;
  MERCHANT_NAME = nome;
  MERCHANT_CITY = cidade;
}

// Nome/cidade do recebedor no BR Code: sem acentos, maiúsculas, só [A-Z0-9 ].
// Bancos rejeitam (ou calculam errado) payloads com acento/caracteres especiais,
// e o padrão limita nome a 25 e cidade a 15 caracteres.
function normalizarCampoPix(valor: string, max: number): string {
  return (valor || '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toUpperCase()
    .replace(/[^A-Z0-9 ]/g, '')
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, max)
    .trim();
}

// A chave vai no QR exatamente como o banco a procura no DICT; qualquer diferença vira
// "chave não encontrada". Formatos oficiais: telefone +55DDDNUMERO, CPF/CNPJ só dígitos,
// e-mail e chave aleatória em minúsculas. O admin digita a chave à mão (ex.: "(55) 99999-8888"),
// então normalizamos aqui, na hora de gerar, e os eventos já cadastrados passam a funcionar.
export type TipoChavePix = 'cpf' | 'cnpj' | 'email' | 'telefone' | 'aleatoria';

export function normalizarChavePix(chave: string, tipo?: string | null): string {
  const limpa = (chave || '').replace(/[\s ​-‍﻿]/g, '');
  if (!limpa) return '';
  const digitos = limpa.replace(/\D/g, '');
  const t = (tipo || '').toLowerCase();

  if (t === 'email' || limpa.includes('@')) return limpa.toLowerCase();
  if (t === 'aleatoria' || /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(limpa)) return limpa.toLowerCase();
  if (t === 'cpf' || t === 'cnpj') return digitos;
  if (t === 'telefone' || limpa.startsWith('+')) {
    // Aceita "55 99999-8888", "(55) 99999-8888", "5555999998888" e "+55 55 99999-8888"
    const semPais = digitos.length >= 12 && digitos.startsWith('55') ? digitos.slice(2) : digitos;
    return `+55${semPais}`;
  }
  // Sem tipo informado: CPF/CNPJ com pontuação viram só dígitos; o resto fica como está
  if (/^\d{3}\.?\d{3}\.?\d{3}-?\d{2}$/.test(limpa) || /^\d{2}\.?\d{3}\.?\d{3}\/?\d{4}-?\d{2}$/.test(limpa)) return digitos;
  return limpa;
}

function tlv(id: string, value: string): string {
  const len = value.length.toString().padStart(2, '0');
  return `${id}${len}${value}`;
}

function crc16(payload: string): string {
  const polynomial = 0x1021;
  let crc = 0xffff;
  for (let i = 0; i < payload.length; i++) {
    crc ^= payload.charCodeAt(i) << 8;
    for (let j = 0; j < 8; j++) {
      if (crc & 0x8000) {
        crc = ((crc << 1) ^ polynomial) & 0xffff;
      } else {
        crc = (crc << 1) & 0xffff;
      }
    }
  }
  return crc.toString(16).toUpperCase().padStart(4, '0');
}

export function gerarPayloadPix(valor?: number, opcoes?: { chave?: string; nome?: string; cidade?: string; tipo?: string | null }): string {
  const gui = tlv('00', 'br.gov.bcb.pix');
  const key = tlv('01', normalizarChavePix(opcoes?.chave || PIX_KEY, opcoes?.tipo));
  const merchantAccount = tlv('26', gui + key);

  let payload = '';
  payload += tlv('00', '01');                   // Payload Format Indicator
  payload += merchantAccount;                    // Merchant Account (PIX)
  payload += tlv('52', '0000');                  // Merchant Category Code
  payload += tlv('53', '986');                   // Transaction Currency (BRL)

  if (valor && valor > 0) {
    payload += tlv('54', valor.toFixed(2));       // Transaction Amount
  }

  payload += tlv('58', 'BR');                    // Country Code
  payload += tlv('59', normalizarCampoPix(opcoes?.nome || MERCHANT_NAME, 25));   // Merchant Name
  payload += tlv('60', (normalizarCampoPix(opcoes?.cidade || MERCHANT_CITY, 15) || 'ANAPOLIS')); // Merchant City (campo obrigatório)

  // Additional Data Field com txid
  const txid = tlv('05', '***');
  payload += tlv('62', txid);

  // CRC16 placeholder + cálculo
  payload += '6304';
  const checksum = crc16(payload);
  payload += checksum;

  return payload;
}
