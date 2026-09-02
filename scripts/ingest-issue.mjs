#!/usr/bin/env node
/**
 * Stage 3 — turn an APPROVED "suggest an organisation" issue into a drafted node.
 * Parses the issue form, dedupe-checks against live data, drafts the node with the
 * same engine as the drafter (optionally AI-enriched), and prints a review-ready
 * comment (preview + ready-to-run SQL). It never inserts — a human runs the SQL.
 *
 * Inputs (env): ISSUE_BODY (required), DATA_FILE (default data.json),
 *               ANTHROPIC_API_KEY (optional — enables AI enrichment).
 * Output: markdown to stdout (the workflow posts it as an issue comment) and
 *         GITHUB_OUTPUT flags: status=new|duplicate|unverified, node_id=<id>.
 */
import fs from 'node:fs';
import * as E from './drafter-engine.mjs';

const BODY = process.env.ISSUE_BODY || '';
const DATA_FILE = process.env.DATA_FILE || 'data.json';
const KEY = process.env.ANTHROPIC_API_KEY;

// Broad template dropdown → engine type (fallback; AI overrides when available)
const TYPE_MAP = { 'government / military':'gov','research / academic':'academic','industry':'sme',
  'investor / capital':'investor','gateway / association':'policy','policy / strategy':'policy',
  'media / intelligence':'policy','event / fair':'policy','not sure':'sme' };
const KW = [['space',/space|satellite|orbit|launch/i],['cyber',/cyber|crypto|sigint|quantum/i],['maritime',/naval|maritime|submarine|undersea|shipbuild/i],['air',/aircraft|aviation|drone|uav|uas|aerospace/i],['land',/vehicle|armour|armor|army|land system/i],['ai',/\bai\b|autonom|machine learning|software/i],['weapons',/missile|munition|weapon|artillery|ordnance/i],['c4isr',/radar|sensor|electronic warfare|\bew\b|surveillance|isr/i],['counteruas',/counter-?uas|counter-?drone|c-uas/i],['directed',/directed energy|laser|microwave/i]];

function field(label){ // GitHub renders issue forms as "### Label\n\nvalue"
  const re = new RegExp('###\\s*'+label.replace(/[.*+?^${}()|[\\]\\\\]/g,'\\$&')+'\\s*\\n+([\\s\\S]*?)(?=\\n###\\s|$)','i');
  const m = BODY.match(re); return m ? m[1].trim().replace(/^_No response_$/i,'') : '';
}
const name = field('Organisation name');
const website = field('Official website');
const nation = field('Nation / region');
const typeRaw = field('What type of body is it\\?');
const why = field('What do they do, and why include them\\?');

function out(k,v){ if(process.env.GITHUB_OUTPUT) fs.appendFileSync(process.env.GITHUB_OUTPUT, `${k}=${v}\n`); }
function guessDomains(txt){ const d=KW.filter(([,re])=>re.test(txt)).map(([dm])=>dm); return d.length?[...new Set(d)].slice(0,4):['xcut']; }

async function aiEnrich(){
  if(!KEY) return null;
  const DOMAINS=E.KNOWN_DOMAINS.join(', '), TYPES=Object.keys(E.TYPE_TAGS).join(', ');
  const prompt=`Catalogue this organisation for a defence-innovation map. Return ONLY minified JSON.
Name: ${name}\nWebsite: ${website}\nNation: ${nation}\nSuggested reason: ${why}
Keys: "does" (one factual sentence, verified facts only, no marketing), "type" (ONE of ${TYPES}), "domains" (array from ${DOMAINS}, 1-4), "trl" ([low,high] 1-9).
If not confident it is real and defence-relevant, set "does" to "UNVERIFIED". Do not invent facts.`;
  try{
    const r=await fetch('https://api.anthropic.com/v1/messages',{method:'POST',headers:{'content-type':'application/json','x-api-key':KEY,'anthropic-version':'2023-06-01'},body:JSON.stringify({model:'claude-sonnet-4-6',max_tokens:400,messages:[{role:'user',content:prompt}]})});
    const j=await r.json(); const t=(j.content||[]).map(b=>b.text||'').join('').replace(/^```(json)?/,'').replace(/```$/,'').trim();
    return JSON.parse(t);
  }catch(e){ console.error('AI enrich failed, using deterministic fallback:',e.message); return null; }
}

(async () => {
  if(!name){ console.log('Could not read the organisation name from the issue — is this a "Suggest an organisation" form?'); out('status','error'); process.exit(0); }
  const data = JSON.parse(fs.readFileSync(DATA_FILE,'utf8'));
  const ids = new Set(data.nodes.map(n=>n.id));

  // 1. dedupe
  const dupes = E.dedupeCheck(name, website, data.nodes);
  if(dupes.length && dupes[0].score>=9){
    out('status','duplicate');
    console.log(`### 🔁 Likely already in the map\n\n**${name}** looks like it's already represented:\n\n`+
      dupes.map(d=>`- **${d.label}** \`[${d.id}]\` — ${d.why.join(', ')}`).join('\n')+
      `\n\nIf that's the same organisation, close this issue (or file a **correction** instead). If it's genuinely different, remove the \`approved\` label, add a note, and re-apply.`);
    return;
  }

  // 2. draft (AI-enriched if a key is present, else deterministic from the form)
  const ai = await aiEnrich();
  if(ai && String(ai.does).includes('UNVERIFIED')){
    out('status','unverified');
    console.log(`### ⚠ Could not verify\n\nClaude could not confirm **${name}** as a real, defence-relevant organisation from the details given. Please verify manually before adding.`);
    return;
  }
  const type = (ai && ai.type) || TYPE_MAP[(typeRaw||'').toLowerCase().trim()] || 'sme';
  const domains = (ai && ai.domains) || guessDomains(name+' '+why);
  const trl = (ai && ai.trl) || [3,9];
  const does = (ai && ai.does) || why.replace(/\s+/g,' ').trim();

  const node = E.buildNode({ name, url:website, nation, type, domains, trl, does }, ids);
  const sql = E.nodeToSQL(node);
  out('status','new'); out('node_id', node.id);

  const softDupes = dupes.length ? `\n> ⚠ Some possible overlaps to sanity-check: ${dupes.map(d=>`\`${d.label}\``).join(', ')}\n` : '';
  console.log(
`### ✅ Drafted node — review, then run the SQL

| field | value |
|---|---|
| **id** | \`${node.id}\` |
| **label** | ${node.label} |
| **parent** | \`${node.parent}\`${node._parentNote?` — _${node._parentNote}_`:''} |
| **type** | ${type} |
| **description** | ${node.does} |
| **domains** | ${(node.tags.d||[]).join(', ')} |
| **link** | ${node.entry} |
${softDupes}
${ai?'_Description & tags drafted by Claude from the suggestion._':'_Drafted deterministically from the form (no AI key set) — tighten the description/type as needed._'}

<details><summary>Ready-to-run SQL</summary>

\`\`\`sql
${sql}
\`\`\`
</details>

**To add it:** run the SQL in Supabase → SQL Editor → Run, then close this issue. The nightly sync updates \`data.json\` (or trigger *Sync data.json from Supabase*).`);
})();
