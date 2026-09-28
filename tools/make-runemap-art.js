// Draws the mod's pictures as PNG files: RuneMap's day band (a smooth ring of colour, night at the top), its
// needle and diamonds, the creature diamonds, the survival rings and the bar tracks. The game shows them as
// they are, so they are smooth where 144 small pieces were jagged (in-game test, 27-09-2026). Run: node tools/make-runemap-art.js
const fs = require('fs');
const path = require('path');
const zlib = require('zlib');

const OUT = path.join(__dirname, '..', 'RuneUI', 'Art');
const NIGHT_START = 0.795;   // the game's day cycle: 0 = dawn, night from here to 1 (read from the dial)

// ---- PNG writer (RGBA, 8 bit)
const CRC = new Uint32Array(256).map((_, n) => {
  let c = n;
  for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
  return c >>> 0;
});
function crc32(buf) {
  let c = 0xffffffff;
  for (const b of buf) c = CRC[(c ^ b) & 0xff] ^ (c >>> 8);
  return (c ^ 0xffffffff) >>> 0;
}
function chunk(type, data) {
  const len = Buffer.alloc(4); len.writeUInt32BE(data.length);
  const td = Buffer.concat([Buffer.from(type), data]);
  const crc = Buffer.alloc(4); crc.writeUInt32BE(crc32(td));
  return Buffer.concat([len, td, crc]);
}
function writePng(file, size, pixel, height = size) {
  const raw = Buffer.alloc((size * 4 + 1) * height);
  for (let y = 0; y < height; y++) {
    raw[y * (size * 4 + 1)] = 0;
    for (let x = 0; x < size; x++) {
      const [r, g, b, a] = pixel(x + 0.5, y + 0.5);
      const o = y * (size * 4 + 1) + 1 + x * 4;
      raw[o] = r; raw[o + 1] = g; raw[o + 2] = b; raw[o + 3] = a;
    }
  }
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(size, 0); ihdr.writeUInt32BE(height, 4);
  ihdr[8] = 8; ihdr[9] = 6; ihdr[10] = 0; ihdr[11] = 0; ihdr[12] = 0;
  fs.writeFileSync(file, Buffer.concat([
    Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]),
    chunk('IHDR', ihdr), chunk('IDAT', zlib.deflateSync(raw, { level: 9 })), chunk('IEND', Buffer.alloc(0)),
  ]));
}

const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
const smooth = (e0, e1, v) => { const t = clamp((v - e0) / (e1 - e0), 0, 1); return t * t * (3 - 2 * t); };
const hex = h => [1, 3, 5].map(i => parseInt(h.slice(i, i + 2), 16));
const mix = (a, b, t) => a.map((v, i) => v + (b[i] - v) * t);

// ---- the day band. The picture covers RuneMap's whole box: the map (D = 180 units) plus 44, and the band
// is 10 units wide, centred 9 units outside the map. Keep D the same as in runemap.lua.
const D = 180, BOX = D + 44, R_IN = D / 2 + 4, R_OUT = D / 2 + 14, SIZE = 1024;
const NIGHT = hex('#1b2350'), PURPLE = hex('#5d4a86'), PEACH = hex('#f2a58c'), YELLOW = hex('#f6d38a');
const SKY = hex('#8cc4e8'), ORANGE = hex('#f0b35c'), RED = hex('#d0583e'), PLUM = hex('#6a3a66');
const ns = NIGHT_START;
// the day is not one flat blue: a pale morning sky, the deepest blue at noon, pale again before dusk
const MORNING = hex('#b4d9ef'), NOON = hex('#5fa6db');
const STOPS = [
  [0.0, PEACH], [0.02, YELLOW], [0.05, MORNING],
  [ns / 2, NOON],
  [ns - 0.06, MORNING], [ns - 0.035, ORANGE], [ns - 0.012, RED],
  [ns + 0.012, PLUM], [ns + 0.035, NIGHT],
  [0.97, NIGHT], [0.985, PURPLE], [1.0, PEACH],
];
function colourAt(f) {
  for (let i = 0; i < STOPS.length - 1; i++) {
    const [a, ca] = STOPS[i], [b, cb] = STOPS[i + 1];
    if (f >= a && f <= b) return mix(ca, cb, b === a ? 0 : smooth(0, 1, (f - a) / (b - a)));
  }
  return PEACH;
}
const k = SIZE / BOX, c = SIZE / 2;
// How much of the day shows: 1 = the blue sky, less = the day fades out and the world shows through
// (blue layer made transparent, chosen 27-09-2026). Night, dawn and dusk stay solid.
function band(dayAlpha) {
  return (x, y) => {
    const dx = x - c, dy = y - c, r = Math.hypot(dx, dy) / k;
    const alpha = smooth(R_IN - 0.6, R_IN + 0.6, r) * (1 - smooth(R_OUT - 0.6, R_OUT + 0.6, r));
    if (alpha <= 0) return [0, 0, 0, 0];
    const deg = (Math.atan2(dx, -dy) * 180 / Math.PI + 360) % 360;   // clockwise from the top
    const f = ((ns + 1) / 2 + deg / 360) % 1;                        // middle of the night at the top
    // a soft shade at both edges, so the band sits in the gold like an inlay instead of a flat strip
    const t = (r - R_IN) / (R_OUT - R_IN);
    const shade = 0.78 + 0.22 * Math.sin(Math.PI * clamp(t, 0, 1));
    const col = colourAt(f).map(v => clamp(Math.round(v * shade), 0, 255));
    // how deep into the day this point is: 0 at dawn and dusk, 1 once the sky is plain day
    const day = f < ns ? smooth(0.03, 0.08, f) * (1 - smooth(ns - 0.08, ns - 0.03, f)) : 0;
    return [...col, Math.round(alpha * (1 - day * (1 - dayAlpha)) * 255)];
  };
}
writePng(path.join(OUT, 'runemap_band_clear.png'), SIZE, band(0.12));   // band(1) gives the all-blue day

