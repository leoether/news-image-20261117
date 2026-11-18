// news-image-20261117 — "The World in One Day: Tuesday, 17 November 2026"
// A Node 22, standard-library-only program that draws one 1024x1024 PNG
// summarising the real world news of 17 November 2026 and writes it to
// /output/entry.png (or $MAKEFUN_OUTPUT_DIR/entry.png).
// No network, no randomness, no clock: two runs write byte-identical files.
//
// The six stories (each verified against reporting published 17 Nov 2026):
//   1. Ukraine strikes the Kerch Bridge to Crimea; a road span collapses.
//      Russian missiles hit Kyiv's bridges over the Dnipro the same day.
//   2. Two oil tankers strike mines and catch fire near the Strait of Hormuz.
//   3. China confirms a first three-way Xi-Trump-Putin meeting, set for
//      Thursday 19 Nov in Shenzhen, on the APEC sidelines.
//   4. Japan scrambles fighter jets after suspected Russian aircraft
//      violate its airspace; Tokyo protests strongly.
//   5. A JPMorgan software bug disrupts online banking and Zelle payments.
//   6. A ULA Vulcan rocket failure destroys 40 Amazon satellites.
// Footer: Depardieu admits a sexual-assault charge; Mongolia's president
// says he will resign; the US loses measles-elimination status; at least
// 17 people are killed in two shootings in South Africa.

import { deflateSync } from 'node:zlib';
import { mkdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';

// ---------------------------------------------------------------- PNG out
const W = 1024;
const H = 1024;

const CRC_TABLE = (() => {
  const t = new Int32Array(256);
  for (let n = 0; n < 256; n++) {
    let c = n;
    for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    t[n] = c;
  }
  return t;
})();

function crc32(buf: Buffer): number {
  let c = 0xffffffff;
  for (let i = 0; i < buf.length; i++) c = CRC_TABLE[(c ^ buf[i]) & 0xff] ^ (c >>> 8);
  return (c ^ 0xffffffff) >>> 0;
}

function chunk(type: string, data: Buffer): Buffer {
  const len = Buffer.alloc(4);
  len.writeUInt32BE(data.length, 0);
  const td = Buffer.concat([Buffer.from(type, 'ascii'), data]);
  const crc = Buffer.alloc(4);
  crc.writeUInt32BE(crc32(td), 0);
  return Buffer.concat([len, td, crc]);
}

function encodePNG(rgba: Buffer, w: number, h: number): Buffer {
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(w, 0);
  ihdr.writeUInt32BE(h, 4);
  ihdr[8] = 8; // bit depth
  ihdr[9] = 6; // colour type RGBA
  const raw = Buffer.alloc((w * 4 + 1) * h);
  for (let y = 0; y < h; y++) {
    raw[y * (w * 4 + 1)] = 0; // filter: none
    rgba.copy(raw, y * (w * 4 + 1) + 1, y * w * 4, (y + 1) * w * 4);
  }
  const sig = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);
  return Buffer.concat([sig, chunk('IHDR', ihdr), chunk('IDAT', deflateSync(raw, { level: 9 })), chunk('IEND', Buffer.alloc(0))]);
}

// ---------------------------------------------------------------- canvas
type RGB = [number, number, number];

