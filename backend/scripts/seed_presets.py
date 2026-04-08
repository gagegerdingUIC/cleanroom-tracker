"""
Seed common material presets (photoresists, developers, etc.) with
typical default process parameters.

Run: python -m scripts.seed_presets
"""

import sys
from pathlib import Path

# Add backend root to path so `app` package is importable
sys.path.insert(0, str(Path(__file__).resolve().parent.parent))

from app.core.database import SessionLocal
from app.models.preset import MaterialPreset


PRESETS = [
    {
        "name": "AZ1518",
        "preset_type": "photoresist",
        "description": "Positive-tone i-line resist, ~1.8 um at 4000 rpm.",
        "default_parameters": {
            "spin_coat": {
                "photoresist_type": "AZ1518",
                "spin_speed_rpm": "4000",
                "spin_time_s": "45",
            },
            "softbake": {
                "bake_type": "Softbake",
                "equipment": "Hotplate",
                "temp_c": "100",
                "duration_s": "60",
            },
            "exposure": {
                "dose_mj_cm2": "25",
            },
            "develop": {
                "process_type": "develop",
                "chemical": "AZ 300 MIF",
                "ratio": "undiluted",
                "duration_s": "60",
            },
        },
    },
    {
        "name": "AZ1505",
        "preset_type": "photoresist",
        "description": "Positive-tone i-line resist, ~0.5 um at 4000 rpm.",
        "default_parameters": {
            "spin_coat": {
                "photoresist_type": "AZ1505",
                "spin_speed_rpm": "4000",
                "spin_time_s": "45",
            },
            "softbake": {
                "bake_type": "Softbake",
                "equipment": "Hotplate",
                "temp_c": "100",
                "duration_s": "60",
            },
            "exposure": {
                "dose_mj_cm2": "18",
            },
            "develop": {
                "process_type": "develop",
                "chemical": "AZ 300 MIF",
                "ratio": "undiluted",
                "duration_s": "45",
            },
        },
    },
    {
        "name": "AZ5214",
        "preset_type": "photoresist",
        "description": "Image-reversal resist, ~1.4 um at 4000 rpm.",
        "default_parameters": {
            "spin_coat": {
                "photoresist_type": "AZ5214",
                "spin_speed_rpm": "4000",
                "spin_time_s": "45",
            },
            "softbake": {
                "bake_type": "Softbake",
                "equipment": "Hotplate",
                "temp_c": "110",
                "duration_s": "60",
            },
            "exposure": {
                "dose_mj_cm2": "30",
            },
            "post_exposure_bake": {
                "bake_type": "Post-exposure bake",
                "equipment": "Hotplate",
                "temp_c": "120",
                "duration_s": "120",
            },
            "flood_expose": {
                "duration_s": "60",
            },
            "develop": {
                "process_type": "develop",
                "chemical": "AZ 300 MIF",
                "ratio": "undiluted",
                "duration_s": "60",
            },
        },
    },
    {
        "name": "S1813",
        "preset_type": "photoresist",
        "description": "Positive-tone i-line resist, ~1.3 um at 4000 rpm.",
        "default_parameters": {
            "spin_coat": {
                "photoresist_type": "S1813",
                "spin_speed_rpm": "4000",
                "spin_time_s": "30",
            },
            "softbake": {
                "bake_type": "Softbake",
                "equipment": "Hotplate",
                "temp_c": "115",
                "duration_s": "60",
            },
            "exposure": {
                "dose_mj_cm2": "100",
            },
            "develop": {
                "process_type": "develop",
                "chemical": "MF-319",
                "ratio": "undiluted",
                "duration_s": "60",
            },
        },
    },
    {
        "name": "SU-8",
        "preset_type": "photoresist",
        "description": "Negative-tone epoxy resist, thick film capable.",
        "default_parameters": {
            "spin_coat": {
                "photoresist_type": "SU-8",
                "spin_speed_rpm": "3000",
                "spin_time_s": "30",
            },
            "softbake": {
                "bake_type": "Softbake",
                "equipment": "Hotplate",
                "temp_c": "95",
                "duration_s": "120",
            },
            "exposure": {
                "dose_mj_cm2": "150",
            },
            "post_exposure_bake": {
                "bake_type": "Post-exposure bake",
                "equipment": "Hotplate",
                "temp_c": "95",
                "duration_s": "120",
            },
            "develop": {
                "process_type": "develop",
                "chemical": "PGMEA",
                "ratio": "undiluted",
                "duration_s": "120",
            },
        },
    },
    {
        "name": "PMMA",
        "preset_type": "photoresist",
        "description": "E-beam positive resist.",
        "default_parameters": {
            "spin_coat": {
                "photoresist_type": "PMMA",
                "spin_speed_rpm": "4000",
                "spin_time_s": "45",
            },
            "softbake": {
                "bake_type": "Softbake",
                "equipment": "Hotplate",
                "temp_c": "180",
                "duration_s": "90",
            },
            "develop": {
                "process_type": "develop",
                "chemical": "MIBK:IPA",
                "ratio": "1:3",
                "duration_s": "60",
            },
        },
    },
    {
        "name": "LOR1A",
        "preset_type": "photoresist",
        "description": "Lift-off resist underlayer, ~100 nm at 4000 rpm. Used under imaging resist for bilayer lift-off.",
        "default_parameters": {
            "spin_coat": {
                "photoresist_type": "LOR1A",
                "spin_speed_rpm": "4000",
                "spin_time_s": "45",
            },
            "softbake": {
                "bake_type": "Softbake",
                "equipment": "Hotplate",
                "temp_c": "170",
                "duration_s": "300",
            },
            "develop": {
                "process_type": "develop",
                "chemical": "MF-319",
                "ratio": "undiluted",
                "duration_s": "60",
            },
        },
    },
    {
        "name": "LOR10A",
        "preset_type": "photoresist",
        "description": "Lift-off resist underlayer, ~1 um at 4000 rpm. Thicker version of LOR series for bilayer lift-off.",
        "default_parameters": {
            "spin_coat": {
                "photoresist_type": "LOR10A",
                "spin_speed_rpm": "4000",
                "spin_time_s": "45",
            },
            "softbake": {
                "bake_type": "Softbake",
                "equipment": "Hotplate",
                "temp_c": "170",
                "duration_s": "300",
            },
            "develop": {
                "process_type": "develop",
                "chemical": "MF-319",
                "ratio": "undiluted",
                "duration_s": "60",
            },
        },
    },
    # ==========================================================================
    # SPUTTER TARGETS (CVC SC-4000)
    # ==========================================================================
    {
        "name": "Nb",
        "preset_type": "sputter_target",
        "description": "Niobium — standard superconducting film on CVC SC-4000.",
        "default_parameters": {
            "sputter": {
                "basePressure": "2e-6",
                "chamberPressure": "0.442",
                "argonFlow": "30",
                "nitrogenFlow": "7",
                "rfPower": "200",
                "precleanTime": "10",
                "motorSpeed": "10",
                "depositionTime": "5",
            },
        },
    },
    {
        "name": "Ti",
        "preset_type": "sputter_target",
        "description": "Titanium — adhesion layer / barrier on CVC SC-4000.",
        "default_parameters": {
            "sputter": {
                "basePressure": "2e-6",
                "chamberPressure": "",
                "argonFlow": "30",
                "nitrogenFlow": "",
                "rfPower": "200",
                "precleanTime": "10",
                "motorSpeed": "10",
                "depositionTime": "",
            },
        },
    },
    {
        "name": "Co",
        "preset_type": "sputter_target",
        "description": "Cobalt on CVC SC-4000.",
        "default_parameters": {
            "sputter": {
                "basePressure": "2e-6",
                "chamberPressure": "",
                "argonFlow": "30",
                "nitrogenFlow": "",
                "rfPower": "200",
                "precleanTime": "10",
                "motorSpeed": "10",
                "depositionTime": "",
            },
        },
    },
    {
        "name": "NbTi",
        "preset_type": "sputter_target",
        "description": "Niobium-Titanium alloy on CVC SC-4000.",
        "default_parameters": {
            "sputter": {
                "basePressure": "2e-6",
                "chamberPressure": "",
                "argonFlow": "30",
                "nitrogenFlow": "",
                "rfPower": "200",
                "precleanTime": "10",
                "motorSpeed": "10",
                "depositionTime": "",
            },
        },
    },
]


def seed():
    db = SessionLocal()
    try:
        existing = {p.name for p in db.query(MaterialPreset).all()}
        added = 0
        for data in PRESETS:
            if data["name"] not in existing:
                db.add(MaterialPreset(**data))
                added += 1
        db.commit()
        print(f"Seeded {added} material presets ({len(existing)} already existed).")
    finally:
        db.close()


if __name__ == "__main__":
    seed()
