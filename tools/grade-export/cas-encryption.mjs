import { createCipheriv } from 'node:crypto';

// UJN tpass strEnc uses UTF-16 blocks and a transposed PC-1, rather than
// standard DES PC-1. Remap the key bits before using native DES (EDE K,K,K).
// Verified against public /tpass/comm/js/des.js on 2026-10-08.
const STANDARD_PC1 = [
  57,49,41,33,25,17,9,1,58,50,42,34,26,18,10,2,59,51,43,35,27,19,11,3,60,52,44,36,
  63,55,47,39,31,23,15,7,62,54,46,38,30,22,14,6,61,53,45,37,29,21,13,5,28,20,12,4,
];

function utf16Block(text) {
  const buffer = Buffer.alloc(8);
  for (let i = 0; i < text.length; i++) buffer.writeUInt16BE(text.charCodeAt(i), i * 2);
  return buffer;
}

function transposedKey(text) {
  const source = utf16Block(text);
  const key = Buffer.alloc(8);
  const transpose = [];
  for (let column = 0; column < 7; column++) {
    for (let row = 7; row >= 0; row--) transpose.push(8 * row + column);
  }
  for (let i = 0; i < 56; i++) {
    const bit = (source[transpose[i] >> 3] >> (7 - (transpose[i] % 8))) & 1;
    const position = STANDARD_PC1[i] - 1;
    key[position >> 3] |= bit << (7 - (position % 8));
  }
  return Buffer.concat([key, key, key]);
}

const CAS_KEYS = ['1', '2', '3'].map(transposedKey);

/** Browser-compatible UJN CAS strEnc(user + password + lt, '1', '2', '3'). */
export function encryptCas(text) {
  let output = '';
  for (let offset = 0; offset < text.length; offset += 4) {
    let block = utf16Block(text.slice(offset, offset + 4));
    for (const key of CAS_KEYS) {
      const cipher = createCipheriv('des-ede3', key, null);
      cipher.setAutoPadding(false);
      block = Buffer.concat([cipher.update(block), cipher.final()]);
    }
    output += block.toString('hex').toUpperCase();
  }
  return output;
}