class Canvas {
  buf: Buffer;
  w: number;
  h: number;
  constructor(w: number, h: number) {
    this.w = w;
    this.h = h;
    this.buf = Buffer.alloc(w * h * 4, 255);
  }
  px(x: number, y: number, c: RGB): void {
    if (x < 0 || y < 0 || x >= this.w || y >= this.h) return;
    const i = (y * this.w + x) * 4;
    this.buf[i] = c[0]; this.buf[i + 1] = c[1]; this.buf[i + 2] = c[2];
  }
  rect(x: number, y: number, w: number, h: number, c: RGB): void {
    for (let yy = y; yy < y + h; yy++) for (let xx = x; xx < x + w; xx++) this.px(xx, yy, c);
  }
  border(x: number, y: number, w: number, h: number, t: number, c: RGB): void {
    this.rect(x, y, w, t, c);
    this.rect(x, y + h - t, w, t, c);
    this.rect(x, y, t, h, c);
    this.rect(x + w - t, y, t, h, c);
  }
  hline(x0: number, x1: number, y: number, t: number, c: RGB): void {
    this.rect(Math.min(x0, x1), y, Math.abs(x1 - x0) + 1, t, c);
  }
  vline(x: number, y0: number, y1: number, t: number, c: RGB): void {
    this.rect(x, Math.min(y0, y1), t, Math.abs(y1 - y0) + 1, c);
  }
  line(x0: number, y0: number, x1: number, y1: number, t: number, c: RGB): void {
    const dx = Math.abs(x1 - x0), dy = -Math.abs(y1 - y0);
    const sx = x0 < x1 ? 1 : -1, sy = y0 < y1 ? 1 : -1;
    let err = dx + dy, x = x0, y = y0;
    const r = Math.floor(t / 2);
    for (;;) {
      for (let a = -r; a <= r; a++) for (let b = -r; b <= r; b++) this.px(x + a, y + b, c);
      if (x === x1 && y === y1) break;
      const e2 = 2 * err;
      if (e2 >= dy) { err += dy; x += sx; }
      if (e2 <= dx) { err += dx; y += sy; }
    }
  }
  circle(cx: number, cy: number, r: number, c: RGB): void {
    for (let y = -r; y <= r; y++) {
      const half = Math.floor(Math.sqrt(r * r - y * y));
      for (let x = -half; x <= half; x++) this.px(cx + x, cy + y, c);
    }
  }
  ring(cx: number, cy: number, r: number, t: number, c: RGB): void {
    for (let a = 0; a < 360; a++) {
      const rad = (a * Math.PI) / 180;
      for (let d = 0; d < t; d++) {
        this.px(Math.round(cx + (r - d) * Math.cos(rad)), Math.round(cy + (r - d) * Math.sin(rad)), c);
      }
    }
  }
  tri(x0: number, y0: number, x1: number, y1: number, x2: number, y2: number, c: RGB): void {
    const minX = Math.min(x0, x1, x2), maxX = Math.max(x0, x1, x2);
    const minY = Math.min(y0, y1, y2), maxY = Math.max(y0, y1, y2);
    const d = (y1 - y2) * (x0 - x2) + (x2 - x1) * (y0 - y2);
    if (d === 0) return;
    for (let y = minY; y <= maxY; y++) {
      for (let x = minX; x <= maxX; x++) {
        const a = ((y1 - y2) * (x - x2) + (x2 - x1) * (y - y2)) / d;
        const b = ((y2 - y0) * (x - x2) + (x0 - x2) * (y - y2)) / d;
        const g = 1 - a - b;
        if (a >= 0 && b >= 0 && g >= 0) this.px(x, y, c);
      }
    }
  }
  // 5x7 bitmap font, uppercase only (all copy is set in caps).
  text(s: string, x: number, y: number, scale: number, c: RGB): number {
    let cx = x;
    for (const ch of s) {
      const g = FONT[ch] ?? FONT['?'];
      for (let r = 0; r < 7; r++) {
        const row = g[r];
        for (let col = 0; col < 5; col++) {
          if (row[col] === '#') this.rect(cx + col * scale, y + r * scale, scale, scale, c);
        }
      }
      cx += 6 * scale;
    }
    return cx - x;
  }
  textW(s: string, scale: number): number {
    return s.length * 6 * scale - scale;
  }
  textCentered(s: string, cx: number, y: number, scale: number, c: RGB): void {
    this.text(s, cx - Math.floor(this.textW(s, scale) / 2), y, scale, c);
  }
  // Word-wrap into lines of at most maxW px; returns lines drawn.
  para(s: string, x: number, y: number, maxW: number, scale: number, lh: number, c: RGB): number {
    const words = s.split(' ');
    const lines: string[] = [];
    let cur = '';
    for (const w of words) {
      const trial = cur ? cur + ' ' + w : w;
      if (this.textW(trial, scale) <= maxW || !cur) cur = trial;
      else { lines.push(cur); cur = w; }
    }
    if (cur) lines.push(cur);
    lines.forEach((ln, i) => this.text(ln, x, y + i * lh, scale, c));
    return lines.length;
  }
}

