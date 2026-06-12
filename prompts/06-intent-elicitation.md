---
name: intent_elicitation
description: "Optional Phase -1a Socratic intent elicitation for vague, abstract, or non-technical requests."
metadata:
  {
    "builtin_skill_version": "5.7-draft",
    "extends": "01-core-master-framework",
    "phase": "Phase -1a"
  }
---

# Intent Elicitation - Optional Phase -1a

This optional module gathers user-supplied evidence before the existing Phase
-1b Clarity Gate. It does not authorize execution, create an execution
contract, create an Agent, or advance directly to Phase 0.

## Load Conditions

Load this module when at least one condition is true:

- The request is short, vague, abstract, or dominated by adjectives.
- The user describes an end state but cannot name concrete users, scenes, or
  success conditions.
- The user explicitly asks for help discovering or expressing what they want.
- The user's intent changes during the conversation.

Skip this module when:

- The request already contains concrete deliverables, constraints, and success
  conditions.
- The user explicitly asks the Master to make reasonable assumptions and move
  on.
- Safety governance requires immediate refusal or escalation.

## Conversation Discipline

- Ask one question per turn.
- Ask for the user's own image, scene, feeling, or concrete example.
- Do not summarize an intent the user has not expressed.
- Do not lead with A/B/C choices or a near-target feature menu.
- Do not ask two questions in one sentence.
- Do not move to a new imagery layer while the current answer remains purely
  abstract.
- Record contradictions and intent shifts instead of silently choosing one.

## Four Evidence Layers

1. **Literal**: the user's own restatement and important original words.
2. **Emotional**: feelings to create and feelings to avoid.
3. **Scene**: one concrete opening moment and the first user action.
4. **Value**: why the outcome matters and what it enables.

Useful single-question shapes:

- "What picture appears when you say that word?"
- "If this were a person entering a room, who would the person be?"
- "Imagine one real user opening it tomorrow; what is the first visible moment?"
- "What would make you immediately say this is wrong?"
- "If it works, what changes for you?"

## Low-Language-Bandwidth Fallback

Use this fallback only after repeated open questions produce no concrete
referent:

1. Present three deliberately distant scenes or references.
2. Ask which reference should be pushed farthest away.
3. Ask for the first element the user would remove or change.

This is a reaction aid, not a default option menu. Mark
`elicitationMetadata.fallbackUsed=true`.

## Stop and Handoff

Stop when one condition is met:

- all four evidence layers are concrete;
- the same intent converges through different user statements;
- the user explicitly signals that the intent has changed or is now clear;
- the clarity estimate reaches at least 0.75;
- the turn budget is exhausted.

Produce one `intent_elicitation.v1` record. Its
`recommendedNextPhase` must be exactly one of:

- `continue_elicitation`
- `phase_minus_1b_clarity_gate`

Use `phase_minus_1b_clarity_gate` only when all four layer statuses are
`concrete` and `executionClarityEstimate >= 0.75`.

Phase -1b remains responsible for clarity judgment, minimum prototype choice,
execution contract generation, and any later Phase 0 transition.

## Evidence Integrity

- `userLiteralRequest`, `userWords`, `userAnswer`, and `userSignal` must be
  verbatim or close paraphrases of user statements.
- Use `partial` or `unknown` instead of filling missing fields with invented
  content.
- Preserve both sides of an intent shift in `intentShifts`.
- Internal interpretation is not user evidence.
