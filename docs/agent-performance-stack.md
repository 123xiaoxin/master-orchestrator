# Agent Performance Stack: Five-Layer Agent Performance Stack

## Scope

This document defines the Agent Performance Stack for Master Skill and Master
Orchestrator. It explains why the same model can produce very different results
inside different Agent tools.

This is a design foundation, not a new runtime mechanism. It does not add schema,
helpers, prompts, or execution code.

Master is not only a task splitter or Agent dispatcher. Master is the diagnostic
and governance layer for the Agent Performance Stack. It should decide:

- which layer primarily determines task success;
- which layer currently has a gap;
- which layer caused a failure;
- which layer should receive the successful pattern after completion.

In this document, RAG / Memory, RAG / Context, and `ragMemoryLayer` refer to the
same layer: external context, memory, project facts, and retrieved knowledge.

## Five Layers

## 1. Model Layer

The Model Layer is the base model capability.

It includes:

- reasoning ability;
- coding ability;
- multimodal ability;
- long-context capacity;
- tool-use tendency;
- language quality;
- training preference;
- safety behavior;
- structured-output stability.

The model defines part of the upper bound, but it does not explain the whole
Agent result. A stronger model can still fail if the harness is weak, the prompt
is vague, the tools are missing, or the project context is absent.

## 2. Harness Layer

The Harness Layer is the engineering wrapper around the model.

It includes:

- system rules;
- execution protocol;
- state machine;
- verify / repair loop;
- safety boundary;
- context injection;
- file and command controls;
- checkpoint and resume;
- output persistence;
- final reporting.

Harness determines whether the model can act in a controlled, recoverable, and
verifiable way. Without a strong harness, a model may plan well but fail to
execute safely or resume from interruption.

## 3. Prompt Layer

The Prompt Layer is the task cognition and output-shaping layer.

It includes:

- role framing;
- task description;
- input and output format;
- Clarity Gate;
- Execution Contract;
- professional execution views;
- Counter-Agent Review;
- specialist review;
- minimum prototype requirements;
- forbidden behavior;
- runtime validation output mode.

Prompt does not replace tools or memory. Its role is to reduce ambiguity and
turn user intent into an executable cognitive structure.

Prompt-layer failure often appears as unclear goals, unstable output format,
missing specialist perspective, premature execution, or unnecessary
clarification.

## 4. Skill Layer

The Skill Layer is the executable capability layer.

It includes:

- CLI;
- PowerShell;
- Python;
- MCP;
- OpenClaw Skill;
- external capability packs;
- local tools;
- temporary scripts;
- specialist Agents;
- user-authorized tools.

Skill is not a warehouse of random tools. A process should become a Skill only
when it is repeated, stable, bounded, and verifiable.

Temporary work should first consider direct tools, CLI, MCP, local programs, or
short scripts before becoming a permanent Skill.

## 5. RAG / Memory Layer

The RAG / Memory Layer is the external context and continuity layer.

It includes:

- project documents;
- historical decisions;
- user preferences;
- repository facts;
- domain material;
- execution logs;
- previous reports;
- vector stores;
- local knowledge bases;
- long-task state history.

RAG / Memory does not replace reasoning. It supplies facts, constraints,
background, and continuity.

Without this layer, an Agent may repeat decisions, forget project constraints,
ignore repository facts, or invent missing domain context.

## Why Same Model Results Differ

Two Agent systems using the same model can behave very differently. The gap is
not only caused by model quality.

Result quality can differ because:

- one system has better task contracts;
- one system has a stronger execution harness;
- one system has state and resume support;
- one system has verify / repair discipline;
- one system has better tool access;
- one system injects project context more reliably;
- one system uses specialist review before execution;
- one system records and reuses successful patterns.

Therefore, "use a stronger model" is only one possible fix. Some failures require
a better harness. Some require a sharper prompt. Some require a tool. Some
require more project context.

## Mapping To Current Master Mechanisms