// 5x7 glyphs: 7 rows of 5 cells, '#' = ink.
const FONT: Record<string, string[]> = {
  A: ['.###.', '#...#', '#...#', '#####', '#...#', '#...#', '#...#'],
  B: ['####.', '#...#', '#...#', '####.', '#...#', '#...#', '####.'],
  C: ['.###.', '#...#', '#....', '#....', '#....', '#...#', '.###.'],
  D: ['####.', '#...#', '#...#', '#...#', '#...#', '#...#', '####.'],
  E: ['#####', '#....', '#....', '####.', '#....', '#....', '#####'],
  F: ['#####', '#....', '#....', '####.', '#....', '#....', '#....'],
  G: ['.###.', '#...#', '#....', '#.###', '#...#', '#...#', '.####'],
  H: ['#...#', '#...#', '#...#', '#####', '#...#', '#...#', '#...#'],
  I: ['.###.', '..#..', '..#..', '..#..', '..#..', '..#..', '.###.'],
  J: ['..###', '...#.', '...#.', '...#.', '...#.', '#..#.', '.##..'],
  K: ['#...#', '#..#.', '#.#..', '##...', '#.#..', '#..#.', '#...#'],
  L: ['#....', '#....', '#....', '#....', '#....', '#....', '#####'],
  M: ['#...#', '##.##', '#.#.#', '#.#.#', '#...#', '#...#', '#...#'],
  N: ['#...#', '##..#', '#.#.#', '#..##', '#...#', '#...#', '#...#'],
  O: ['.###.', '#...#', '#...#', '#...#', '#...#', '#...#', '.###.'],
  P: ['####.', '#...#', '#...#', '####.', '#....', '#....', '#....'],
  Q: ['.###.', '#...#', '#...#', '#...#', '#.#.#', '#..#.', '.##.#'],
  R: ['####.', '#...#', '#...#', '####.', '#.#..', '#..#.', '#...#'],
  S: ['.####', '#....', '#....', '.###.', '....#', '....#', '####.'],
  T: ['#####', '..#..', '..#..', '..#..', '..#..', '..#..', '..#..'],
  U: ['#...#', '#...#', '#...#', '#...#', '#...#', '#...#', '.###.'],
  V: ['#...#', '#...#', '#...#', '#...#', '#...#', '.#.#.', '..#..'],
  W: ['#...#', '#...#', '#...#', '#.#.#', '#.#.#', '#.#.#', '.#.#.'],
  X: ['#...#', '#...#', '.#.#.', '..#..', '.#.#.', '#...#', '#...#'],
  Y: ['#...#', '#...#', '.#.#.', '..#..', '..#..', '..#..', '..#..'],
  Z: ['#####', '....#', '...#.', '..#..', '.#...', '#....', '#####'],
  '0': ['.###.', '#...#', '#..##', '#.#.#', '##..#', '#...#', '.###.'],
  '1': ['..#..', '.##..', '..#..', '..#..', '..#..', '..#..', '.###.'],
  '2': ['.###.', '#...#', '....#', '...#.', '..#..', '.#...', '#####'],
  '3': ['#####', '...#.', '..#..', '...#.', '....#', '#...#', '.###.'],
  '4': ['...#.', '..##.', '.#.#.', '#..#.', '#####', '...#.', '...#.'],
  '5': ['#####', '#....', '####.', '....#', '....#', '#...#', '.###.'],
  '6': ['..##.', '.#...', '#....', '####.', '#...#', '#...#', '.###.'],
  '7': ['#####', '....#', '...#.', '..#..', '.#...', '.#...', '.#...'],
  '8': ['.###.', '#...#', '#...#', '.###.', '#...#', '#...#', '.###.'],
  '9': ['.###.', '#...#', '#...#', '.####', '....#', '...#.', '.##..'],
  ' ': ['.....', '.....', '.....', '.....', '.....', '.....', '.....'],
  '.': ['.....', '.....', '.....', '.....', '.....', '.##..', '.##..'],
  ',': ['.....', '.....', '.....', '.....', '.##..', '..#..', '.#...'],
  '-': ['.....', '.....', '.....', '.###.', '.....', '.....', '.....'],
  "'": ['..#..', '..#..', '.#...', '.....', '.....', '.....', '.....'],
  '(': ['...#.', '..#..', '.#...', '.#...', '.#...', '..#..', '...#.'],
  ')': ['.#...', '..#..', '...#.', '...#.', '...#.', '..#..', '.#...'],
  '/': ['....#', '...#.', '...#.', '..#..', '.#...', '.#...', '#....'],
  '&': ['.##..', '#..#.', '#.#..', '.#...', '#.#.#', '#..#.', '.##.#'],
  '!': ['..#..', '..#..', '..#..', '..#..', '..#..', '.....', '..#..'],
  '?': ['.###.', '#...#', '....#', '...#.', '..#..', '.....', '..#..'],
  '%': ['##..#', '##.#.', '...#.', '..#..', '.#...', '#.##.', '#..##'],
  ':': ['.....', '.##..', '.##..', '.....', '.##..', '.##..', '.....'],
  ';': ['.....', '.##..', '.##..', '.....', '.##..', '..#..', '.#...'],
  '+': ['.....', '..#..', '..#..', '#####', '..#..', '..#..', '.....'],
  '=': ['.....', '.....', '#####', '.....', '#####', '.....', '.....'],
  '*': ['.....', '.#.#.', '.###.', '#####', '.###.', '.#.#.', '.....'],
  '"': ['.#.#.', '.#.#.', '.....', '.....', '.....', '.....', '.....'],
};

