# Schema Notes — Design Decisions, Gaps, and Flagged Inconsistencies

> These are issues spotted by cross-referencing your workflow description
> against the data model.  Review each one and decide whether to act on
> it before moving to the API layer.

---

## 1. Added: `ProcessStep.etch_recipe_id` (not in original spec)

**What was added:** A nullable FK `etch_recipe_id → etch_recipes.id` on `ProcessStep`.

**Why:** Your workflow says "Etching: Recipe system — select a saved recipe from library OR
create a new one on the fly."  Without this FK, there is no structured link between an etch
step and the recipe it used.  The recipe system is only useful if etch steps can reference it.

**What this enables:**
- Query: "which of my wafers used the Nb_etch_v3 recipe?" — trivial join
- Recipe provenance: you can see which runs used a one-off recipe and which used a saved one
- Recipe promotion: after a one-off run, you can flip `is_template=True` on the recipe and
  it becomes part of the library with full history intact

**Action required:** None — it is already in the model.  When logging an etch step, always
set `etch_recipe_id`.  The field is nullable to allow etch steps entered without a recipe
(e.g. historical data entry), but it should be treated as required in the UI.

---

## 2. Gap: Spin coat and bake parameters have no dedicated home

**Workflow says:** Lithography includes spin coat (RPM, spin time, accel, decel) and bake
(time, temp), and optional prebake.

**Schema approach:** These are stored as `StepParameterValue` rows against the lithography
step.  They are **not** attached to a Machine row (spin coaters and ovens are often not
tracked as equipment entities the way the RIE or sputterer are).

**Options:**
1. **Ad-hoc StepParameterValues** (current schema) — type `param_name` manually or define
   it in a MachineParameterDefinition against a "Spin Coater" Machine entry.
2. **Add a SpinCoater and Oven as Machine entries** — gives you the dropdown UI and
   structured form.  Recommended if you use the same equipment every time.
3. **Dedicated LithographyMetadata table** — a separate row per lithography step storing
   resist type, RPM, bake time, etc. in typed columns.  Adds a table but is queryable
   without parsing raw strings.

**Recommendation:** In phase 1, use option 1 (ad-hoc StepParameterValues) to keep the
schema simple.  If you find yourself searching for "all wafers spun at 4000 RPM", add
a SpinCoater Machine + Definitions (option 2) so the values are indexed and filterable.

---

## 3. Gap: Photoresist type has no structured field

**Workflow says:** "Photoresist: AZ1518, AZ1505, PMMA (dropdown)"

**Current schema:** There is no dedicated `resist_type` field on ProcessStep or a
LithographyMetadata table.  Resist type would currently live as a StepParameterValue with
`param_name='photoresist_type'` and `value_raw='AZ1518'`.

