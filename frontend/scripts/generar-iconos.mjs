/**
 * Genera los iconos PNG de la PWA sin dependencias externas.
 *
 *   node scripts/generar-iconos.mjs
 *
 * Se rasteriza a mano y se comprime con el zlib de Node. La alternativa
 * habitual (@vite-pwa/assets-generator) arrastra `sharp`, un binario nativo
 * de ~30 MB, que para cuatro iconos planos no se justifica.
 *
 * Cuando exista el logo real de la clinica, reemplazar los PNG de public/
 * por los definitivos y borrar este script.
 */

import { deflateSync } from 'node:zlib';
import { writeFileSync, mkdirSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const raiz = join(dirname(fileURLToPath(import.meta.url)), '..');
const salida = join(raiz, 'public');

// Paleta: debe coincidir con theme_color del manifest.
const FONDO = [13, 148, 136];      // teal-600
const BLANCO = [255, 255, 255];

/** CRC32 sobre un Buffer, requerido por el formato PNG. */
const tablaCrc = (() => {
  const t = new Int32Array(256);
  for (let n = 0; n < 256; n++) {
    let c = n;
    for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    t[n] = c;
  }
  return t;
})();

function crc32(buf) {
  let c = -1;
  for (let i = 0; i < buf.length; i++) c = tablaCrc[(c ^ buf[i]) & 0xff] ^ (c >>> 8);
  return (c ^ -1) >>> 0;
}

function chunk(tipo, datos) {
  const largo = Buffer.alloc(4);
  largo.writeUInt32BE(datos.length);
  const cuerpo = Buffer.concat([Buffer.from(tipo, 'ascii'), datos]);
  const crc = Buffer.alloc(4);
  crc.writeUInt32BE(crc32(cuerpo));
  return Buffer.concat([largo, cuerpo, crc]);
}

/** Codifica un buffer RGBA (size x size) como PNG. */
function png(size, rgba) {
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(size, 0);
  ihdr.writeUInt32BE(size, 4);
  ihdr[8] = 8;   // profundidad de bits
  ihdr[9] = 6;   // color type: RGBA
  ihdr[10] = 0;  // compresion deflate
  ihdr[11] = 0;  // filtro adaptativo
  ihdr[12] = 0;  // sin entrelazado

  // Cada fila lleva un byte de filtro al inicio (0 = None).
  const conFiltro = Buffer.alloc((size * 4 + 1) * size);
  for (let y = 0; y < size; y++) {
    conFiltro[y * (size * 4 + 1)] = 0;
    rgba.copy(conFiltro, y * (size * 4 + 1) + 1, y * size * 4, (y + 1) * size * 4);
  }

  return Buffer.concat([
    Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
    chunk('IHDR', ihdr),
    chunk('IDAT', deflateSync(conFiltro, { level: 9 })),
    chunk('IEND', Buffer.alloc(0)),
  ]);
}

/**
 * Dibuja el icono: cruz medica blanca sobre fondo teal, con una huella
 * de mascota debajo.
 *
 * @param {number} size    lado en pixeles
 * @param {boolean} maskable  deja margen del 20% (safe zone de Android, que
 *                            recorta el icono en circulo)
 */
function dibujar(size, maskable = false) {
  const buf = Buffer.alloc(size * size * 4);
  const c = size / 2;
  // En modo maskable todo el contenido se encoge para sobrevivir al recorte.
  const escala = maskable ? 0.6 : 0.78;
  const radioFondo = maskable ? size : size * 0.22; // esquinas redondeadas

  const pintar = (x, y, color) => {
    const i = (y * size + x) * 4;
    buf[i] = color[0];
    buf[i + 1] = color[1];
    buf[i + 2] = color[2];
    buf[i + 3] = 255;
  };

  const dentroRedondeado = (x, y) => {
    if (maskable) return true; // fondo completo: el launcher recorta
    const r = radioFondo;
    const dx = Math.min(x, size - 1 - x);
    const dy = Math.min(y, size - 1 - y);
    if (dx >= r || dy >= r) return true;
    return (r - dx) ** 2 + (r - dy) ** 2 <= r * r;
  };

  // Fondo
  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      if (dentroRedondeado(x, y)) pintar(x, y, FONDO);
    }
  }

  // Cruz medica (parte superior)
  const cy = c - size * 0.08 * (maskable ? 0.8 : 1);
  const brazo = size * 0.30 * escala;
  const grosor = size * 0.105 * escala;

  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      const dx = Math.abs(x - c);
      const dy = Math.abs(y - cy);
      const horizontal = dx <= brazo && dy <= grosor;
      const vertical = dy <= brazo && dx <= grosor;
      if (horizontal || vertical) pintar(x, y, BLANCO);
    }
  }

  // Huella: almohadilla central + cuatro dedos
  const hy = c + size * 0.30 * escala;
  const rPad = size * 0.085 * escala;
  const rDedo = size * 0.045 * escala;

  const circulo = (px, py, r) => {
    for (let y = Math.max(0, Math.floor(py - r)); y < Math.min(size, Math.ceil(py + r)); y++) {
      for (let x = Math.max(0, Math.floor(px - r)); x < Math.min(size, Math.ceil(px + r)); x++) {
        if ((x - px) ** 2 + (y - py) ** 2 <= r * r) pintar(x, y, BLANCO);
      }
    }
  };

  circulo(c, hy + rPad * 0.5, rPad);
  const sep = size * 0.075 * escala;
  circulo(c - sep * 1.7, hy - rPad * 0.8, rDedo);
  circulo(c - sep * 0.6, hy - rPad * 1.25, rDedo);
  circulo(c + sep * 0.6, hy - rPad * 1.25, rDedo);
  circulo(c + sep * 1.7, hy - rPad * 0.8, rDedo);

  return png(size, buf);
}

mkdirSync(salida, { recursive: true });

const archivos = [
  ['pwa-64x64.png', dibujar(64)],
  ['pwa-192x192.png', dibujar(192)],
  ['pwa-512x512.png', dibujar(512)],
  ['pwa-maskable-512x512.png', dibujar(512, true)],
  ['apple-touch-icon.png', dibujar(180, true)],
  ['favicon.ico', dibujar(48)], // PNG con extension .ico: los navegadores actuales lo aceptan
];

for (const [nombre, datos] of archivos) {
  writeFileSync(join(salida, nombre), datos);
  console.log(`  ${nombre.padEnd(28)} ${(datos.length / 1024).toFixed(1)} KB`);
}

console.log(`\n${archivos.length} iconos generados en public/`);
