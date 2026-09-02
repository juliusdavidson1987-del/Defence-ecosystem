// Deterministic drafting engine — testable in Node, embeddable in the HTML tool.
export const COUNTRY = {
  france:['fr','eu_fr'],germany:['de','eu_de'],italy:['it','eu_it'],netherlands:['nl','eu_nl'],
  belgium:['be','eu_central'],sweden:['se','eu_nordic'],norway:['no','eu_nordic'],finland:['fi','eu_nordic'],denmark:['dk','eu_nordic'],
  estonia:['ee','eu_baltic'],latvia:['lv','eu_baltic'],lithuania:['lt','eu_baltic'],
  poland:['pl','eu_central'],czechia:['cz','eu_central'],slovakia:['sk','eu_central'],hungary:['hu','eu_central'],
  spain:['es','eu_central'],portugal:['pt','eu_central'],greece:['gr','eu_central'],romania:['ro','eu_central'],
  bulgaria:['bg','eu_central'],croatia:['hr','eu_central'],slovenia:['si','eu_central'],albania:['al','eu_central'],
  'north macedonia':['mk','eu_central'],montenegro:['me','eu_central'],luxembourg:['lu','eu_central'],iceland:['is','eu_central'],
  turkiye:['tr','eu_turkey'],turkey:['tr','eu_turkey'],ukraine:['ua','eu_ukraine'],
  canada:['ca','ca_grp'],australia:['au','au_grp'],'new zealand':['nz','nz_grp'],
  'south korea':['kr','pt_kr'],japan:['jp','pt_jp'],israel:['il','pt_il'],
  india:['in','pt_in'],singapore:['sg','pt_sg'],uae:['ae','pt_ae'],'united arab emirates':['ae','pt_ae'],
  'saudi arabia':['sa','pt_sa'],saudi:['sa','pt_sa'],'united kingdom':['uk',null],uk:['uk',null]
};
export const TYPE_TAGS = {
  gov:{w:['govmil'],o:['advice'],a:'open'},military:{w:['govmil'],o:['contract'],a:'restricted'},
  procurement:{w:['govmil'],o:['procurement'],a:'portal'},intel:{w:['govmil'],o:['contract'],a:'restricted'},
  nuclear:{w:['govmil'],o:['contract'],a:'restricted'},academic:{w:['academic'],o:['research'],a:'open'},
  research:{w:['academic'],o:['research'],a:'open'},rto:{w:['academic','sme'],o:['research','advice'],a:'open'},
  test:{w:['govmil'],o:['test'],a:'restricted'},prime:{w:['prime'],o:['contract'],a:'prime'},
  supply:{w:['sme'],o:['product'],a:'open'},sme:{w:['sme'],o:['product'],a:'open'},
  startup:{w:['startup'],o:['product'],a:'open'},investor:{w:['investor'],o:['investment'],a:'open'},
  policy:{w:['academic'],o:['advice'],a:'open'},innovation:{w:['govmil'],o:['grant'],a:'open'}
};
// UK is thematic, not a country bucket — best-guess branch by type (user can override).
const UK_BRANCH = { gov:'b_gov',military:'b_flc',intel:'b_flc',procurement:'b_acq',prime:'b_primes',supply:'b_supply',
  sme:'b_tech',startup:'b_tech',investor:'f_vc',academic:'b_sti',research:'b_sti',rto:'b_sti',
  policy:'b_gov',innovation:'b_sti',test:'b_te',nuclear:'b_nuke' };
export const KNOWN_DOMAINS = ['ai','space','cyber','c4isr','comms','maritime','land','air','counteruas','weapons','directed','hypersonic','nuclear','simulation','training','logistics','energy','materials','human','quantum','xcut'];

export const slug = s => s.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g,'').replace(/&/g,'and').replace(/[^a-z0-9]+/g,'').slice(0,22);

