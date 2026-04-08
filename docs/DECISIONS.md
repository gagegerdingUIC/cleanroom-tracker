# Design Decision Log

A running log of every significant design decision made during the
project.  Start every new AI session by referencing this file.

---

## 2026-02-23 — Project Foundation

**Wafer ID convention:** `W-YYYY-NNN` (e.g. `W-2026-001`).
Unique per owner. Enforced by `UNIQUE(wafer_id, owner_id)` in the database.

**Coordinate system:** `wafer_mm` — millimetres from wafer centre,
flat/notch pointing in the −Y direction.  MeasurementPoints use µm
(micrometres) for sub-millimetre profilometer precision.

**Single ProcessStep table** (not subclasses per category).
Rationale: the MachineParameterDefinition/StepParameterValue system already handles
category-specific data.  Two sources of truth would be worse than one flexible table.
See STRUCTURE.md for full rationale.

**EtchRecipe FK on ProcessStep** (`etch_recipe_id`).
Added during model design — not in original spec.  Etch steps must reference the recipe
used.  Field is nullable to allow historical data entry without a recipe.

**Measurement.instrument is a free-text string** (phase 1).
Will be upgraded to a FK to Machine in phase 1B once profilometer Machine rows are seeded.
See SCHEMA_NOTES.md #8.

**Kapton tape: both a step and a region.**
The "Apply Kapton" step creates a Region of type `kapton`.  The subsequent deposition
step's `region_id` points to the inverse of that region (the exposed wafer area).

**`TimeLog.billing_rate_id` is VARCHAR(36)** (not a proper UUID FK).
The BillingRate table doesn't exist yet.  The column is a placeholder that will be
migrated to a real FK in phase 2.

---

_Add new decisions below with the date and a brief rationale._
