# First Run Protocol

Use this protocol to run the first revenue experiment with one single-agent test
machine and one engineering machine.

## Input

The operator provides:

- Target buyer segment
- Current example workflow or pain point
- Delivery time limit
- Allowed source materials
- Price hypothesis

## Test Cluster Task

The test cluster drafts only.

Required output:

1. Buyer profile
2. Pain point list
3. Offer variants
4. Sample deliverable outline
5. Delivery checklist
6. Claims that need verification

Forbidden actions:

- Do not contact buyers.
- Do not send messages.
- Do not claim customer results.
- Do not invent verified ROI.
- Do not ask for secrets, API keys, or account credentials.

## Engineering Cluster Task

The engineering cluster reviews and packages.

Required output:

1. Remove unsupported claims.
2. Convert the draft into a fixed-scope offer.
3. Create the final delivery checklist.
4. Add risk disclaimers.
5. Create or update an agent-pack template when useful.
6. Record run results.

## Acceptance Criteria

A run is successful when it produces:

- One clear buyer segment
- One concrete paid offer
- One sample deliverable
- One human-reviewed outreach draft
- One scorecard result

It is not successful if it only produces broad strategy text.

## Run Log Fields

- Date
- Operator
- Buyer segment
- Offer selected
- Price hypothesis
- Draft quality score
- Verification issues
- Final deliverables
- Next action

