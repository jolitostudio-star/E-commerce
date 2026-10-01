import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

const root = new URL('../', import.meta.url);

test('catálogo mantém somente fornecedores com loja ou catálogo identificado', async () => {
  const data = JSON.parse(await readFile(new URL('assets/suppliers.json', root), 'utf8'));
  assert.equal(data.count, 64);
  assert.equal(data.suppliers.length, 64);
  assert.equal(data.summary.kept, 47);
  assert.equal(data.summary.new, 17);
  assert.equal(data.summary.removed, 295);
  assert.equal(new Set(data.suppliers.map(row => row.id)).size, 64);
  assert.ok(data.suppliers.every(row => typeof row.brand === 'string' && row.brand.trim()));
  assert.ok(data.suppliers.every(row => row.url || row.catalogUrl));
});

test('links do catálogo usam somente canais seguros', async () => {
  const data = JSON.parse(await readFile(new URL('assets/suppliers.json', root), 'utf8'));
  const urls = data.suppliers.flatMap(row => [row.url, row.catalogUrl]).filter(Boolean);
  assert.ok(urls.length >= 64);
  assert.ok(urls.every(value => /^https?:\/\//i.test(value)));
});

test('tela de fornecedores está ligada à navegação', async () => {
  const { dashboard: html } = await import('../api/_app.js');
  const script = await readFile(new URL('assets/suppliers.js', root), 'utf8');
  assert.match(html, /data-nav="suppliers"/);
  assert.match(html, /id="viewSuppliers"/);
  assert.match(html, /assets\/suppliers\.js/);
  assert.match(script, /VIEWS\.suppliers\.open = load/);
});
