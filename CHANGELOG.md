# ZCLAP MDM Estimator — Calculator Changelog (Admin)

All calculator versions are synced against Lynn's Excel spreadsheets.
Each entry notes which Excel file(s) the version is based on.

---

## v1.0 — 2026-06-09

**Synced with Lynn's May 2026 spreadsheets:**
- `Fixed Bid MDM SaaS Estimator_MASTER_May2026.xlsx`
- `Fixed Bid MDM MIGRATION_Estimator_May26.xlsx`

### Changes
- `daasHrs`: 40 → 60 hrs per DaaS service
- `custBuild`: 8 → 12 hrs per custom entity
- `searchBeforeCreate`: new term — +40 hrs when create workflows > 0
- `ootbAdjust`: new term — 8 hrs per OOTB entity
- `dqFuncHrs`: new term — totalEntities × 10 × 2
- `buildHrs`: updated to include all 5 new/updated terms
- `designAndReqWks`: removed SaaS=35% branch — now 30% for both Implementation and Modernization
- `testWks`: floor raised to min 2 (impl) / 3 (mod); rates changed from 0.15/0.20 → 0.10/0.15
- `x_Fixed_Fee_Uplift`: 1.2 (20% uplift applied to T&M estimate for fixed-price quote)
