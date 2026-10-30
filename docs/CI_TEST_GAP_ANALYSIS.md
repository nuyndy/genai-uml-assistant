# Frontend CI test gap analysis

Date: 2026-10-30  
Branch: `ba-centric`

## Verified status

- TypeScript + Vite production build: passed on commit `1d710e12736ab64a8e85c0512e860e0ef08230b2`.
- Vitest: 81 passed, 29 failed, across 7 of 16 test files (110 tests total).
- Backend CI: 191 passed, 2 warnings on commit `16eb5e05aa38ef9310e13fe3dc2b55a796027ab2`.
- Frontend CI run: https://github.com/nuyndy/genai-uml-assistant/actions/runs/41027848224
- Backend CI run: https://github.com/nuyndy/genai-uml-assistant/actions/runs/41028380147

## Failing test groups

| Test file | Main mismatch observed | Next action |
|---|---|---|
| `SrsWordEditor.test.tsx` | Tests expect an older SRS section layout and older accessible labels; current editor renders a different SRS outline and inline editable fields. | Re-specify tests from the agreed SRS structure, then test field edits and serialization. |
| `giaiDoan.test.tsx` | Assertions expect old step names, old controls, and old diagram actions. | Replace old UI snapshots/assertions with BA-first phase acceptance tests. |
| `giaiDoan2Navigation.test.tsx` | Tests expect previous step navigation labels and old lock/unlock behavior. | Re-test the approved Actor/Use Case → scenario → UML confirmation gates. |
| `reproWhiteScreen.test.tsx` | Tests assume previous data-loading shape and labels. | Keep regression coverage for nonblank rendering and saved data hydration, but update fixtures to current API/component contracts. |
| `requirementCoverageWorkflow.test.tsx` | Test expects coverage selection in the previous UI location. | Verify coverage suggestions remain opt-in and only BA-selected suggestions are persisted. |
| `specificationWorkflow.test.tsx` | Tests expect automatic generation on entering FR/NFR step and version semantics from the older flow. | Reassert BA-first behavior: explicit AI action, manual edits, and no silent replacement of approved content. |
| `workspaceNavigation.test.tsx` | Tests rely on earlier stage names and navigation assumptions. | Re-test stage switching, loading/error states, and navigation guards against current phase rules. |

## Rules for repairing tests

1. Do not weaken TypeScript strictness or remove test assertions simply to obtain a green CI.
2. Preserve regression coverage for data persistence, autosave, error recovery, navigation guards, and confirmation gates.
3. Update a test only when its expected behavior is demonstrably obsolete under the approved BA-first workflow.
4. If a test exposes a missing product behavior, fix the product instead of changing the expectation.
5. Add tests for the key invariants: AI is opt-in, BA owns FR/NFR content, downstream artifacts become stale after upstream edits, and draft baselines cannot be exported as official SRS.

## Scope note

This is a test-contract gap, not evidence that all 29 failures are harmless. Each failing assertion must be classified against the current product requirement before it is changed.
