# Cleanroom Process Tracker — Project Structure

```
cleanroom-tracker/
│
├── backend/                        # Python/FastAPI application root
│   ├── app/
│   │   ├── main.py                 # FastAPI app instantiation, router registration, lifespan
│   │   │
│   │   ├── api/                    # FastAPI route handlers, one file per resource
│   │   │   ├── __init__.py
│   │   │   ├── wafers.py           # CRUD + process graph endpoint
│   │   │   ├── steps.py            # Process step creation, update, status change
│   │   │   ├── runs.py             # Batch run management
│   │   │   ├── machines.py         # Machine list + parameter definition editor
│   │   │   ├── regions.py          # Region create/list/derive-inverse
│   │   │   ├── dies.py             # Die definition + history query
│   │   │   ├── recipes.py          # Etch recipe library CRUD
│   │   │   ├── measurements.py     # Measurement events + spatial point upload
│   │   │   ├── attachments.py      # File upload, parse trigger, download
│   │   │   ├── search.py           # Cross-entity full-text + filter search
│   │   │   └── export.py           # PDF report generation endpoint
│   │   │
│   │   ├── models/                 # SQLAlchemy ORM models (this session's output)
│   │   │   ├── __init__.py         # Imports all models; exposes Base
│   │   │   ├── base.py             # DeclarativeBase + shared mixin (id, timestamps, owner)
│   │   │   ├── user.py             # User entity (dormant auth in phase 1)
│   │   │   ├── wafer.py            # Wafer (the central physical substrate)
│   │   │   ├── process.py          # ProcessStep, ProcessEdge, ProcessRun
│   │   │   ├── machine.py          # Machine, MachineParameterDefinition, StepParameterValue
│   │   │   ├── region.py           # Region (spatial descriptors, reusable masks)
│   │   │   ├── die.py              # Die (named spatial subregion post-dicing)
│   │   │   ├── attachment.py       # DataAttachment (files linked to steps/runs/dies)
│   │   │   ├── recipe.py           # EtchRecipe, EtchRecipeStep, EtchRecipeGasFlow
│   │   │   ├── measurement.py      # Measurement + MeasurementPoint (spatial measurements)
│   │   │   ├── layer.py            # LayerDescriptor (phase 3 3D viewer foundation)
│   │   │   └── timelog.py          # TimeLog (dormant LIMS billing scaffold)
│   │   │
│   │   ├── schemas/                # Pydantic v2 request/response models (phase 1B)
│   │   │   └── __init__.py
│   │   │
│   │   ├── crud/                   # Database access layer — one file per model group
│   │   │   └── __init__.py         # Pure query functions, called by API routers
│   │   │
│   │   ├── parsers/                # Instrument data converter registry
│   │   │   ├── __init__.py         # Registry: maps (machine_id, extension) → parser fn
│   │   │   ├── base.py             # ParsedResult dataclass + Parser protocol
│   │   │   ├── p7_profilometer.py  # Tencor P7 .dat / .csv parser
│   │   │   └── optical_profiler.py # Optical profiler export parser
│   │   │
│   │   ├── storage/                # File storage abstraction (local ↔ S3-compatible)
│   │   │   ├── __init__.py
│   │   │   ├── base.py             # StorageBackend protocol (save, get, delete, url)
│   │   │   └── local.py            # LocalStorage: saves to /data/{user}/{wafer}/{step}/
│   │   │
│   │   └── core/                   # Cross-cutting configuration and utilities
│   │       ├── __init__.py
│   │       ├── config.py           # Settings (pydantic-settings): DB URL, storage path, JWT secret
│   │       ├── database.py         # SQLAlchemy engine + session factory + get_db dependency
│   │       └── auth.py             # JWT encode/decode (dormant in phase 1 — skeleton only)
│   │
│   ├── alembic/                    # Alembic migration environment
│   │   ├── env.py                  # Autogenerate target_metadata = Base.metadata
│   │   ├── script.py.mako          # Migration file template
│   │   └── versions/               # Generated migration scripts live here
│   │
│   ├── tests/                      # Pytest test suite
│   │   ├── conftest.py             # In-memory SQLite fixture, test client, seed data
│   │   ├── test_models/            # Unit tests for model relationships and constraints
│   │   └── test_api/               # Integration tests for API endpoints
│   │
│   ├── scripts/                    # One-off utility scripts (not part of the app)
│   │   └── seed_machines.py        # Seeds Machine + MachineParameterDefinition from YAML
│   │
│   ├── alembic.ini                 # Alembic config (script_location, sqlalchemy.url)
│   ├── pyproject.toml              # Python project metadata + dependencies
│   └── requirements.txt            # Pinned dependencies for reproducibility
│
├── frontend/                       # React 18 / TypeScript application (phase 1D)
│   ├── src/
│   │   ├── main.tsx                # React entrypoint
│   │   ├── App.tsx                 # Router setup (React Router v6)
│   │   │
│   │   ├── api/                    # Typed API client + React Query hooks
│   │   │   └── client.ts           # axios instance with base URL + auth header injection
│   │   │
│   │   ├── components/             # Reusable UI building blocks
│   │   │   ├── ProcessGraph/       # React Flow canvas: steps as nodes, edges as arrows
│   │   │   ├── StepForm/           # Category-aware form with machine parameter auto-pop
│   │   │   ├── RegionPicker/       # Wafer SVG diagram + polygon/circle/preset drawing
│   │   │   ├── MeasurementMap/     # Wafer diagram for clicking measurement point locations
│   │   │   ├── DieMap/             # Top-down wafer view with die grid and status colors
│   │   │   ├── AttachmentUploader/ # Drag-and-drop upload with parser status badge
│   │   │   └── WaferCard/          # Compact summary tile for dashboard and list views
│   │   │
│   │   ├── pages/                  # Route-level page components
│   │   │   ├── Dashboard.tsx       # Recent wafers, quick-add, activity feed
│   │   │   ├── WaferList.tsx       # Filterable wafer table
│   │   │   ├── WaferDetail.tsx     # Process graph + layer summary + die map
│   │   │   ├── StepDetail.tsx      # Parameters, attachments, region view for one step
│   │   │   ├── Machines.tsx        # Machine list + parameter definition editor
│   │   │   ├── Runs.tsx            # Batch run list and detail
│   │   │   └── Export.tsx          # Report preview + PDF download trigger
│   │   │
│   │   ├── store/                  # Global state (Zustand — lightweight, no boilerplate)
│   │   │   └── uiStore.ts          # Selected wafer, active step, sidebar open state
│   │   │
│   │   ├── types/                  # TypeScript interfaces mirroring backend schemas
│   │   │   └── index.ts
│   │   │
│   │   └── utils/                  # Pure helpers: formatters, coordinate transforms, etc.
│   │
│   ├── public/                     # Static assets
│   ├── index.html
│   ├── vite.config.ts
│   ├── tailwind.config.ts
│   └── tsconfig.json
│
├── data/                           # Local file storage (gitignored)
│   └── .gitkeep                    # Preserves folder in git; actual uploads are .gitignored
│
├── docs/                           # Project documentation
│   ├── DECISIONS.md                # Ongoing design decision log (you maintain this)
│   └── machines/                   # Per-machine parameter YAML seed files
│
├── docker-compose.yml              # Services: backend, (postgres in phase 2)
├── .env.example                    # Environment variable template
├── .gitignore
└── README.md
```