// the pictures below are 64 px
const S = 64, h = S / 2;

// ---- the diamonds on the ring, like the crest of the menu's trim: a gold diamond with a dark outline, a
// dark inner diamond and a bright gold centre. 64 px for a 12 unit mark.
writePng(path.join(OUT, 'runemap_diamond.png'), S, (x, y) => {
  const d = Math.abs(x - h) + Math.abs(y - h);   // distance in the diamond's own shape
  const edge = (v, r) => 1 - smooth(r - 0.8, r + 0.8, v);
  const outline = edge(d, 30), gold = edge(d, 26), inner = edge(d, 15), centre = edge(d, 8);
  const lightGold = hex('#f7dd97'), deepGold = hex('#b8863c');
  const g = mix(lightGold, deepGold, clamp((y - h + 26) / 52, 0, 1));   // light from the top
  let col = hex('#2a1c12'), a = outline;
  if (gold > 0) col = mix(col, g, gold);
  if (inner > 0) col = mix(col, hex('#2a1c12'), inner);
  if (centre > 0) col = mix(col, lightGold, centre);
  return [...col.map(v => Math.round(v)), Math.round(255 * a)];
});

// ---- food, water and rest, in the map's style (design sketch). Each picture covers the game's 68 unit
// radial bar. The coloured ring is drawn in two halves that the mod turns, so it fills like a clock hand.
const U = 68, US = 256, uk = US / U, uc = US / 2;
const R_TRACK_IN = 23.7, R_TRACK_OUT = 29.75, R_RIM = 33, R_EDGE = 34, R_CENTRE = 24.9;
const edgeIn = (r, e) => smooth(e - 0.5, e + 0.5, r);     // 0 inside e, 1 outside
const upR = (x, y) => Math.hypot(x - uc, y - uc) / uk;
const over = (dst, src) => {                              // src over dst, both [r, g, b, a 0..1]
  const a = src[3] + dst[3] * (1 - src[3]);
  if (a <= 0) return [0, 0, 0, 0];
  return [0, 1, 2].map(i => (src[i] * src[3] + dst[i] * dst[3] * (1 - src[3])) / a).concat(a);
};
const out = p => [...p.slice(0, 3).map(v => clamp(Math.round(v), 0, 255)), Math.round(clamp(p[3], 0, 1) * 255)];
// the back: a dark disc with a gold rim and a dark outline, and the empty track in faint gold
writePng(path.join(OUT, 'upkeep_back.png'), US, (x, y) => {
  const r = upR(x, y);
  let p = [...hex('#2a1c12'), 1 - edgeIn(r, R_EDGE)];
  p = over(p, [...hex('#b8924f'), 1 - edgeIn(r, R_RIM)]);
  p = over(p, [20, 13, 8, (1 - edgeIn(r, R_RIM - 1.4)) * 0.95]);
  p = over(p, [227, 184, 90, 0.14 * edgeIn(r, R_TRACK_IN) * (1 - edgeIn(r, R_TRACK_OUT))]);
  return out(p);
});
// one half of the coloured ring (the right half), white, so the mod can tint it; soft shade at its edges
writePng(path.join(OUT, 'upkeep_half.png'), US, (x, y) => {
  if (x < uc) return [0, 0, 0, 0];
  const r = upR(x, y);
  const a = edgeIn(r, R_TRACK_IN) * (1 - edgeIn(r, R_TRACK_OUT));
  const t = clamp((r - R_TRACK_IN) / (R_TRACK_OUT - R_TRACK_IN), 0, 1);
  const v = Math.round(255 * (0.8 + 0.2 * Math.sin(Math.PI * t)));
  return [v, v, v, Math.round(255 * a)];
});
// the centre: a dark disc with a thin gold line, over the inner edge of the ring
writePng(path.join(OUT, 'upkeep_centre.png'), US, (x, y) => {
  const r = upR(x, y);
  let p = [227, 184, 90, 0.8 * (1 - edgeIn(r, R_CENTRE))];
  p = over(p, [...hex('#1b130d'), 1 - edgeIn(r, R_CENTRE - 1.1)]);
  return out(p);
});

