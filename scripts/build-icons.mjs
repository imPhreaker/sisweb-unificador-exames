// SPDX-License-Identifier: GPL-3.0-or-later
// Gera os ícones da extensão (icons/icon-*.png e icons/icon.svg) sem
// dependências externas: as formas são desenhadas com superamostragem e o PNG
// é codificado com o zlib do Node. Rode com: npm run icons
import { mkdirSync, writeFileSync } from 'node:fs';
import { deflateSync } from 'node:zlib';

// Desenho em uma grade de 128 × 128. Verde-petróleo semelhante ao do SISweb,
// páginas de documento e um botão "+" em destaque.
const TEAL = [0, 102, 102];
const TEAL_LIGHT = [11, 122, 114];
const PAGE_BACK = [190, 226, 222];
const PAGE = [255, 255, 255];
const LINE = [0, 102, 102];
const BADGE = [245, 166, 35];
const WHITE = [255, 255, 255];

const roundRect = (x0, y0, x1, y1, r) => (x, y) => {
  const cx = Math.min(Math.max(x, x0 + r), x1 - r);
  const cy = Math.min(Math.max(y, y0 + r), y1 - r);
  return (x - cx) ** 2 + (y - cy) ** 2 <= r * r && x >= x0 && x <= x1 && y >= y0 && y <= y1;
};
const circle = (cx, cy, r) => (x, y) => (x - cx) ** 2 + (y - cy) ** 2 <= r * r;
const union = (...shapes) => (x, y) => shapes.some((shape) => shape(x, y));

// Camadas na ordem de pintura; a cor pode depender da posição (degradê).
const layers = [
  { shape: roundRect(0, 0, 128, 128, 28), color: (x, y) => mix(TEAL_LIGHT, TEAL, y / 128) },
  { shape: roundRect(22, 16, 78, 88, 7), color: PAGE_BACK },
  { shape: roundRect(34, 28, 90, 100, 7), color: PAGE },
  { shape: roundRect(44, 46, 80, 52, 3), color: LINE },
  { shape: roundRect(44, 58, 80, 64, 3), color: LINE },
  { shape: roundRect(44, 70, 66, 76, 3), color: LINE },
  { shape: circle(94, 94, 30), color: WHITE },
  { shape: circle(94, 94, 25), color: BADGE },
  { shape: union(roundRect(90, 79, 98, 109, 3), roundRect(79, 90, 109, 98, 3)), color: WHITE }
];

function mix(a, b, t) {
  return a.map((value, index) => value + (b[index] - value) * t);
}

function render(size) {
  const samples = 4;
  const scale = 128 / size;
  const pixels = Buffer.alloc(size * size * 4);
  for (let py = 0; py < size; py += 1) {
    for (let px = 0; px < size; px += 1) {
      let r = 0;
      let g = 0;
      let b = 0;
      let a = 0;
      for (let sy = 0; sy < samples; sy += 1) {
        for (let sx = 0; sx < samples; sx += 1) {
          const x = (px + (sx + 0.5) / samples) * scale;
          const y = (py + (sy + 0.5) / samples) * scale;
          let color;
          for (const layer of layers) {
            if (layer.shape(x, y)) color = typeof layer.color === 'function' ? layer.color(x, y) : layer.color;
          }
          if (!color) continue;
          r += color[0];
          g += color[1];
          b += color[2];
          a += 1;
        }
      }
      const offset = (py * size + px) * 4;
      if (a) {
        pixels[offset] = Math.round(r / a);
        pixels[offset + 1] = Math.round(g / a);
        pixels[offset + 2] = Math.round(b / a);
      }
      pixels[offset + 3] = Math.round((a / (samples * samples)) * 255);
    }
  }
  return encodePng(size, pixels);
}

const CRC_TABLE = Array.from({ length: 256 }, (_, n) => {
  let c = n;
  for (let k = 0; k < 8; k += 1) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
  return c >>> 0;
});

function crc32(buffer) {
  let crc = 0xffffffff;
  for (const byte of buffer) crc = CRC_TABLE[(crc ^ byte) & 0xff] ^ (crc >>> 8);
  return (crc ^ 0xffffffff) >>> 0;
}

function chunk(type, data) {
  const length = Buffer.alloc(4);
  length.writeUInt32BE(data.length);
  const body = Buffer.concat([Buffer.from(type, 'ascii'), data]);
  const crc = Buffer.alloc(4);
  crc.writeUInt32BE(crc32(body));
  return Buffer.concat([length, body, crc]);
}

function encodePng(size, pixels) {
  const header = Buffer.alloc(13);
  header.writeUInt32BE(size, 0);
  header.writeUInt32BE(size, 4);
  header[8] = 8; // bits por canal
  header[9] = 6; // RGBA
  const rows = Buffer.alloc((size * 4 + 1) * size);
  for (let y = 0; y < size; y += 1) {
    pixels.copy(rows, y * (size * 4 + 1) + 1, y * size * 4, (y + 1) * size * 4);
  }
  return Buffer.concat([
    Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
    chunk('IHDR', header),
    chunk('IDAT', deflateSync(rows, { level: 9 })),
    chunk('IEND', Buffer.alloc(0))
  ]);
}

const hex = (color) => `#${color.map((value) => Math.round(value).toString(16).padStart(2, '0')).join('')}`;
const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 128 128" role="img" aria-label="SISWeb Unificador de Exames">
  <defs>
    <linearGradient id="bg" x1="0" y1="0" x2="0" y2="1">
      <stop offset="0" stop-color="${hex(TEAL_LIGHT)}"/>
      <stop offset="1" stop-color="${hex(TEAL)}"/>
    </linearGradient>
  </defs>
  <rect width="128" height="128" rx="28" fill="url(#bg)"/>
  <rect x="22" y="16" width="56" height="72" rx="7" fill="${hex(PAGE_BACK)}"/>
  <rect x="34" y="28" width="56" height="72" rx="7" fill="${hex(PAGE)}"/>
  <rect x="44" y="46" width="36" height="6" rx="3" fill="${hex(LINE)}"/>
  <rect x="44" y="58" width="36" height="6" rx="3" fill="${hex(LINE)}"/>
  <rect x="44" y="70" width="22" height="6" rx="3" fill="${hex(LINE)}"/>
  <circle cx="94" cy="94" r="30" fill="${hex(WHITE)}"/>
  <circle cx="94" cy="94" r="25" fill="${hex(BADGE)}"/>
  <rect x="90" y="79" width="8" height="30" rx="3" fill="${hex(WHITE)}"/>
  <rect x="79" y="90" width="30" height="8" rx="3" fill="${hex(WHITE)}"/>
</svg>
`;

mkdirSync('icons', { recursive: true });
for (const size of [16, 32, 48, 128]) writeFileSync(`icons/icon-${size}.png`, render(size));
writeFileSync('icons/icon.svg', svg);
console.log('Ícones gerados em icons/');
