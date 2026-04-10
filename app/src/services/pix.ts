const PIX_KEY = 'sandraobregon12@gmail.com';
const MERCHANT_NAME = 'SENTA PUA GULOSEIMAS';
const MERCHANT_CITY = 'ANAPOLIS';

function tlv(id: string, value: string): string {
  const len = value.length.toString().padStart(2, '0');
  return `${id}${len}${value}`;
}

function crc16(payload: string): string {
  const polynomial = 0x1021;
  let crc = 0xffff;
  const bytes = new TextEncoder().encode(payload);
  for (const byte of bytes) {
    crc ^= byte << 8;
    for (let i = 0; i < 8; i++) {
      if (crc & 0x8000) {
        crc = ((crc << 1) ^ polynomial) & 0xffff;
      } else {
        crc = (crc << 1) & 0xffff;
      }
    }
  }
  return crc.toString(16).toUpperCase().padStart(4, '0');
}

export function gerarPayloadPix(valor?: number): string {
  const gui = tlv('00', 'br.gov.bcb.pix');
  const key = tlv('01', PIX_KEY);
  const merchantAccount = tlv('26', gui + key);

  let payload = '';
  payload += tlv('00', '01');
  payload += merchantAccount;
  payload += tlv('52', '0000');
  payload += tlv('53', '986');

  if (valor && valor > 0) {
    payload += tlv('54', valor.toFixed(2));
  }

  payload += tlv('58', 'BR');
  payload += tlv('59', MERCHANT_NAME);
  payload += tlv('60', MERCHANT_CITY);

  payload += '6304';
  const checksum = crc16(payload);
  payload += checksum;

  return payload;
}