## Design Decision: Single ProcessStep Table vs. Subclasses

**Recommendation: Single table with `category` enum.**

The project already has a flexible, machine-driven parameter system
(`MachineParameterDefinition` → `StepParameterValue`). This means the
category-specific data (deposition pressure, etch recipe gas flows, spin
speed) lives in `StepParameterValue` rows — not in dedicated columns on
ProcessStep.

**If you used joined-table or single-table inheritance:**
- You'd gain type-safe Python classes (`DepositionStep`, `EtchStep`)
- But you'd duplicate the category distinction in both the class hierarchy
  AND the MachineParameterDefinition system, creating two sources of truth
- SQLAlchemy polymorphic queries add complexity (extra JOIN or discriminator column)
- Adding a new category later (e.g. "ion implant") requires a schema migration
  even though the parameter system handles it with zero code changes

**With a single table + category enum:**
- One `ProcessStep` table; the category field drives which parameter definitions
  the UI loads, which validation runs, which fields appear
- `EtchStep` semantics are carried by `ProcessStep.etch_recipe_id` (FK to EtchRecipe)
  and `ProcessStep.category == 'etching'`
- The process graph (`ProcessEdge`) and all foreign keys stay simple and uniform
- Adding categories is an enum value change + new MachineParameterDefinitions, no migration

**The one exception:** Etch steps have a structural relationship
(`etch_recipe_id`) that other categories don't. This is handled as a
nullable FK directly on `ProcessStep`. If 3–4 categories develop similar
unique FKs, revisit this decision.
