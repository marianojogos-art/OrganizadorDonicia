import test from 'node:test';
import assert from 'node:assert/strict';
import {resourceCatalog,resourceCategories,getResourceCatalog} from '../src/resource-catalog.mjs';

test('catálogo opcional filtra categorias e não retorna recursos para filtro desconhecido',()=>{
 assert.equal(getResourceCatalog().length,6);
 for(const {id} of resourceCategories){const found=getResourceCatalog(id);assert.ok(found.length);assert.ok(found.every(item=>item.category===id));}
 assert.deepEqual(getResourceCatalog('desconhecida'),[]);
 assert.deepEqual(getResourceCatalog('<script>'),[]);
});
test('catálogo não introduz destinos externos não aprovados ou cópias locais',()=>{
 const ids=new Set();
 for(const resource of resourceCatalog){
  assert.ok(!ids.has(resource.id));ids.add(resource.id);
  const url=new URL(resource.url);assert.equal(url.protocol,'https:');
  assert.ok(['basenacionalcomum.mec.gov.br','drive.google.com','sites.google.com'].includes(url.hostname));
  if(url.hostname==='sites.google.com')assert.ok(url.pathname.startsWith('/sme.pmf.sc.gov.br/'));
  assert.equal(url.username,'');assert.equal(url.password,'');
  assert.equal(resource.verifiedAt,'2026-10-14');assert.ok(resource.title&&resource.description&&resource.source);
  assert.ok(resourceCategories.some(category=>category.id===resource.category));
 }
});
test('fontes oficiais e catálogo permanecem imutáveis entre consumidores',()=>{
 assert.throws(()=>resourceCatalog.push({}),TypeError);
 assert.throws(()=>{resourceCatalog[0].url='https://example.com';},TypeError);
 const filtered=getResourceCatalog('bncc');filtered.pop();
 assert.equal(getResourceCatalog('bncc').length,1);
});