// ---------------------------------------------------------------- palette
const PAPER: RGB = [246, 241, 231];
const INK: RGB = [22, 22, 26];
const NAVY: RGB = [22, 35, 63];
const GOLD: RGB = [201, 162, 39];
const WHITE: RGB = [255, 255, 255];
const RED: RGB = [178, 34, 34];
const BLUE: RGB = [38, 84, 160];
const TEAL: RGB = [14, 122, 110];
const ORANGE: RGB = [214, 110, 24];
const GREEN: RGB = [46, 125, 50];
const SKY: RGB = [214, 232, 240];
const SAND: RGB = [238, 228, 205];
const GREY: RGB = [120, 120, 120];

// ---------------------------------------------------------------- icons
// Each draws inside a 116x170 box at (ix, iy).
function iconBridge(cv: Canvas, ix: number, iy: number): void {
  cv.rect(ix, iy, 116, 170, SKY);
  // sea
  cv.rect(ix, iy + 128, 116, 42, [64, 120, 158]);
  for (let k = 0; k < 3; k++) cv.hline(ix + 8 + k * 6, ix + 108 - k * 4, iy + 138 + k * 10, 3, WHITE);
  // towers (short, clear of the deck)
  cv.rect(ix + 16, iy + 52, 10, 40, INK);
  cv.rect(ix + 90, iy + 52, 10, 40, INK);
  // deck: left span, gap, right span
  cv.hline(ix + 6, ix + 48, iy + 92, 6, INK);
  cv.hline(ix + 68, ix + 110, iy + 92, 6, INK);
  // fallen span, tilted down into the sea
  cv.line(ix + 50, iy + 94, ix + 66, iy + 126, 6, INK);
  // splash rings where the span hit the water
  cv.ring(ix + 58, iy + 130, 12, 3, WHITE);
  cv.ring(ix + 58, iy + 130, 6, 3, WHITE);
  // blast star above the gap
  cv.circle(ix + 58, iy + 66, 11, ORANGE);
  cv.circle(ix + 58, iy + 66, 5, GOLD);
}

function iconTanker(cv: Canvas, ix: number, iy: number): void {
  cv.rect(ix, iy, 116, 170, SKY);
  cv.rect(ix, iy + 128, 116, 42, [64, 120, 158]);
  for (let k = 0; k < 2; k++) cv.hline(ix + 10 + k * 8, ix + 106 - k * 6, iy + 140 + k * 12, 3, WHITE);
  // hull
  cv.tri(ix + 8, iy + 96, ix + 108, iy + 96, ix + 96, iy + 128, RED);
  cv.rect(ix + 8, iy + 96, 100, 12, RED);
  cv.rect(ix + 8, iy + 108, 100, 20, [140, 26, 26]);
  // containers
  cv.rect(ix + 22, iy + 72, 18, 24, BLUE);
  cv.rect(ix + 44, iy + 72, 18, 24, GOLD);
  cv.rect(ix + 66, iy + 72, 18, 24, TEAL);
  // funnel + flame
  cv.rect(ix + 88, iy + 66, 12, 30, INK);
  cv.tri(ix + 84, iy + 66, ix + 104, iy + 66, ix + 94, iy + 38, ORANGE);
  cv.tri(ix + 89, iy + 66, ix + 99, iy + 66, ix + 94, iy + 48, GOLD);
  // smoke
  cv.circle(ix + 94, iy + 28, 7, GREY);
  cv.circle(ix + 102, iy + 18, 5, GREY);
}

