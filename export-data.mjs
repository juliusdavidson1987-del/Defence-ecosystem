#!/usr/bin/env node
/**
 * export-data.mjs — extracts the ecosystem dataset from the single-file tool
 * into open, reusable JSON and CSV (CC BY 4.0). Run after each release:
 *   node export-data.mjs The_Defence_Ecosystem_v2.html
 */
import fs from 'node:fs';
const file=process.argv.slice(2).find(a=>!a.startsWith('--'))||'The_Defence_Ecosystem_v2.html';
const html=fs.readFileSync(file,'utf8');
const scripts=[...html.matchAll(/<script>([\s\S]*?)<\/script>/g)].map(m=>m[1]);
const code=scripts[scripts.length-1];
const treeStart=code.indexOf('const TREE ='); const treeEnd=code.indexOf('/* cross-links');
const tree=code.slice(treeStart,treeEnd);

// Tokenise into L/B openings and ] closings, in order, to track branch nesting.
const tokRe=/([LB])\("([a-z0-9_]+)",\s*"((?:[^"\\]|\\.)*)",\s*"((?:[^"\\]|\\.)*)"(?:,\s*"((?:[^"\\]|\\.)*)")?|(\])/g;
let m; const rows=[]; const branchStack=[];
while((m=tokRe.exec(tree))){
  if(m[6]===']'){ branchStack.pop(); continue; }
  const kind=m[1], id=m[2], a=m[3], b=m[4], c=m[5];
  const branch=branchStack.length?branchStack[branchStack.length-1]:'';
  if(kind==='L'){
    rows.push({id,label:a,entry:b,does:c||'',branch});
  } else {
    // B("id","label","does",[   — its 3rd arg is the does text, then children open
    rows.push({id,label:a,entry:'',does:b||'',branch,isBranch:true});
    branchStack.push(id);
  }
}
function domainOf(e){ const x=(e||'').match(/([a-z0-9-]+\.)+[a-z]{2,}(\.[a-z]{2,})?/i); return x&&!/@/.test(x[0])?x[0]:''; }
function emailOf(e){ const x=(e||'').match(/[a-z0-9._%+-]+@[a-z0-9.-]+\.[a-z]{2,}/i); return x?x[0]:''; }

const dataset=rows.filter(n=>!n.isBranch).map(n=>({
  id:n.id, name:n.label, branch:n.branch||'', website:domainOf(n.entry),
  email:emailOf(n.entry), description:n.does
}));
fs.writeFileSync('defence-ecosystem-data.json',JSON.stringify({
  source:'The Defence Ecosystem — https://juliusdavidson1987-del.github.io/Defence-ecosystem/',
  licence:'CC BY 4.0', generated:new Date().toISOString().slice(0,10),
  count:dataset.length, organisations:dataset
},null,2));
const head=['id','name','branch','website','email','description'];
const csv=[head.join(',')].concat(dataset.map(r=>head.map(k=>'"'+String(r[k]==null?'':r[k]).replace(/"/g,'""')+'"').join(','))).join('\r\n');
fs.writeFileSync('defence-ecosystem-data.csv','\ufeff'+csv);
console.log('Exported',dataset.length,'organisations to JSON + CSV');