| Master Mechanism | Main Layer | Role |
|---|---|---|
| Clarity Gate | Prompt / Harness | Decide whether intent is clear enough for action. |
| Execution Contract | Prompt / Harness | Convert fuzzy user intent into an executable contract. |
| State Machine | Harness | Track long-task phase, status, resume point, and transitions. |
| Verify / Repair Loop | Harness | Bound validation, repair, retry, and failure reporting. |
| Pre-Execution Cognitive Staging | Prompt / Harness | Collect information, analyze context, frame the task, and fuse the contract before execution. |
| Multi-Perspective Specialist Review | Prompt / Skill | Decide which professional views must influence quality. |
| Minimal Capability Runtime | Skill / Harness | Route work to CLI, MCP, Skill, script, Agent, or manual handoff. |
| Capability Gap Decision Tree | Skill / Harness / Prompt | Decide how to handle missing capability. |
| gstack reference | Skill / Harness | Shows the value of process packaged as skills. |
| OpenSpace reference | Skill / Memory / Harness | Shows the value of skill evolution runtime. |
| Skill Deposition | Skill / Memory | Decide when stable workflows should become Skills. |
| Final Engineering Report | Harness / Memory | Preserve result, validation, risk, and deposition guidance. |

## Five-Layer Runtime Snapshot

Before complex execution, Master should form a lightweight Five-Layer Runtime
Snapshot.

Simple tasks can use lightweight implicit checks. A complete five-layer snapshot
is only for complex, high-risk, long-running, or quality-critical tasks.

The snapshot can live inside task analysis, an Execution Contract, or a report.
It does not require a new schema in this phase.

Minimal structure:

```json
{
  "modelLayer": {
    "fit": "sufficient | weak | unknown",
    "notes": []
  },
  "harnessLayer": {
    "fit": "sufficient | weak | unknown",
    "requiredControls": []
  },
  "promptLayer": {
    "fit": "sufficient | weak | unknown",
    "requiredViews": []
  },
  "skillLayer": {
    "fit": "sufficient | weak | unknown",
    "availableTools": [],
    "missingTools": []
  },
  "ragMemoryLayer": {
    "fit": "sufficient | weak | unknown",
    "requiredContext": [],
    "missingContext": []
  }
}
```

Master should check:

- whether the model is suitable;
- whether the harness is sufficient for state, validation, and safety;
- whether the prompt and specialist views are sufficient;
- whether tools and Skills are available;
- whether context and memory are sufficient.

If the missing capability is professional judgment, Master should prefer
Specialist Review, Counter-Agent Review, or Experience Review before installing
tools or generating scripts.

If the missing capability is context, Master should investigate, read, retrieve,
or ask for the missing information before execution.

## Five-Layer Failure Attribution

When a task fails, Master should not only say "the model did not do well."

It should attribute the failure to one or more layers.

### Model Gap

Typical signs:

- weak reasoning;
- weak coding ability;
- unstable JSON output;
- multimodal limitation;
- long-context degradation;
- insufficient domain understanding.

Possible responses:

- switch model;
- downgrade scope;
- add specialist review;
- increase verification;
- split the task.

### Harness Gap

Typical signs:

- no state machine;
- no resume path;
- no verify / repair loop;
- unlimited retries;
- unsafe tool invocation;
- unclear output persistence;
- no final engineering report.

Possible responses:

- add or use state tracking;
- apply Verify / Repair Loop;
- set retry limits;
- require user authorization;
- produce a handoff report.

### Prompt Gap

Typical signs:

- unclear goal;
- missing non-goals;
- unstable output format;
- missing professional view;
- no Counter-Agent Review;
- execution layer consumes raw fuzzy demand;
- complex task treated as simple task.

Possible responses:

- return to Clarity Gate;
- revise the Execution Contract;
- use Pre-Execution Cognitive Staging;
- use Multi-Perspective Specialist Review;
- require structured runtime validation output.

### Skill Gap

Typical signs:

- missing CLI, MCP, local tool, or Skill;
- available tool is unsafe or unknown;
- Skill does not match the contract;
- temporary script cannot be verified;
- high-risk tool needs authorization.

Possible responses:

- use Capability Gap Decision Tree;
- degrade;
- substitute;
- request install or enable authorization;
- generate temporary capability;
- manual handoff.

### RAG / Context Gap

Typical signs:

- missing project facts;
- missing historical decisions;
- missing user preferences;
- missing domain background;
- unknown repository state;
- repeated analysis already done before.

Possible responses:

- investigate before execution;
- read project documents;
- retrieve prior reports;
- ask for critical missing information;
- deposit new facts into documentation or memory.

