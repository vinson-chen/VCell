# Automation Rules Phase Plan

## Scope

Deliver and maintain:

- Phase 0: maintainable L0 rule schema
- Phase 1 first three capabilities:
  - insert-at (`insert_rows_at`, `insert_columns_at`)
  - clear (`clear_all_body`, `clear_row`, `clear_column`)
  - replace (`replace_text_in_all_body`, `replace_text_in_column`)
- Capability matrix as single source:
  - `docs/automation-rules-capability-matrix.md`

## Governance Checklist (must pass every iteration)

- L0 intent count <= 50 (count by intent, not regex variants)
- New intent includes:
  - schema entry
  - conflict review against existing intents
  - verification sample(s)
- L1 only normalizes command; does not mutate table directly
- L1 uses confidence threshold (>= 0.8) before handing to L0
- Route observability available: L0/L1/L2 hit + fallback reason + duration

## Current Implementation Status

- [x] Action protocol added for insert-at / clear / replace
- [x] Apply layer supports insert-at / clear / replace actions
- [x] Prompt contract updated for new actions
- [x] Schema file introduced and wired before legacy matcher
- [x] L1 confidence gating surfaced in API payload and route decision
- [x] Route telemetry persisted for hit-rate and latency reporting
- [x] Expand schema coverage for synonymous commands (batch update)

## Next Batch (ordered)

1. Add L1 confidence output contract and enforce threshold.
2. Add route telemetry fields:
   - route: L0|L1|L2
   - durationMs
   - reason: miss/fallback category
3. Expand schema intents for insert-at / clear / replace synonyms and punctuation variants.
4. Add automated verification cases for each new intent.