function iconSummit(cv: Canvas, ix: number, iy: number): void {
  cv.rect(ix, iy, 116, 170, SAND);
  // three flag poles
  const flags: { x: number; draw: (x: number, y: number) => void; label: string }[] = [
    { x: ix + 16, draw: (x, y) => {
        for (let s = 0; s < 7; s++) cv.rect(x, y + s * 4, 30, 4, s % 2 ? WHITE : RED);
        cv.rect(x, y, 13, 16, BLUE);
      }, label: 'USA' },
    { x: ix + 44, draw: (x, y) => {
        cv.rect(x, y, 30, 28, RED);
        cv.circle(x + 7, y + 7, 3, GOLD); cv.circle(x + 16, y + 5, 2, GOLD); cv.circle(x + 19, y + 11, 2, GOLD);
      }, label: 'CHN' },
    { x: ix + 72, draw: (x, y) => {
        cv.rect(x, y, 30, 10, WHITE); cv.rect(x, y + 10, 30, 9, BLUE); cv.rect(x, y + 19, 30, 9, RED);
      }, label: 'RUS' },
  ];
  for (const f of flags) {
    cv.vline(f.x - 3, iy + 40, iy + 118, 3, INK);
    f.draw(f.x, iy + 40);
    cv.text(f.label, f.x + 2, iy + 126, 1, INK);
  }
  // table line + city tag
  cv.hline(ix + 8, ix + 108, iy + 118, 3, INK);
  cv.rect(ix + 18, iy + 142, 80, 20, NAVY);
  cv.textCentered('SHENZHEN', ix + 58, iy + 147, 1, WHITE);
}

function iconJets(cv: Canvas, ix: number, iy: number): void {
  cv.rect(ix, iy, 116, 170, SKY);
  // rising sun
  cv.circle(ix + 84, iy + 40, 22, RED);
  // dashed flight path
  for (let k = 0; k < 6; k++) cv.rect(ix + 10 + k * 14, iy + 120 - k * 8, 8, 3, GREY);
  // jet 1 (upper) — larger, clearer silhouette
  cv.tri(ix + 14, iy + 46, ix + 58, iy + 60, ix + 14, iy + 66, INK);
  cv.tri(ix + 30, iy + 52, ix + 40, iy + 40, ix + 46, iy + 58, INK);
  // jet 2 (lower)
  cv.tri(ix + 44, iy + 92, ix + 88, iy + 106, ix + 44, iy + 112, INK);
  cv.tri(ix + 60, iy + 98, ix + 70, iy + 86, ix + 76, iy + 104, INK);
  // warning triangle
  cv.tri(ix + 84, iy + 128, ix + 108, iy + 160, ix + 60, iy + 160, GOLD);
  cv.text('!', ix + 81, iy + 140, 2, INK);
}

function iconBank(cv: Canvas, ix: number, iy: number): void {
  cv.rect(ix, iy, 116, 170, SAND);
  // bank building
  cv.tri(ix + 18, iy + 58, ix + 98, iy + 58, ix + 58, iy + 34, NAVY);
  cv.rect(ix + 24, iy + 58, 68, 8, NAVY);
  for (let k = 0; k < 3; k++) cv.rect(ix + 28 + k * 24, iy + 66, 10, 52, NAVY);
  cv.rect(ix + 20, iy + 118, 76, 8, NAVY);
  cv.rect(ix + 14, iy + 126, 88, 8, NAVY);
  // lightning bolt across the bank
  cv.tri(ix + 62, iy + 40, ix + 80, iy + 40, ix + 66, iy + 84, GOLD);
  cv.tri(ix + 48, iy + 84, ix + 66, iy + 84, ix + 52, iy + 126, GOLD);
}

function iconRocket(cv: Canvas, ix: number, iy: number): void {
  cv.rect(ix, iy, 116, 170, [24, 24, 40]);
  // stars
  const stars: [number, number][] = [[14, 18], [100, 14], [92, 52], [10, 60], [104, 96], [16, 100]];
  for (const [sx, sy] of stars) cv.circle(ix + sx, iy + sy, 2, WHITE);
  // rocket body
  cv.rect(ix + 46, iy + 52, 24, 56, WHITE);
  cv.tri(ix + 46, iy + 52, ix + 70, iy + 52, ix + 58, iy + 28, RED);
  cv.tri(ix + 46, iy + 108, ix + 38, iy + 126, ix + 46, iy + 96, RED);
  cv.tri(ix + 70, iy + 108, ix + 78, iy + 126, ix + 70, iy + 96, RED);
  cv.circle(ix + 58, iy + 72, 6, BLUE);
  // flame
  cv.tri(ix + 50, iy + 108, ix + 66, iy + 108, ix + 58, iy + 136, ORANGE);
  cv.tri(ix + 53, iy + 108, ix + 63, iy + 108, ix + 58, iy + 126, GOLD);
  // debris: broken satellite pieces
  cv.rect(ix + 14, iy + 130, 14, 14, GREY);
  cv.rect(ix + 88, iy + 138, 12, 12, GREY);
  cv.line(ix + 14, iy + 130, ix + 28, iy + 144, 2, RED);
  cv.line(ix + 88, iy + 138, ix + 100, iy + 150, 2, RED);
  // "40" tag
  cv.rect(ix + 82, iy + 12, 28, 18, RED);
  cv.text('40', ix + 86, iy + 15, 1, WHITE);
}

