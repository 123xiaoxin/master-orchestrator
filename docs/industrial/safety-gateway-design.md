# Safety Gateway Design

The Safety Gateway is the boundary between intelligent proposal and operational action.

In this repository, the gateway is a design contract, not a device-control implementation. It exists to prevent agent packs from implying that LLM output can directly control equipment.

## Responsibilities

| Responsibility | Description |
|----------------|-------------|
| Normalize input | Convert proposed actions into structured, typed requests |
| Validate rules | Check process rules, site constraints, and high-risk lists |
| Check permission | Confirm user, role, asset, and action scope |
| Score risk | Assign severity and required approval level |
| Enforce approval | Require human review for high-risk actions |
| Route tools | Only call white-listed tools for the target asset and action |
| Audit | Persist all inputs, decisions, approvals, and outcomes |
| Fail safe | Degrade to rule-based safe mode on uncertainty |

## Request Shape

```json
{
  "actionId": "change-parameter-example",
  "assetId": "line-1-oven-3",
  "actionType": "change_parameter",
  "parameters": {
    "targetTemperature": 180
  },
  "reason": "Reduce quality drift observed in last 30 minutes",
  "evidence": ["work-order-123", "trend-report-456"],
  "requestedBy": "operator-id",
  "riskLevel": "high_risk_action"
}
```

## Decision Result

```json
{
  "allowed": false,
  "decision": "blocked",
  "reason": "change_parameter requires supervisor approval",
  "requiredApprovals": ["supervisor"],
  "auditId": "audit-20260429-001",
  "fallback": "rule_based_safe_mode"
}
```

## Risk Levels

| Risk Level | Meaning | Default Handling |
|------------|---------|------------------|
| observe | Read-only observation | Allow |
| recommend | Advisory proposal | Allow as proposal |
| low_risk_action | Operationally bounded action | Require rule validation |
| high_risk_action | Stop, reset, switch, parameter change | Require approval and second confirmation |
| emergency | Safety event or possible hazard | Escalate to site safety procedure |

## Required Blocks

Block when:

- The action is not in a white-listed tool path
- The target asset is unknown or state is stale
- Required data is missing or drifted
- The requester lacks permission
- The action is high-risk and lacks approval
- The proposed command has ambiguous parameters
- The rollback path is missing for reversible actions

## Fallback Policy

On network, model, tool, data, or gateway failure:

1. Stop processing new proposed actions
2. Preserve local site safety and interlock behavior
3. Switch to rule-based safe mode
4. Alert human operator
5. Write audit record
6. Resume only after explicit recovery check