## Five-Layer Capability Gap

Capability gaps can happen in any layer, not only in Skill Layer.

| Gap Type | Example | Preferred Response |
|---|---|---|
| Model Layer Gap | Current model is weak for complex code review. | Change model, downgrade, or add specialist review. |
| Harness Layer Gap | Long task has no resume state. | Use state machine or pause engineering. |
| Prompt Layer Gap | Output lacks Execution Contract. | Revise prompt pattern or contract. |
| Skill Layer Gap | Required CLI or MCP tool is missing. | Substitute, authorize, generate temporary capability, or hand off. |
| RAG / Memory Gap | Project history is missing. | Investigate, read, retrieve, or ask. |

When capability is missing, Master should first identify the layer of the gap.
It should not immediately install tools, create Agents, or rewrite prompts.

## Five-Layer Deposition

After success, Master should decide where the successful pattern belongs.

| Deposition Target | Use When |
|---|---|
| Model selection note | A task type clearly depends on model capability. |
| Harness rule | A control, state, validation, or safety rule should be reused. |
| Prompt pattern | A stable framing, output format, or review perspective worked well. |
| Skill | A repeated workflow is stable, bounded, and verifiable. |
| RAG / Memory | A project fact, user preference, decision, or domain note should persist. |

Wrong deposition makes the system heavier:

- prompt problems should not become unnecessary Skills;
- Skill problems should not become bloated prompts;
- RAG gaps should not be mistaken for model weakness;
- harness gaps should not become manual procedures;
- model gaps should not be hidden behind more process.

## Relation To Master Skill Foundation

### System Modeling

The Agent Performance Stack models the full operating condition of an Agent:

- model suitability;
- harness control;
- prompt clarity;
- capability availability;
- context sufficiency.

### Information Entropy Reduction

The five-layer view turns vague failure into a concrete gap:

- model gap;
- harness gap;
- prompt gap;
- skill gap;
- RAG / context gap.

This makes the next repair action smaller and more accurate.

### Feedback Control

After failure, Master should repair by layer:

- model gap: change model, reduce scope, or add specialist review;
- harness gap: add state, verification, limits, or authorization;
- prompt gap: revise contract or review pattern;
- skill gap: substitute, authorize, script, or hand off;
- context gap: investigate and retrieve.

After success, Master should deposit the pattern back into the correct layer.

## Relation To gstack And OpenSpace

gstack shows that process packaged as skills is valuable. Its Think, Plan, Build,
Review, Test, Ship, and Reflect flow suggests that high-quality Agent behavior
often comes from structured process, not only stronger prompts.

OpenSpace shows that skill evolution runtime is valuable. Its FIX, DERIVED, and
CAPTURED modes show how systems can repair skills, derive new ones, and capture
stable workflows.

Master should not copy gstack or OpenSpace directly.

Master should:

- identify which layer an external capability belongs to;
- keep external capability packs outside the core mechanism unless justified;
- apply security boundaries before use;
- decide what should be deposited;
- prevent external systems from polluting Master core rules;
- manage five-layer boundaries.

## Engineering Rules

Before complex execution, Master should ask:

- Model Layer: is the model fit for the task?
- Harness Layer: are state, validation, and safety controls sufficient?
- Prompt Layer: are intent, contract, and professional views clear enough?
- Skill Layer: are tools, Skills, or substitute routes available?
- RAG / Memory Layer: is the necessary project context available?

During failure, Master should report:

```json
{
  "failureAttribution": {
    "primaryLayer": "model | harness | prompt | skill | rag_memory",
    "secondaryLayers": [],
    "evidence": [],
    "repairAction": [],
    "depositionTarget": ""
  }
}
```

This is a reporting shape, not a required schema.

After success, Master should ask:

- should this become a model selection note?
- should this become a harness rule?
- should this become a prompt pattern?
- should this become a Skill?
- should this become RAG / memory / documentation?

## Final Principles

1. Agent performance is not decided by the model alone; it is the result of all
   five layers.
2. Master is not a stronger model; it is the control layer of the Agent
   Performance Stack.
3. Prompt cannot replace Skill, Skill cannot replace RAG, and RAG cannot replace
   Harness.
4. When capability is missing, first identify which layer has the gap.
5. Successful patterns must be deposited back into the correct layer.