// ---------------------------------------------------------------- layout
interface Panel {
  kicker: string;
  color: RGB;
  headline: string;
  sub: string;
  icon: (cv: Canvas, ix: number, iy: number) => void;
}

const PANELS: Panel[] = [
  { kicker: 'EUROPE - UKRAINE WAR', color: BLUE, headline: 'KERCH BRIDGE SPAN FALLS', sub: 'Ukraine strike collapses a road section; Kyiv bridges also hit.', icon: iconBridge },
  { kicker: 'MIDDLE EAST - HORMUZ', color: RED, headline: 'TANKERS HIT BY MINES', sub: 'Two tankers catch fire near the Strait of Hormuz.', icon: iconTanker },
  { kicker: 'ASIA - DIPLOMACY', color: TEAL, headline: 'XI, TRUMP, PUTIN TO MEET', sub: 'Three-way talks confirmed for Thursday in Shenzhen.', icon: iconSummit },
  { kicker: 'ASIA-PACIFIC - JAPAN', color: ORANGE, headline: 'JAPAN SCRAMBLES JETS', sub: 'Russian planes violate airspace; Tokyo protests.', icon: iconJets },
  { kicker: 'UNITED STATES - ECONOMY', color: GREEN, headline: 'JPMORGAN OUTAGE HITS BANKING', sub: 'Software bug slows accounts and Zelle payments.', icon: iconBank },
  { kicker: 'SPACE', color: NAVY, headline: 'ROCKET FAILS, 40 SATELLITES LOST', sub: 'ULA Vulcan failure destroys Amazon satellites.', icon: iconRocket },
];

function draw(): Buffer {
  const cv = new Canvas(W, H);
  cv.rect(0, 0, W, H, PAPER);

  // Masthead
  cv.rect(16, 16, 992, 132, NAVY);
  cv.rect(16, 144, 992, 4, GOLD);
  cv.textCentered('THE WORLD IN ONE DAY', 512, 32, 3, GOLD);
  cv.textCentered('17 NOVEMBER 2026', 512, 62, 7, WHITE);
  cv.textCentered('TUESDAY', 512, 122, 2, [200, 210, 225]);

  // Panels: 2 columns x 3 rows
  const pw = 488, ph = 232, gap = 16;
  PANELS.forEach((p, i) => {
    const col = i % 2, row = Math.floor(i / 2);
    const x = 16 + col * (pw + gap);
    const y = 164 + row * (ph + gap);
    cv.rect(x, y, pw, ph, WHITE);
    cv.border(x, y, pw, ph, 3, INK);
    // kicker strip
    cv.rect(x + 3, y + 3, pw - 6, 34, p.color);
    cv.text(p.kicker, x + 14, y + 12, 2, WHITE);
    // icon box
    const ix = x + 12, iy = y + 48;
    p.icon(cv, ix, iy);
    cv.border(ix, iy, 116, 170, 2, INK);
    // headline + sub
    const tx = x + 140, tw = pw - 140 - 14;
    // headline at scale 3, wrapped; sub follows below it
    const hlLines = cv.para(p.headline, tx, y + 52, tw, 3, 24, INK);
    cv.para(p.sub.toUpperCase(), tx, y + 52 + hlLines * 24 + 10, tw, 2, 17, [60, 60, 66]);
  });

  // Footer strip
  cv.rect(16, 908, 992, 100, NAVY);
  cv.rect(16, 908, 992, 4, GOLD);
  cv.text('ALSO ON 17 NOVEMBER', 32, 926, 2, GOLD);
  cv.para(
    'DEPARDIEU ADMITS SEXUAL ASSAULT - MONGOLIA PRESIDENT TO RESIGN - US LOSES MEASLES-FREE STATUS - 17 KILLED IN SOUTH AFRICA SHOOTINGS',
    32, 950, 960, 2, 17, WHITE,
  );
  return encodePNG(cv.buf, W, H);
}

const outDir = process.env.MAKEFUN_OUTPUT_DIR ?? '/output';
mkdirSync(outDir, { recursive: true });
writeFileSync(join(outDir, 'entry.png'), draw());
