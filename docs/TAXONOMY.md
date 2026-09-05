# The Defence Ecosystem — domain taxonomy (v2)

The single source of truth for the technology-domain taxonomy (`tags.d`). Two
levels: **categories** (navigation/display) group **subcategories** (the actual
flat, multi-valued tags a node carries). A node can hold several subcategory tags
across categories — the categories are a lens over the flat tags, not a home.

Keep this in sync with `TECH_TAX` in `index.html`, `KNOWN_DOMAINS` in
`drafter-engine.mjs`, `validate-data.mjs`, and the `TAG_VOCAB` strings in the Edge
Functions.

| Category | Subcategory (tag key) |
|---|---|
| **AI, autonomy & software** | `ai` AI & machine learning · `autonomy` Autonomy & robotics · `software` Software, data & digital infrastructure · `wargaming` Decision support & wargaming |
| **Cyber, EW & comms** | `cyber` Cyber & information security · `ew` Electronic warfare & spectrum · `comms` Communications & networks · `pnt` Position, navigation & timing · `quantum` Quantum |
| **Sensing, ISR & space** | `c4isr` C4ISR, sensors & radar · `space` Space systems · `eoisr` Earth observation & space ISR |
| **Platforms & domains** | `air` Air & uncrewed · `land` Land systems · `maritime` Maritime & undersea |
| **Weapons & effects** | `weapons` Weapons, munitions & missiles · `directed` Directed energy · `hypersonic` Hypersonics · `counteruas` Counter-UAS & air/missile defence |
| **Strategic & deterrence** | `nuclear` Nuclear · `cbrn` CBRN & counter-WMD |
| **Sustainment & industrial base** | `logistics` Logistics & sustainment · `energy` Energy, power & propulsion · `materials` Advanced materials & manufacturing · `microelec` Microelectronics & semiconductors |
| **Human & medical** | `medical` Combat casualty care & medical · `humanperf` Human performance & augmentation · `training` Training & education · `simulation` Modelling & simulation |
| **Cross-cutting functions** | `xfund` Funding & capital · `xtest` Test & evaluation · `xacad` Academia & research · `xproc` Procurement & policy · `xother` Cross-cutting bodies |

`xcut` remains a valid generic "cross-cutting / unspecified domain" tag (buckets
under **Cross-cutting functions → other**).

## New / changed vs v1
- **Split** `human` → `medical` (casualty care, med-devices, biotech) and
  `humanperf` (performance, augmentation, cognitive). `human` stays a valid alias
  (unspecified) until the retag replaces it.
- **Promoted** `quantum` to its own subcategory (was folded into cyber's label).
- **Added** `autonomy`, `software`, `ew`, `pnt`, `eoisr`, `cbrn`, `microelec`.
- Everything else maps **1:1** from v1 (identity).

## Old → new mapping (for the retag)
Identity for: `ai, space, cyber, c4isr, comms, maritime, land, air, counteruas,
weapons, directed, hypersonic, nuclear, simulation, wargaming, training, logistics,
energy, materials, quantum, xcut` and the `x*` function buckets. Only `human` is
split (needs per-node judgement); the new keys are added where they apply. The
retag is additive/refining — it preserves sensible existing tags and adds the finer
ones, never blindly overwriting.
