# Professional Execution View And HTML Progress Map

This document adds two lightweight concepts to Master Skill v0.1: Professional Execution View and HTML Progress Map. They extend the clarity gate without changing schemas or adding implementation tooling.

## Professional Execution View

Professional Execution View, also called Capability Posture Selection, is not identity switching as a core mechanism.

After Master has obtained clear intent and passed the requirement clarity gate, it should inspect the execution contract, identify the task type, and select the professional execution view that best fits the work.

Examples:

- software development task: product architecture or technical implementation view
- content task: content planning or storyboard planning view
- documentation task: documentation architecture view
- data task: data analysis view
- process task: process design view

The professional execution view is not Agent creation.

If Master can complete the work directly, Master should load the professional view and execute. A temporary Agent should only be considered when the task boundary is clear and independent specialized execution is useful. A long-term Agent should only be considered when the task needs persistent state or reusable capability.

## HTML Progress Map

HTML Progress Map is a user-visible minimum visual execution contract. Its purpose is to help the user quickly understand the task goal, current phase, next action, and measurement standard.

It is not:

- a display of model internal reasoning
- a display of hidden assumption chains
- a display of Agent routing details
- a required output for every task

Recommended visible blocks:

- task goal
- current phase
- next action
- measurement standard

Optional visible block:

- current professional execution view

Do not show:

- model reasoning process
- hidden chain of thought
- internal scoring details
- Agent routing details
- excessive intermediate judgments

## When To Generate It

Simple tasks should not generate an HTML Progress Map by default. They should be executed directly.

Medium or larger tasks may generate one when it improves user control.

Generate one when the user explicitly asks to understand or control the execution path.

Prefer generating one when the task has multiple phases, multiple execution views, or multiple validation metrics.

When the task needs direction confirmation, an HTML Progress Map can serve as a minimum prototype.

## Relationship To Master Skill v0.1

Professional Execution View and HTML Progress Map sit after the requirement clarity gate.

They must be derived from the execution contract, not from the user's raw vague request.

An HTML Progress Map can be one presentation form of a minimum prototype.

This addition does not extend `requirement_clarity.v1` schema.

This addition does not change the principle that Master should not create Agents unless necessary.

This addition does not change the principle that execution layers consume only execution contracts.
