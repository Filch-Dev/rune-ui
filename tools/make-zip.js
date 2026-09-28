// Builds the release zip RuneUI-<version>.zip in the repo root, the same for CurseForge and Nexus Mods.
// CurseForge takes only these file types in a Dragonwilds UE4SS mod, so the pictures stay out (the mod writes
// them from Scripts/art.lua) and any other type stops the build. Run: node tools/make-zip.js
const fs = require('fs'), os = require('os'), path = require('path'), { execFileSync } = require('child_process');
const ALLOWED = ['.txt', '.lua', '.dll', '.pak', '.utoc', '.ucas'];
const ROOT = path.join(__dirname, '..');
const version = fs.readFileSync(path.join(ROOT, 'RuneUI', 'Scripts', 'main.lua'), 'utf8').match(/local VERSION = "(.+?)"/)[1];
const stage = fs.mkdtempSync(path.join(os.tmpdir(), 'runeui-'));
const mod = path.join(stage, 'RuneUI');
fs.cpSync(path.join(ROOT, 'RuneUI'), mod, { recursive: true, filter: f => !f.endsWith('.png') });
fs.copyFileSync(path.join(ROOT, 'LICENSE'), path.join(mod, 'LICENSE.txt'));
const files = fs.readdirSync(mod, { recursive: true }).filter(f => fs.statSync(path.join(mod, f)).isFile());
const bad = files.filter(f => !ALLOWED.includes(path.extname(f).toLowerCase()));
if (bad.length) { fs.rmSync(stage, { recursive: true }); throw new Error('CurseForge does not accept: ' + bad.join(', ')); }
const zip = path.join(ROOT, 'RuneUI-' + version + '.zip');
fs.rmSync(zip, { force: true });
// Windows' own tar writes a real zip with forward slashes in the paths.
execFileSync(path.join(process.env.SystemRoot, 'System32', 'tar.exe'), ['-a', '-c', '-f', zip, '-C', stage, 'RuneUI']);
fs.rmSync(stage, { recursive: true });
console.log(zip + '\n' + files.map(f => '  RuneUI/' + f.replace(/\\/g, '/')).join('\n'));