**Why this matters:** Resist type is a searchable, filterable attribute ("show me all
lithography steps where I used PMMA").  Storing it in the key-value table means queries
require a JOIN plus a string filter on `param_name = 'photoresist_type'` — doable but
verbose.

**Recommendation:** Define a `MachineParameterDefinition` with `name='photoresist_type'`
against your lithography exposure tools.  This keeps it structured without a schema change.
Alternatively, add a dedicated `resist_material` column to ProcessStep in a future
migration (small, safe change).

---

## 4. Gap: Developer and ratio have no dedicated home

**Workflow says:** "Developer: AZ 340, AZ 400, etc. (dropdown), ratio to DI water (1:2, 1:3),
develop time (min)"

Same situation as resist type — these should be `StepParameterValue` rows.  Define them
in `MachineParameterDefinition` against your lithography machine(s) so the form pre-populates.

Consider adding a `developer_type` enum in a future migration if querying by developer is common.

---

## 5. Inconsistency: Deposition pre-clean is described as a sub-step

**Workflow says:** "Pre-clean: shutter closed, power (100/200/300 W), duration (5/10/30 min)"
and implies this happens before deposition but is part of the same tool session.

**Schema question:** Is pre-clean a separate `ProcessStep` linked by a `ProcessEdge`, or
parameters on the deposition step?

**Recommendation:** Model the pre-clean as **parameters on the deposition step** (not a
separate step) using `StepParameterValue` rows with names like `preclean_power_w` and
`preclean_time_min`.  Rationale: the pre-clean happens on the same machine in the same
tool session with no intervening state change on the wafer — it is not a distinct process
node in the graph.  If you want it visible in the graph as its own node (for a more
detailed timeline), model it as a short preceding step with `category='miscellaneous'`
linked by an edge to the deposition step.

---

## 6. Inconsistency: Kapton tape is a Region, a Step, or both?

**Workflow says:** "Masking: Kapton tape applied lengthwise — this is a Miscellaneous step
before deposition."

**In the schema:** Kapton tape is modelled as both:
- A **ProcessStep** (`category='miscellaneous'`, name='Apply Kapton tape')
- A **Region** (`region_type='kapton'`) that the deposition step's `region_id` references
  (i.e. the region the tape does NOT cover is what gets deposited on, or vice versa)

**Action required:** When you log a Kapton tape step, also create a Region of type `kapton`
for the geometry of the tape area.  The subsequent deposition step can then set `region_id`
to that region or its inverse depending on convention.  The RegionPicker UI should have a
"Kapton tape" preset button that creates this region automatically.

---

## 7. Gap: GDS pattern file has no dedicated field

**Workflow says:** "Pattern file: .gds filename"

**Current options:**
1. Store as a `DataAttachment` with `attachment_type='raw_instrument'` and
   `label='GDS pattern file'`.  Fully supported today.
2. Store as a `StepParameterValue` with `param_name='gds_filename'` and
   `value_raw='pattern_v3.gds'`.  Simpler but less structured.
3. Add a `pattern_file_path` column to ProcessStep.  Most structured but requires a
   migration.

**Recommendation:** Use option 1 (DataAttachment) for now.  The `.gds` file is a real
file artifact that belongs in file storage with a checksum.  If you later build a GDS
viewer, the attachment system already points to the file.

---

## 8. Gap: Measurement instrument is a free-text string, not a FK to Machine

**Current schema:** `Measurement.instrument` is a `String(128)` field
(e.g. 'P7 Profilometer', 'Optical Profiler').

**Implications:**
- No dropdown; instrument names must be typed consistently
- Searching "all measurements taken with the P7" requires a string match, not a FK join
- Instrument-level metadata (calibration, notes) lives nowhere

**Upgrade path (low-migration-cost):** Add your profilometers and ellipsometers as `Machine`
rows with `category='characterization'`.  Then migrate `Measurement.instrument` to
`Measurement.machine_id` (UUID FK).  This is a straightforward Alembic migration.  The
old string values can be mapped to UUIDs in a data migration script.

**Recommendation:** Do this upgrade at the start of phase 1 — it costs one extra machine
seed row per instrument and makes all measurement queries cleaner from day one.

---

## 9. Gap: No explicit `average_reflected_power_w` field (deposition)

**Workflow says:** "Average reflected power (W)" is logged for RF sputtering.

**Current schema:** This lives as a `StepParameterValue` with `param_name='avg_reflected_power_w'`
and `param_type='output'` (it is a machine readback, not a set-point).

**Action required:** When seeding MachineParameterDefinitions for your sputterer, add this
as a `ParamType.output` parameter.  It will then appear automatically in the measured-values
section of the step form.

---

## 10. Gap: Motor speed field (deposition)

**Workflow says:** "Motor speed (0–10 arb. units)" for sputtering.

Same as above — model as a `MachineParameterDefinition` with `param_type='input'`,
`data_type='float'`, `unit=''` (or 'arb.'), `min_value=0`, `max_value=10`.

---

## 11. Gap: NbTi composition ratio has no structured field

**Workflow says:** "Material: Niobium, Titanium, NbTi (with ratio e.g. 30:70)"

**Current schema:** `LayerDescriptor.material` is a free-text field.  A ratio like "30:70"
would be stored as part of the string, e.g. `material='NbTi-30:70'`.

**Recommendation:** This is fine for phase 1.  If you later need to query "all depositions
where Nb content > 70%", add separate `material_base` and `composition_json` fields to
LayerDescriptor.  For now, adopt a consistent naming convention (e.g. `NbTi-30:70` where
the first number is Nb percentage).

---

## 12. Minor: `Wafer.resistivity_ohm_cm` units note

**Workflow says:** "Resistivity (Ω/sq)" — this is sheet resistance, not bulk resistivity.

Sheet resistance is in Ω/□ (ohms per square).  Bulk resistivity is in Ω·cm.  These are
different quantities.  The schema field is named `resistivity_ohm_cm`, implying bulk
resistivity.

**Recommendation:** Decide which you actually measure and rename accordingly.  If your
vendor provides both, add both fields:
- `resistivity_ohm_cm Float` — bulk (as currently defined)
- `sheet_resistance_ohm_sq Float nullable` — for thin-film measurements

---

## 13. Gap: Cleaning step options have no structured field

**Workflow says:** Cleaning options include "triple wash (acetone → IPA → DI → N2)",
"sonication in acetone", "sonication in warm AZ Kwik Strip (60°C)", "1165 Remover".

**Current schema:** A cleaning step is `ProcessStep(category='miscellaneous')`.  The
specific cleaning procedure lives as a `StepParameterValue` with `param_name='cleaning_method'`.

**Recommendation:** Create a `MachineParameterDefinition` for a generic "Wet Bench" machine
with `name='cleaning_method'`, `data_type='string'`, and seed the `default_value` with a
JSON list of options that the UI can render as a dropdown.  This gives you a structured
dropdown without a schema change.

---

## 14. Confirmed correct: Directed graph for looping workflows

Your workflow explicitly includes "etch → inspect → etch again" loops.  The `ProcessEdge`
table correctly supports this — a step can have outgoing edges back to an earlier step
(cycle in the graph).  React Flow renders directed graphs with cycles.

**No action required.**

---

## 15. Confirmed correct: Dicing, Wirebonding, Superconducting Measurements as placeholders

**Workflow says:** "Placeholder steps for now. Full parameter logging to be added later."

These are correctly modelled as `ProcessStep` rows with appropriate categories
(`packaging` or `characterization`) and no required parameter values.  When you're ready
to add parameters, just seed new `MachineParameterDefinition` rows for the relevant
machine — no schema change needed.

---

## Summary: Actions before starting Phase 1B (API layer)

| # | Action | Priority |
|---|--------|----------|
| 1 | Decide: add `SpinCoater` and `Oven` as Machine rows, or use ad-hoc params | High |
| 2 | Decide: upgrade `Measurement.instrument` to FK to Machine | High |
| 3 | Add profilometer, optical profiler, ellipsometer as Machine rows | High |
| 4 | Clarify `resistivity_ohm_cm` vs. `sheet_resistance_ohm_sq` | Medium |
| 5 | Adopt consistent `material` naming convention for NbTi alloys | Medium |
| 6 | Decide GDS file storage: DataAttachment (recommended) or StepParameterValue | Low |
| 7 | Document Kapton tape region convention in DECISIONS.md | Low |