export function suggestParent(type, nation){
  const c = COUNTRY[(nation||'').toLowerCase().trim()];
  if(!c) return { parent:null, prefix:null, note:'Unknown nation — pick a parent manually.' };
  const [prefix,parent] = c;
  if(prefix==='uk') return { parent: UK_BRANCH[type]||'b_tech', prefix:'uk', note:'UK is thematic — parent is a best guess by type; adjust if needed.' };
  // funding types override the country bucket
  if(type==='investor') return { parent:'f_vc', prefix, note:"Investor → Funding → Defence & dual-use VCs (adjust to f_public if government capital)." };
  return { parent, prefix, note:'' };
}
export function makeId(name, prefix, existingIds){
  let base = (prefix && prefix!=='uk') ? prefix+'_'+slug(name) : slug(name);
  let id = base, k=2; while(existingIds.has(id)){ id = base+k; k++; }
  return id;
}
export function buildTags(type, domains, prefix, trl){
  const t = TYPE_TAGS[type]; if(!t) return null;
  const d = (domains||[]).map(x=>x.trim().toLowerCase()).filter(x=>KNOWN_DOMAINS.includes(x));
  const geo = ['fr','de','it','nl'].includes(prefix)?prefix : (['eu_central','eu_nordic','eu_baltic'].includes(prefix)?'eu':prefix);
  return { w:t.w, o:t.o, t: trl&&trl.length===2?trl:[3,9], d: d.length?d:['xcut'], a:t.a, g: geo||'uk' };
}
// Dedupe: score existing nodes by name-token overlap and domain match.
export function dedupeCheck(name, url, nodes){
  const host = (url||'').replace(/^https?:\/\//i,'').replace(/\/.*/,'').replace(/^www\./,'').toLowerCase();
  const toks = new Set(slug(name).match(/.{3,}/g)||[]);
  const nmeLc = name.toLowerCase().replace(/[^a-z0-9 ]/g,'');
  const hits = [];
  for(const n of nodes){
    const lab=(n.label||'').toLowerCase(); const ent=(n.entry||'').toLowerCase();
    let score=0, why=[];
    // exact-ish label containment
    const labClean = lab.replace(/^[^—:]*[—:]\s*/,'').replace(/[^a-z0-9 ]/g,'').trim();
    if(labClean && (labClean.includes(nmeLc)||nmeLc.includes(labClean))){ score+=5; why.push('similar name'); }
    // domain match
    if(host && ent.includes(host)){ score+=6; why.push('same domain'); }
    // token overlap
    const overlap=[...toks].filter(t=>lab.replace(/[^a-z0-9]/g,'').includes(t)).length;
    if(overlap>=2){ score+=overlap; why.push(overlap+' word match'); }
    if(score>=5) hits.push({ id:n.id, label:n.label, entry:n.entry, score, why:[...new Set(why)] });
  }
  return hits.sort((a,b)=>b.score-a.score).slice(0,6);
}
export function buildNode({name,url,nation,type,domains,trl,does}, existingIds){
  const sp = suggestParent(type, nation);
  const id = makeId(name, sp.prefix, existingIds);
  const tags = buildTags(type, domains, sp.prefix, trl);
  const countryName = (nation||'').replace(/\b\w/g, ch=>ch.toUpperCase());
  const label = /—|:/.test(name) ? name : (sp.prefix&&sp.prefix!=='uk' ? `${countryName} — ${name}` : name);
  return { id, label, parent: sp.parent, kind:'org', entry:url, does, tags, _parentNote: sp.note };
}
export function nodeToSQL(n){
  const esc=s=>String(s).replace(/'/g,"''");
  return `insert into public.nodes (id, label, parent, kind, does, entry, tags, status)\n`+
    `values ('${n.id}', '${esc(n.label)}', '${n.parent}', 'org', '${esc(n.does)}', '${esc(n.entry)}', '${esc(JSON.stringify(n.tags))}'::jsonb, 'published')\n`+
    `on conflict (id) do update set label=excluded.label, parent=excluded.parent, does=excluded.does, entry=excluded.entry, tags=excluded.tags, status='published';`;
}
