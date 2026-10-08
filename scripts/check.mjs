// SPDX-License-Identifier: GPL-3.0-or-later
// Verificações rápidas antes de publicar uma versão:
// sintaxe dos scripts, versões sincronizadas e arquivos do manifest presentes.
import { execFileSync } from 'node:child_process';
import { existsSync, readFileSync } from 'node:fs';

const manifest = JSON.parse(readFileSync('manifest.json', 'utf8'));
const pkg = JSON.parse(readFileSync('package.json', 'utf8'));
const errors = [];

if (manifest.version !== pkg.version) {
  errors.push(`Versão diferente: manifest.json ${manifest.version}, package.json ${pkg.version}.`);
}

const files = [
  'background.js', 'content.js', 'popup-bridge.js', 'sites.js', 'options.js',
  'options.html', 'options.css', 'pdf-lib.min.js'
];
for (const file of files) {
  if (!existsSync(file)) {
    errors.push(`Arquivo ausente: ${file}`);
    continue;
  }
  if (file.endsWith('.js') && file !== 'pdf-lib.min.js') {
    try {
      execFileSync(process.execPath, ['--check', file], { stdio: 'pipe' });
    } catch (error) {
      errors.push(`Erro de sintaxe em ${file}:\n${error.stderr}`);
    }
  }
}

if (errors.length) {
  console.error(errors.join('\n'));
  process.exit(1);
}
console.log(`OK — versão ${manifest.version}`);
