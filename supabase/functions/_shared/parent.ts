// Shared parent-validation guard for node writes.
// ---------------------------------------------------------------------------
// A recurring data bug broke the nightly validator (and the Sync / Auto-maintainer
// workflows): nodes were written with a parent that is not a real DB node — a
// SYNTHETIC runtime branch id (`nat_*`, `tech_*`, `techcat_*` — these exist only
// while the Alliance/Technology lenses are rendered, never in the database) or a
// null/unknown parent. The data validator then flags an orphaned parent and fails.
//
// safeParent() coerces any such parent to a real container, chosen from the node's
// home-country tag (tags.g), and returns null when it genuinely can't resolve one
// (the caller should then HOLD the item for review rather than write an orphan).

// tags.g (2-letter home) -> a real top-level container id that exists in the DB.
export const GEO_CONTAINER: Record<string, string> = {
  us: "b_us", fr: "eu_fr", de: "eu_de", it: "eu_it", nl: "eu_nl", tr: "eu_turkey", ua: "eu_ukraine",
  ca: "ca_grp", au: "au_grp", nz: "nz_grp",
  kr: "pt_kr", jp: "pt_jp", il: "pt_il", in: "pt_in", sg: "pt_sg", ae: "pt_ae", sa: "pt_sa",
  eu: "eu_inst", nato: "b_nato",
  // eu_central bucket (Central & Southern Europe)
  es: "eu_central", pt: "eu_central", pl: "eu_central", cz: "eu_central", sk: "eu_central",
  hu: "eu_central", gr: "eu_central", ro: "eu_central", bg: "eu_central", hr: "eu_central",
  si: "eu_central", al: "eu_central", mk: "eu_central", me: "eu_central", lu: "eu_central", be: "eu_central",
  // Nordics & Baltics
  se: "eu_nordic", no: "eu_nordic", fi: "eu_nordic", dk: "eu_nordic", is: "eu_nordic",
  ee: "eu_baltic", lv: "eu_baltic", lt: "eu_baltic",
  // uk intentionally omitted — UK orgs live under the thematic spine, so a UK org
  // with a broken parent is held for review rather than dumped into one bucket.
};

// A synthetic (runtime-only) branch id that must never be stored as a parent.
export function isSynthetic(id: string): boolean {
  return /^(nat_|tech_|techcat_)/.test(id || "");
}

export function geoOf(tags: unknown): string {
  if (tags && typeof tags === "object") {
    const g = (tags as { g?: unknown }).g;
    if (typeof g === "string") return g.toLowerCase();
    if (Array.isArray(g) && typeof g[0] === "string") return g[0].toLowerCase();
  }
  return "";
}

// Returns a valid, real parent id, or null when it can't be resolved.
// - keeps `parent` if it is a real (non-synthetic) node id in validIds
// - otherwise remaps to the home-country container from tags.g
// - otherwise returns null so the caller holds the item for manual review
export function safeParent(parent: string | undefined | null, tags: unknown, validIds: Set<string>): string | null {
  const p = String(parent || "").trim();
  if (p && !isSynthetic(p) && validIds.has(p)) return p;
  const c = GEO_CONTAINER[geoOf(tags)];
  if (c && validIds.has(c)) return c;
  return null;
}
