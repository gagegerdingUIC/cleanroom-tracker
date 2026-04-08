"""
Seed script for machines and their parameter definitions.
Run AFTER the initial Alembic migration.

Usage:
    python backend/scripts/seed_machines.py

DECISIONS APPLIED:
- Trion ICP RIE: readbacks ONLY — all process conditions live in EtchRecipe
- P7: scan settings only — measurement values go in Measurement/MeasurementPoint
- Position is parsed from P7 file header (Angstroms → µm, wafer-centered, flat at -X)

Lines marked ← YOU need your input before this entry is correct.
"""

import sys
import os
sys.path.insert(0, os.path.join(os.path.dirname(__file__), ".."))

from app.core.database import SessionLocal
from app.models import Machine, MachineParameterDefinition
from app.models import StepCategory, ParamType, ParamDataType


MACHINES = [

    # =========================================================================
    # ETCHING
    # =========================================================================

    {
        # Trion Minilock Phantom III RIE/ICP
        # READBACKS ONLY — pressure, RF, gas flows, timing all live in EtchRecipe
        "machine": {
            "name": "Trion Phantom III ICP RIE",
            "category": StepCategory.etching,
            "abbreviation": "ICP-RIE",
            "is_active": True,
            "notes": "",  # Gas 1: SiCl4, Gas 2: SF6, Gas 3: O2/CHF3/CClF2, Gas 4: Cl2, Gas 5: CF4/Ar/He-O2, Gas 6: NF3, Gas 7: H2, Gas 8: CH4 
        },
        "params": [
            {"name": "pressure_set","display_name": "Pressure Set (mT)", "param_type": ParamType.input,   "data_type": ParamDataType.float_,  "unit": "mT",  "is_required": True, "sort_order": 0},
            {"name": "top_rf_set", "display_name": "Top RF Set (W)",  "param_type": ParamType.input,   "data_type": ParamDataType.float_,  "unit": "W",  "is_required": True, "sort_order": 1},
            {"name": "top_refl_set", "display_name": "Top Refl. Tol Set (W)",  "param_type": ParamType.input,   "data_type": ParamDataType.float_,  "unit": "W",  "is_required": False, "sort_order": 2},
            {"name": "bot_rf_set", "display_name": "Botm. RF Set (W)",  "param_type": ParamType.input,   "data_type": ParamDataType.float_,  "unit": "W",  "is_required": True, "sort_order": 3},
            {"name": "bot_refl_set", "display_name": "Botm. Refl. Tol Set (W)",  "param_type": ParamType.input,   "data_type": ParamDataType.float_,  "unit": "W",  "is_required": False, "sort_order": 4},
            {"name": "rf_stable_set", "display_name": "RF Stable Time (s)",  "param_type": ParamType.input,   "data_type": ParamDataType.float_,  "unit": "s",  "is_required": True, "sort_order": 5},
            {"name": "process_time_set", "display_name": "Process Time Set(s)",  "param_type": ParamType.input,   "data_type": ParamDataType.float_,  "unit": "s",  "is_required": True, "sort_order": 6},
            {"name": "gas_1_rate_set", "display_name": "SiCl4",  "param_type": ParamType.input,   "data_type": ParamDataType.float_,  "unit": "s",  "is_required": True, "sort_order": 6},

            #Same as above but with read instead of set and including all the gases
        ]
    },



    # =========================================================================
    # DEPOSITION
    # =========================================================================

    {
        # CVC SC-4000 RF Sputtering — Nb, NbTi, Ti, Co depositions
        "machine": {
            "name": "CVC SC-4000 Sputtering",
            "category": StepCategory.deposition,
            "abbreviation": "CVC-SPUT",
            "is_active": True,
            "notes": "Targets: Nb, Ti, Co, NbTi",
        },
        "params": [
            {"name": "target",                 "display_name": "Target Material",            "param_type": ParamType.input,   "data_type": ParamDataType.string,  "unit": "",      "is_required": True,  "sort_order": 0},
            {"name": "base_pressure_torr",     "display_name": "Base Pressure (Torr)",       "param_type": ParamType.input,   "data_type": ParamDataType.float_,  "unit": "Torr",  "is_required": False, "sort_order": 1},
            {"name": "chamber_pressure_mtorr", "display_name": "Chamber Pressure (mTorr)",   "param_type": ParamType.input,   "data_type": ParamDataType.float_,  "unit": "mTorr", "is_required": True,  "sort_order": 2},
            {"name": "argon_flow_sccm",        "display_name": "Argon Flow (sccm)",          "param_type": ParamType.input,   "data_type": ParamDataType.float_,  "unit": "sccm",  "is_required": True,  "sort_order": 3},
            {"name": "nitrogen_flow_sccm",     "display_name": "Nitrogen Flow (sccm)",       "param_type": ParamType.input,   "data_type": ParamDataType.float_,  "unit": "sccm",  "is_required": False, "sort_order": 4},
            {"name": "rf_power_w",             "display_name": "RF Power (W)",               "param_type": ParamType.input,   "data_type": ParamDataType.float_,  "unit": "W",     "is_required": True,  "sort_order": 5},
            {"name": "dc_bias_v",              "display_name": "DC Bias (V)",                "param_type": ParamType.output,  "data_type": ParamDataType.float_,  "unit": "V",     "is_required": False, "sort_order": 6},
            {"name": "avg_reflected_power_w",  "display_name": "Avg Reflected Power (W)",    "param_type": ParamType.output,  "data_type": ParamDataType.float_,  "unit": "W",     "is_required": False, "sort_order": 7},
            {"name": "preclean_time_min",      "display_name": "Pre-clean Duration (min)",   "param_type": ParamType.input,   "data_type": ParamDataType.float_,  "unit": "min",   "is_required": False, "sort_order": 8},
            {"name": "motor_speed",            "display_name": "Motor Speed (1–10)",         "param_type": ParamType.input,   "data_type": ParamDataType.float_,  "unit": "",      "is_required": False, "sort_order": 9},
            {"name": "substrate_temp_c",        "display_name": "Substrate Temp (\u00b0C)",        "param_type": ParamType.input,   "data_type": ParamDataType.float_,  "unit": "\u00b0C",    "is_required": False, "sort_order": 10},
            {"name": "deposition_time_min",    "display_name": "Deposition Time (min)",      "param_type": ParamType.input,   "data_type": ParamDataType.float_,  "unit": "min",   "is_required": True,  "sort_order": 11},
        ]
    },



    # =========================================================================
    # LITHOGRAPHY
    # =========================================================================

    {
        # Heidelberg DWL66fs — laser direct write
        "machine": {
            "name": "Heidelberg DWL66fs",
            "category": StepCategory.lithography,
            "abbreviation": "DWL66",
            "is_active": True,
            "notes": "",
        },
        "params": [
            {"name": "pattern_file",    "display_name": "Pattern File (.gds)",  "param_type": ParamType.input, "data_type": ParamDataType.string, "unit": "",  "is_required": True,  "sort_order": 0},
            {"name": "energy_percent",  "display_name": "Energy (%)",           "param_type": ParamType.input, "data_type": ParamDataType.float_, "unit": "%", "is_required": False, "sort_order": 1},
            {"name": "focus_offset",    "display_name": "Focus Offset",         "param_type": ParamType.input, "data_type": ParamDataType.float_, "unit": "",  "is_required": False, "sort_order": 2},
            # ← YOU: confirm other settings you record (defocus, multiplex, write mode)
        ]
    },

    {
        # Spin Coater — photoresist application
        "machine": {
            "name": "Spin Coater",
            "category": StepCategory.lithography,
            "abbreviation": "SPIN",
            "is_active": True,
            "notes": "",
        },
        "params": [
            {"name": "photoresist_type", "display_name": "Photoresist",          "param_type": ParamType.input, "data_type": ParamDataType.string,  "unit": "",    "is_required": True,  "default_value": "AZ1518", "sort_order": 0},
            {"name": "spin_speed_rpm",   "display_name": "Spin Speed (RPM)",     "param_type": ParamType.input, "data_type": ParamDataType.float_,  "unit": "RPM", "is_required": True,  "sort_order": 1},
            {"name": "spin_time_s",      "display_name": "Spin Time (s)",        "param_type": ParamType.input, "data_type": ParamDataType.float_,  "unit": "s",   "is_required": True,  "sort_order": 2},
            {"name": "acceleration",     "display_name": "Acceleration (RPM/s)", "param_type": ParamType.input, "data_type": ParamDataType.float_,  "unit": "RPM/s","is_required": False, "sort_order": 3},
            {"name": "deceleration",     "display_name": "Deceleration (RPM/s)", "param_type": ParamType.input, "data_type": ParamDataType.float_,  "unit": "RPM/s","is_required": False, "sort_order": 4},
        ]
    },

    {
        # Hotplate — prebake, softbake, postbake, hard bake
        "machine": {
            "name": "Hotplate",
            "category": StepCategory.lithography,
            "abbreviation": "HOTPLATE",
            "is_active": True,
            "notes": "Used for prebake, softbake, post-exposure bake, and hard bake.",
        },
        "params": [
            {"name": "bake_type",    "display_name": "Bake Type",         "param_type": ParamType.input, "data_type": ParamDataType.string, "unit": "",   "is_required": True,  "default_value": "softbake", "sort_order": 0},
            {"name": "temp_c",       "display_name": "Temperature (°C)",  "param_type": ParamType.input, "data_type": ParamDataType.float_, "unit": "°C", "is_required": True,  "sort_order": 1},
            {"name": "duration_s",   "display_name": "Duration (s)",      "param_type": ParamType.input, "data_type": ParamDataType.float_, "unit": "s",  "is_required": True,  "sort_order": 2},
        ]
    },

    {
        # Wet Bench — cleaning, developing
        "machine": {
            "name": "Wet Bench",
            "category": StepCategory.lithography,
            "abbreviation": "WETBENCH",
            "is_active": True,
            "notes": "Cleaning, developing, stripping.",
        },
        "params": [
            {"name": "process_type",     "display_name": "Process",                 "param_type": ParamType.input, "data_type": ParamDataType.string, "unit": "",    "is_required": True,  "default_value": "develop", "sort_order": 0},
            {"name": "chemical",         "display_name": "Chemical / Developer",     "param_type": ParamType.input, "data_type": ParamDataType.string, "unit": "",    "is_required": True,  "sort_order": 1},
            {"name": "ratio",            "display_name": "Ratio (e.g. 1:3)",        "param_type": ParamType.input, "data_type": ParamDataType.string, "unit": "",    "is_required": False, "sort_order": 2},
            {"name": "duration_s",       "display_name": "Duration (s)",            "param_type": ParamType.input, "data_type": ParamDataType.float_, "unit": "s",   "is_required": True,  "sort_order": 3},
            {"name": "temp_c",           "display_name": "Temperature (°C)",        "param_type": ParamType.input, "data_type": ParamDataType.float_, "unit": "°C",  "is_required": False, "sort_order": 4},
            {"name": "sonication",       "display_name": "Sonication",              "param_type": ParamType.input, "data_type": ParamDataType.boolean,"unit": "",    "is_required": False, "sort_order": 5},
        ]
    },

    {
        # KLA-Tencor P7 Stylus Profilometer
        # Measurement values → Measurement/MeasurementPoint tables (not params)
        # Position is parsed from file header: X-Coord/10000, Y-Coord/10000 → µm
        "machine": {
            "name": "KLA-Tencor P7 Profilometer",
            "category": StepCategory.characterization,
            "abbreviation": "P7",
            "is_active": True,
            "notes": "Stage coords in Angstroms, wafer-centered. Flat at -X. ~15µm accuracy on 4-inch with pins.",
        },
        "params": [
            {"name": "scan_length_um",  "display_name": "Scan Length (µm)",   "param_type": ParamType.input, "data_type": ParamDataType.float_, "unit": "µm", "is_required": False, "sort_order": 0},
            {"name": "stylus_force_mg", "display_name": "Stylus Force (mg)",  "param_type": ParamType.input, "data_type": ParamDataType.float_, "unit": "mg", "is_required": False, "sort_order": 1},
            {"name": "scan_type",       "display_name": "Scan Type (2D/3D)",  "param_type": ParamType.input, "data_type": ParamDataType.string, "unit": "",   "is_required": False, "sort_order": 2},
            {"name": "recipe_name",     "display_name": "P7 Recipe Name",     "param_type": ParamType.input, "data_type": ParamDataType.string, "unit": "",   "is_required": False, "sort_order": 3},
        ]
    },

    {
        # Bruker-Nano Contour GT-K Optical Profilometer
        "machine": {
            "name": "Bruker Contour GT-K Optical Profilometer",
            "category": StepCategory.characterization,
            "abbreviation": "OPT-PROF",
            "is_active": True,
            "notes": "",
        },
        "params": [
            {"name": "objective",   "display_name": "Objective",   "param_type": ParamType.input, "data_type": ParamDataType.string, "unit": "", "is_required": False, "sort_order": 0},
            {"name": "scan_mode",   "display_name": "Scan Mode",   "param_type": ParamType.input, "data_type": ParamDataType.string, "unit": "", "is_required": False, "sort_order": 1},
            # ← YOU: add VSI/PSI mode, zoom, etc. if you log those
        ]
    },

    {
        # Gaertner Ellipsometer
        "machine": {
            "name": "Gaertner Ellipsometer",
            "category": StepCategory.characterization,
            "abbreviation": "ELLIPS",
            "is_active": True,
            "notes": "",
        },
        "params": [
            {"name": "wavelength_nm",   "display_name": "Wavelength (nm)",           "param_type": ParamType.input,  "data_type": ParamDataType.float_, "unit": "nm", "is_required": False, "sort_order": 0},
            {"name": "angle_deg",       "display_name": "Angle of Incidence (°)",    "param_type": ParamType.input,  "data_type": ParamDataType.float_, "unit": "°",  "is_required": False, "sort_order": 1},
            {"name": "model",           "display_name": "Optical Model Used",        "param_type": ParamType.input,  "data_type": ParamDataType.string, "unit": "",   "is_required": False, "sort_order": 2},
            {"name": "thickness_nm",    "display_name": "Measured Thickness (nm)",   "param_type": ParamType.output, "data_type": ParamDataType.float_, "unit": "nm", "is_required": False, "sort_order": 3},
            # ← YOU: add refractive index n, k if you record those
        ]
    },

    {
        # Bruker-Nano Discover 8 XRD
        "machine": {
            "name": "Bruker Discover 8 XRD",
            "category": StepCategory.characterization,
            "abbreviation": "XRD",
            "is_active": True,
            "notes": "",
        },
        "params": [
            {"name": "scan_type",     "display_name": "Scan Type",       "param_type": ParamType.input, "data_type": ParamDataType.string, "unit": "",  "is_required": False, "sort_order": 0},
            {"name": "2theta_range",  "display_name": "2θ Range (°)",    "param_type": ParamType.input, "data_type": ParamDataType.string, "unit": "°", "is_required": False, "sort_order": 1},
            # ← YOU: add step size, dwell time, or other scan params you record
        ]
    },

    {
        # Bruker-Nano AFM
        "machine": {
            "name": "Bruker-Nano AFM",
            "category": StepCategory.characterization,
            "abbreviation": "AFM",
            "is_active": True,
            "notes": "",
        },
        "params": [
            {"name": "scan_mode",    "display_name": "Scan Mode",      "param_type": ParamType.input, "data_type": ParamDataType.string, "unit": "",   "is_required": False, "sort_order": 0},
            {"name": "scan_size_um", "display_name": "Scan Size (µm)", "param_type": ParamType.input, "data_type": ParamDataType.float_, "unit": "µm", "is_required": False, "sort_order": 1},
            # ← YOU: add tip type, setpoint, scan rate if you log those
        ]
    },

    {
        # Veeco Four Point Probe
        "machine": {
            "name": "Veeco Four Point Probe",
            "category": StepCategory.characterization,
            "abbreviation": "4PP",
            "is_active": True,
            "notes": "",
        },
        "params": [
            {"name": "current_ma",              "display_name": "Current (mA)",             "param_type": ParamType.input,  "data_type": ParamDataType.float_, "unit": "mA",   "is_required": False, "sort_order": 0},
            {"name": "sheet_resistance_ohm_sq", "display_name": "Sheet Resistance (Ω/□)",  "param_type": ParamType.output, "data_type": ParamDataType.float_, "unit": "Ω/□",  "is_required": False, "sort_order": 1},
        ]
    },

    {
        # Keithley 2400 I-V Measurement System
        "machine": {
            "name": "Keithley 2400 I-V System",
            "category": StepCategory.characterization,
            "abbreviation": "IV",
            "is_active": True,
            "notes": "",
        },
        "params": [
            {"name": "voltage_range_v",   "display_name": "Voltage Range (V)",    "param_type": ParamType.input, "data_type": ParamDataType.string, "unit": "V", "is_required": False, "sort_order": 0},
            {"name": "measurement_type",  "display_name": "Measurement Type",     "param_type": ParamType.input, "data_type": ParamDataType.string, "unit": "",  "is_required": False, "sort_order": 1},
            # ← YOU: expand if you do specific test structures with known parameters
        ]
    },


    {
        # Westbond 7476E Wedge-Wedge Wire Bonder
        "machine": {
            "name": "Westbond Wire Bonder",
            "category": StepCategory.packaging,
            "abbreviation": "WIREBOND",
            "is_active": True,
            "notes": "",
        },
        "params": [
            {"name": "wire_material",    "display_name": "Wire Material",       "param_type": ParamType.input, "data_type": ParamDataType.string, "unit": "",   "is_required": False, "sort_order": 0},
            {"name": "wire_diameter_um", "display_name": "Wire Diameter (µm)",  "param_type": ParamType.input, "data_type": ParamDataType.float_, "unit": "µm", "is_required": False, "sort_order": 1},
            {"name": "ultrasonic_power", "display_name": "Ultrasonic Power",    "param_type": ParamType.input, "data_type": ParamDataType.float_, "unit": "",   "is_required": False, "sort_order": 2},
            {"name": "bond_force",       "display_name": "Bond Force",          "param_type": ParamType.input, "data_type": ParamDataType.float_, "unit": "",   "is_required": False, "sort_order": 3},
            # ← YOU: fill in parameters you actually use; wire bonding settings vary by application
        ]
    },


    # =========================================================================
    # MISCELLANEOUS
    # =========================================================================

    {
        # Blue M Programmable Oven — bakes, anneals
        "machine": {
            "name": "Blue M Programmable Oven",
            "category": StepCategory.miscellaneous,
            "abbreviation": "OVEN",
            "is_active": True,
            "notes": "",
        },
        "params": [
            {"name": "temp_c",       "display_name": "Temperature (°C)", "param_type": ParamType.input, "data_type": ParamDataType.float_, "unit": "°C",  "is_required": True,  "sort_order": 0},
            {"name": "duration_min", "display_name": "Duration (min)",   "param_type": ParamType.input, "data_type": ParamDataType.float_, "unit": "min", "is_required": True,  "sort_order": 1},
        ]
    },

    {
        # Rapid Thermal Processor
        "machine": {
            "name": "Rapid Thermal Processor",
            "category": StepCategory.miscellaneous,
            "abbreviation": "RTP",
            "is_active": True,
            "notes": "",
        },
        "params": [
            {"name": "temp_c",          "display_name": "Peak Temperature (°C)", "param_type": ParamType.input, "data_type": ParamDataType.float_, "unit": "°C",  "is_required": True,  "sort_order": 0},
            {"name": "ramp_rate_c_s",   "display_name": "Ramp Rate (°C/s)",      "param_type": ParamType.input, "data_type": ParamDataType.float_, "unit": "°C/s","is_required": False, "sort_order": 1},
            {"name": "hold_time_s",     "display_name": "Hold Time (s)",         "param_type": ParamType.input, "data_type": ParamDataType.float_, "unit": "s",   "is_required": True,  "sort_order": 2},
            {"name": "atmosphere",      "display_name": "Atmosphere",            "param_type": ParamType.input, "data_type": ParamDataType.string, "unit": "",    "is_required": False, "sort_order": 3},
        ]
    },

]

# =============================================================================
# Seed function — idempotent, safe to re-run
# =============================================================================

def seed():
    db = SessionLocal()
    try:
        for entry in MACHINES:
            m_data = entry["machine"]
            existing = db.query(Machine).filter_by(name=m_data["name"]).first()
            if existing:
                print(f"  [skip] {m_data['name']} already exists")
                continue

            machine = Machine(**m_data)
            db.add(machine)
            db.flush()

            for i, p in enumerate(entry.get("params", [])):
                param = MachineParameterDefinition(
                    machine_id=machine.id,
                    name=p["name"],
                    display_name=p["display_name"],
                    param_type=p["param_type"],
                    data_type=p["data_type"],
                    unit=p.get("unit", ""),
                    is_required=p.get("is_required", False),
                    default_value=p.get("default_value"),
                    min_value=p.get("min_value"),
                    max_value=p.get("max_value"),
                    sort_order=p.get("sort_order", i),
                )
                db.add(param)

            db.commit()
            print(f"  [ok] {m_data['name']} ({len(entry.get('params', []))} params)")

    except Exception as e:
        db.rollback()
        raise e
    finally:
        db.close()


if __name__ == "__main__":
    print("Seeding machines...")
    seed()
    print("Done.")
