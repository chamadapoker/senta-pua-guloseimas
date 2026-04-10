const PIX_KEY = 'sandraobregon12@gmail.com';
const MERCHANT_NAME = 'SENTA PUA GULOSE';  // max 25 chars, sem acento
const MERCHANT_CITY = 'ANAPOLIS';

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

export function gerarPayloadPix(valor?: number): string {
  const gui = tlv('00', 'br.gov.bcb.pix');
  const key = tlv('01', PIX_KEY);
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
  payload += tlv('59', MERCHANT_NAME);           // Merchant Name
  payload += tlv('60', MERCHANT_CITY);           // Merchant City

  // Additional Data Field com txid
  const txid = tlv('05', '***');
  payload += tlv('62', txid);

  // CRC16 placeholder + cálculo
  payload += '6304';
  const checksum = crc16(payload);
  payload += checksum;

  return payload;
}
