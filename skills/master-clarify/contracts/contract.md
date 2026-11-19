# Independent clarification contract v1

Only `clarify_input.v1` and `clarify_state.v1` are accepted. JSON Schema and
semantic validation both run; no old Master execution contract is generated.
Python 3.10+ and jsonschema >=4.18,<5 are the only tool dependencies.

Input is a host-supplied envelope: projectId, taskId, request (text, mode,
sourceRefs), sources, previousStateId, control (pauseReason, sourceRefs),
allowExpressiveExamples and evidenceType (`synthetic` or `host_output`). Each
source has id, projectId, taskId, kind (user_message/material/inspection/model/
host_control), content (text or null), locator (string or null), availability
(provided/unavailable). Keep accumulated sources unchanged; corrections get new
source IDs. Sources from other projects/tasks cannot be merged. A `file:` locator
is relative to the input file's directory and must resolve within it. External
unavailable sources remain unavailable. Only the host supplies provenance;
untrusted model-written input is not an authenticated user transcript.
New local references are resolved into immutable text snapshots in result.json.
Prior snapshots remain usable when the original file changes or disappears;
reinspection uses a new source ID, never overwrites historical text.

Candidate state has schemaVersion, projectId, taskId, stateId, revision,
previousStateId, items, gaps, requests, handoffs, changes and proposedNext.
All collection IDs are unique throughout the state. A small complete task can
have just goal, scope and criterion items, with empty optional collections.

An item has id, kind, text, status (active/retired), confirmation
(explicit/accepted/unconfirmed/not_applicable), and provenance (kind,
sourceRefs, optional quote). Provenance kinds are user_stated, user_accepted,
material_fact, inspection_result, model_inference, default_assumption.
Explicit/accepted confirmation requires matching user provenance and accessible
user_message evidence; model inference and defaults remain unconfirmed.
Material and inspection facts are not_applicable. Exact quotes must be a literal
substring of an accessible referenced source. Source existence/typing checks do
not establish semantic truth or the authenticity of a transcript.

Item kinds: goal, scope, requirement, suggestion, non_goal, constraint,
criterion, professional_note, assumption, execution_condition. `criterion`
requires verification {method, evidenceType, assessor}; human review is valid.
`assumption` requires riskIfWrong (low/medium/high) and affects
(current/execution/future). `execution_condition` requires conditionStatus
(unknown/available/unavailable); available requires inspection_result evidence.
Optional dependsOn references existing items and must form an acyclic graph,
including no self-dependency. A live dependent on a retired item requires an
open gap whose itemRefs includes that dependent; an unrelated or resolved gap
does not satisfy this requirement. No item is an executable permission.

Gaps have id, description, kind (missing/conflict/authorization/capability),
affects (current/execution/future), resolution (user/evidence/example), status
(open/resolved), blocks (goal/scope/criterion/boundary/preference), itemRefs and
sourceRefs. Retain conflicts and their sources. High-risk current assumptions
must link to an open current gap. Missing core items must have an open current
gap naming that kind in blocks.

Requests have id, gapRefs, method (user/evidence/example), text and
sideEffects=false; an example also carries sample text. They target open current
gaps, agree with resolution and never invoke external tools or execution.
Every open current gap needs a request unless paused. Future/execution gaps stay
visible without forcing a question. If expressive examples are disallowed,
choose user or evidence resolution instead.

Resolving a user or example gap requires accessible user_message evidence;
resolving an evidence gap requires material or inspection evidence. A generated
sample is a question aid, not the user's selection. When an existing open gap
is closed in a revision, the suitable source must be newly supplied, cited in
the gap, and match its original resolution kind. Old user text or a new model
guess cannot substitute for a new user reply to an example.

Fixed priority: invalid structure/references => invalid, no handoff;
then non-null control.pauseReason => paused; then open current user gaps =>
clarify; then evidence gaps => await_evidence; then permitted example gaps =>
prototype_to_clarify; otherwise goal+scope+criterion => ready_for_planning.
All active criteria have checkable verification fields. ProposedNext disagreement
is a validation failure showing both proposed and computed values. Execution or
future gaps do not block planning, and remain in the user summary.

Revision input `--previous` is the complete prior `result.json`, containing the
validated input, state, computed decision, rendered summary and SHA-256 digest.
It is checked again, including digest and rendering consistency. A digest detects
changes, not authorship. State ID must change, revision increments by one and
previousStateId names the previous state. Previous sources and items cannot
disappear. Old items retain ID and kind; retire instead of deleting. Changes
exactly cover added/modified/retired items, with sourceRefs and type
(requirement_change/understanding_correction/execution_issue). A requirement
change cites new user evidence. An execution_issue cannot alter/retire goals,
scope, requirements, constraints or criteria. Retired items cannot resurrect.
Existing gaps and handoffs retain IDs; resolved gaps retain evidence. A handoff
has id, criterionRefs, status (current/needs_review). Changed or retired criteria
force referencing handoffs to needs_review. References must still exist.
Closing user/example gaps requires new user evidence; closing evidence gaps
requires new material/inspection evidence. Model-only declarations cannot close
them. Changing a handoff's references also requires needs_review, assessed against
both its old and new criterion references.

The CLI emits result.json (including input+state), summary.md and report.json
from the same state. Exit 0: valid engineering artifact; 2: contract/consistency
failure; 3: unreadable/corrupt input, dependency or I/O error. Output directories
must be new; inputs and previous results are never overwritten. All reports say
BEHAVIOR_NOT_VERIFIED and executionAuthorized=false, including host_output:
capturing host text alone is not independent behavioral acceptance.
