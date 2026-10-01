// Writes RuneUI/README.txt, the short README for players inside the zip, from README.md. The Install and Keys
// sections and the list of the files that the mod writes come from README.md, so the two never drift. The first
// lines and the MORE part are below. Run: node tools/make-readme-txt.js after you edit README.md.
// node tools/make-readme-txt.js --check only compares, and fails when README.txt is out of date (npm test runs it).
const fs = require('fs'), path = require('path');
const ROOT = path.join(__dirname, '..');
const OUT = path.join(ROOT, 'RuneUI', 'README.txt');

const HEAD = `Rune UI
A UE4SS Lua mod for RuneScape: Dragonwilds.
Move, resize, fade and hide every part of the HUD, right in the game. With a new map, new rings and new bars in the game's own style.`;

const MORE = `MORE

Pictures, details and the source code: https://github.com/Filch-Dev/rune-ui
The code of Rune UI is under the MIT licence. See LICENSE.txt.

Created using intellectual property belonging to Jagex Limited under the terms of Jagex's Fan Content Policy. This content is not endorsed by or affiliated with Jagex.`;

const md = fs.readFileSync(path.join(ROOT, 'README.md'), 'utf8').replace(/\r\n/g, '\n').split('\n');

// The lines under a heading, up to the next heading of the same level or higher.
function section(title) {
  const start = md.findIndex(l => /^#{2,3} /.test(l) && l.replace(/^#+ /, '').startsWith(title));
  if (start < 0) throw new Error('README.md has no section "' + title + '"');
  const level = md[start].match(/^#+/)[0].length;
  let end = start + 1;
  while (end < md.length && !(/^#+ /.test(md[end]) && md[end].match(/^#+/)[0].length <= level)) end++;
  return { title: plain(md[start].replace(/^#+ /, '')).toUpperCase(), lines: md.slice(start + 1, end) };
}

// Markdown inside a line to plain text. A file name in backticks stays bare; a piece of a name or words with
// spaces get quotes. A link becomes "text: url". Text after the url goes on its own line, so no full stop sticks
// to the url; indent is the width of the list number.
function plain(s, indent = '') {
  s = s.replace(/`([^`]+)`/g, (_, c) => / |-$/.test(c) ? '"' + c + '"' : c);
  s = s.replace(/\*\*([^*]+)\*\*/g, '$1').replace(/<[^>]+>/g, '');
  s = s.replace(/\[([^\]]+)\]\(([^)]+)\)(\.?)( *)/g, (m, text, url, dot, space, at, all) => {
    const link = text === url ? url : text + ': ' + url;
    if (!dot) return link + space;
    return at + m.length < all.length ? link + '\n' + indent : link;
  });
  return s;
}

const isRule = l => /^\|[\s|:-]+\|$/.test(l || '');
function cells(l) { return l.replace(/^\s*\|/, '').replace(/\|\s*$/, '').split('|').map(c => plain(c.trim())); }

// A section's text. Tables lose their header row and become two columns, all with the same width.
function body(lines) {
  const skip = (l, i) => isRule(l) || (l.startsWith('|') && isRule(lines[i + 1]));
  const rows = lines.filter((l, i) => l.startsWith('|') && !skip(l, i));
  const width = Math.max(0, ...rows.map(l => cells(l)[0].length)) + 3;
  const out = [];
  lines.forEach((l, i) => {
    if (skip(l, i)) return;
    if (l.startsWith('|')) { const c = cells(l); out.push(c[0].padEnd(width) + c.slice(1).join('  ')); return; }
    const num = l.match(/^(\d+\. |- )/);
    out.push(plain(l, num ? ' '.repeat(num[1].length) : ''));
  });
  return trim(out).join('\n');
}

// The list of files: the names, then the first sentence of what the file holds. A line with more than one name
// puts the text on the next line.
function files(lines) {
  const items = [], out = [];
  for (const l of lines) {
    const m = l.match(/^- (.+?): (.*)$/);
    if (m && m[1].includes('`')) {
      const names = [...m[1].matchAll(/`([^`]+)`/g)].map(x => x[1]);
      items.push({ name: names.join(' and '), one: names.length === 1, text: plain(m[2].split(/\. /)[0].replace(/\.$/, '')) });
      out.push(items[items.length - 1]);
    } else out.push(plain(l));
  }
  const width = Math.max(0, ...items.filter(x => x.one).map(x => x.name.length)) + 2;
  return trim(out.map(x => typeof x === 'string' ? x
    : x.one ? x.name.padEnd(width) + x.text : x.name + '\n' + ' '.repeat(width) + x.text)).join('\n');
}

function trim(a) {
  while (a.length && !a[0].trim()) a.shift();
  while (a.length && !a[a.length - 1].trim()) a.pop();
  return a.map(l => l.replace(/\s+$/, '')).filter((l, i, all) => l || all[i - 1]);
}

const install = section('Install'), keys = section('Keys'), written = section('Files that the mod writes');
const text = [HEAD, install.title, body(install.lines), keys.title, body(keys.lines), written.title, files(written.lines), MORE]
  .join('\n\n') + '\n';

if (process.argv.includes('--check')) {
  // A Windows checkout with core.autocrlf has CRLF line ends; the file in git has LF.
  const now = fs.existsSync(OUT) ? fs.readFileSync(OUT, 'utf8').replace(/\r\n/g, '\n') : '';
  if (now !== text) {
    console.log('RuneUI/README.txt is out of date with README.md. Run: node tools/make-readme-txt.js');
    process.exit(1);
  }
  console.log('RuneUI/README.txt matches README.md');
} else {
  fs.writeFileSync(OUT, text);
  console.log('wrote ' + OUT);
}