// ---- the clock hand on the ring (design sketch): a gold needle that points at the map's centre,
// with a diamond cap on its outer end. 32 x 96 px for a 10 x 30 unit marker; it points down, the mod turns it.
{
  const W = 32, H = 96, cx = W / 2;
  writePng(path.join(OUT, 'runemap_needle.png'), W, (px, py) => {
    // the needle: from full width under the cap to a point at the bottom
    const t = clamp((py - 22) / (H - 24), 0, 1);
    const half = 9 * (1 - t);
    const inNeedle = py >= 20 && py <= H - 1 ? (1 - smooth(half - 0.8, half + 0.8, Math.abs(px - cx))) : 0;
    const outline = py >= 18 ? (1 - smooth(half + 1.2, half + 2.8, Math.abs(px - cx))) * (1 - smooth(H - 1, H, py)) : 0;
    // the cap: a diamond round (cx, 13)
    const d = Math.abs(px - cx) + Math.abs(py - 13);
    const cap = 1 - smooth(10.2, 11.8, d), capOut = 1 - smooth(12.6, 14.2, d);
    const gold = mix(hex('#f6d98c'), hex('#a8823f'), clamp((px - cx + 9) / 18, 0, 1));   // light from the left
    let col = hex('#2a1c12'), a = Math.max(outline, capOut);
    const body = Math.max(inNeedle, cap);
    if (body > 0) col = mix(col, gold, body);
    return [...col.map(Math.round), Math.round(255 * a)];
  }, H);
}

// ---- creatures on the map: a small diamond, red for enemies and green for neutral animals, dark outline
function creature(file, light, deep) {
  writePng(path.join(OUT, file), S, (x, y) => {
    const d = Math.abs(x - h) + Math.abs(y - h);
    const edge = (v, r) => 1 - smooth(r - 0.8, r + 0.8, v);
    const outline = edge(d, 30), body = edge(d, 25);
    const col = mix(hex(light), hex(deep), clamp((y - h + 25) / 50, 0, 1));   // light from the top
    const c = body > 0 ? mix(hex('#1a0f0a'), col, body) : hex('#1a0f0a');
    return [...c.map(v => Math.round(v)), Math.round(255 * outline)];
  });
}
creature('creature_enemy.png', '#ff7a66', '#b8281e');
creature('creature_neutral.png', '#a6e07a', '#3f8f2e');

// ---- the bars' track (design sketch, without its ornaments: in-game review 27-09-2026). The mod draws this
// picture in nine pieces over each bar's frame, one pixel to one unit: the outer pieces keep their size and
// fit the frame's padding, so they stay empty, and the dark middle stretches behind the game's fill. One
// picture for each padding from 8 to 12 units (the game's frames have 9 and 11); keep the sizes as in main.lua.
{
  const BW = 80, SIDE = 8, CORE = 16;   // SIDE: the fill's padding
  const TRACK = [20, 13, 8, 0.85];
  const inside = (v, a, b) => smooth(a - 0.5, a + 0.5, v) * (1 - smooth(b - 0.5, b + 0.5, v));
  for (let pad = 8; pad <= 12; pad++) {
    const H = pad * 2 + CORE;
    writePng(path.join(OUT, 'bar_blade_' + pad + '.png'), BW, (x, y) => {
      const a = inside(x, SIDE, BW - SIDE) * inside(y, pad, H - pad);   // the track behind the fill
      return out([...TRACK.slice(0, 3), TRACK[3] * a]);
    }, H);
  }
}

// ---- one dash of a buff's ring: white, so the mod tints it with the buff's colour. The dash is 2 x 5 units
// with round ends, drawn at 4 px a unit with an empty edge, so it stays smooth when the mod turns it; a plain
// turned box had jagged edges (in-game screenshot, 28-09-2026). The picture is 8 x 8 units.
writePng(path.join(OUT, 'buff_dash.png'), 32, (x, y) => {
  const dy = Math.max(0, Math.abs(y - 16) - 6);   // distance to the dash's middle line, 12 px long
  const d = Math.hypot(x - 16, dy);
  return [255, 255, 255, Math.round(255 * (1 - smooth(3.5, 4.5, d)))];
});

// ---- CurseForge takes no .png files in a Dragonwilds mod zip: the pictures also go into Scripts/art.lua as
// base64 text, and the mod writes them back into Art when the game starts.
const pngs = fs.readdirSync(OUT).filter(f => f.endsWith('.png')).sort();
fs.writeFileSync(path.join(OUT, '..', 'Scripts', 'art.lua'),
  '-- Written by tools/make-runemap-art.js from the pictures in RuneUI/Art. Do not edit.\nreturn {\n' +
  pngs.map(f => `    ["${f}"] = "${fs.readFileSync(path.join(OUT, f)).toString('base64')}",`).join('\n') + '\n}\n');

console.log('written to ' + OUT + ' and Scripts/art.lua');
