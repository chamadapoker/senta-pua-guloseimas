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

export function gerarPayloadPix(valor?: number, opcoes?: { chave?: string; nome?: string; cidade?: string }): string {
  const gui = tlv('00', 'br.gov.bcb.pix');
  const key = tlv('01', opcoes?.chave || PIX_KEY);
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
