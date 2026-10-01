// Reads a UE4SS crash dump (ue4ss/crash_*.dmp): the exception code and address, the module that holds it, and the
// module addresses on the crashing thread's stack. Run: node tools/read-dump.js <file.dmp>
const fs = require('fs');
if (!process.argv[2]) { console.log('usage: node tools/read-dump.js <file.dmp>'); process.exit(1); }
const b = fs.readFileSync(process.argv[2]);
const nStreams = b.readUInt32LE(8), dirRva = b.readUInt32LE(12);
const streams = {};
for (let i = 0; i < nStreams; i++) {
  const o = dirRva + i * 12;
  streams[b.readUInt32LE(o)] = { size: b.readUInt32LE(o + 4), rva: b.readUInt32LE(o + 8) };
}
const str = rva => { const len = b.readUInt32LE(rva); return b.slice(rva + 4, rva + 4 + len).toString('utf16le'); };
// modules (4)
const mods = [];
{ const s = streams[4]; const n = b.readUInt32LE(s.rva);
  for (let i = 0; i < n; i++) { const o = s.rva + 4 + i * 108;
    mods.push({ base: b.readBigUInt64LE(o), size: BigInt(b.readUInt32LE(o + 8)), name: str(b.readUInt32LE(o + 20)).split('\\').pop() }); } }
const where = a => { for (const m of mods) if (a >= m.base && a < m.base + m.size) return `${m.name}+0x${(a - m.base).toString(16)}`; return null; };
// exception (6)
const e = streams[6];
if (!e) { console.log('no exception in this dump'); process.exit(1); }
const tid = b.readUInt32LE(e.rva);
const code = b.readUInt32LE(e.rva + 8), addr = b.readBigUInt64LE(e.rva + 8 + 16);
const nParams = b.readUInt32LE(e.rva + 8 + 24);
const params = []; for (let i = 0; i < Math.min(nParams, 3); i++) params.push('0x' + b.readBigUInt64LE(e.rva + 8 + 32 + i * 8).toString(16));
console.log(`exception 0x${code.toString(16)} at ${where(addr) || '0x' + addr.toString(16)} params ${params.join(' ')}`);
// threads (3): scan the crashing thread's stack for return addresses into modules
{ const s = streams[3]; const n = b.readUInt32LE(s.rva);
  for (let i = 0; i < n; i++) { const o = s.rva + 4 + i * 48;
    if (b.readUInt32LE(o) !== tid) continue;
    const stSize = b.readUInt32LE(o + 32), stRva = b.readUInt32LE(o + 36);
    const hits = [];
    for (let p = 0; p + 8 <= stSize && hits.length < 40; p += 8) { const w = where(b.readBigUInt64LE(stRva + p)); if (w && !w.startsWith('ntdll') ) hits.push(w); }
    console.log('stack words in modules:\n  ' + hits.join('\n  '));
  } }
