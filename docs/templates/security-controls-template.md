# Security Controls: [System / Project Name]

> Template. Replace everything in `[brackets]` and delete guidance notes (lines starting with `>`) before issuing.
> This control list is derived from a completed TRA ([threat-risk-assessment-template.md](threat-risk-assessment-template.md)). Its companion is the security design ([security-design-template.md](security-design-template.md)).

## Document control

| Field | Value |
|---|---|
| Document ID | [CTL-YYYY-NNN] |
| Version | [0.1] |
| Status | [Draft / In review / Approved] |
| Date | [YYYY-MM-DD] |
| Based on | [TRA-YYYY-NNN v0.x; clarifications v0.x] |
| Companion document | [Security Design: SD-YYYY-NNN v0.x] |
| Author(s) | [Name, role] |
| Reviewer / approver | [Name, role] |
| Classification | [e.g., Internal / Confidential] |

### Revision history

| Version | Date | Author | Changes |
|---|---|---|---|
| 0.1 | [YYYY-MM-DD] | [Name] | Initial draft |

---

## 1. How to read this list

- **Status**
  - **New:** nothing comparable exists today.
  - **Strengthen:** builds on an existing TRA control (C-).
  - **Replace:** supersedes an assumed or ineffective existing control.
  - **Retired:** no longer needed; the reason is given. IDs are never reused.
- **Priority** comes from the highest *current* TRA rating among the risks a control treats: **P1** Critical, **P2** High, **P3** Medium, **P4** Low.
- **Target date** is the earliest TRA §9 date among the actions a control implements: the action's own date where the TRA gives one, otherwise its risk's target date. A recurring action also gives its interval.
- **Type:** Preventive, Detective, Corrective, Deterrent or Compensating.
- **Compliance reference:** [Framework and version, e.g., PCI DSS v4.0.1], cited only because TRA §2.6 says it applies. [Note any applicability that depends on an open question.]
- **Differences between [framework] and the TRA** are stated in the control text, starting "DIFFERENCE:", with both figures. The TRA is not changed. They are: [SC-nn, SC-nn, or "None"].
- **Conditional controls:** [SC-nn] may already be met if [an open question (Q-nn)] confirms it. The control then becomes evidence collection. [Or "None".]

---

## 2. Summary

| Priority | Count |
|---|---|
| P1 | [n] |
| P2 | [n] |
| P3 | [n] |
| P4 | [n] |
| **Total** | [n] |

| Status | Count |
|---|---|
| New | [n] |
| Strengthen | [n] |
| Replace | [n] |
| Retired | [n] |

**Immediate interim actions:**

- [Action to take before the full control is in place, e.g., disable remote admin from the internet until SC-01 is live]

---

## 3. Control list

> Group controls by domain. Use only the domains the TRA's actions need. Typical domains: sensitive-data scope, vulnerability and patch management, application security, network and perimeter, identity and access, hardening and configuration, logging/monitoring/response, backup/recovery/resilience.
> Rename the compliance column to the framework's name (e.g., "PCI DSS"). If a requirement is stricter than the TRA, state both figures in the control after "DIFFERENCE:", and list the control in section 1.

### 3.1 [Domain, e.g., Identity and access]

| ID | Control | Type | Status | Existing control | Risks treated | Priority | Target date | [Compliance reference] | Verification | Owner |
|---|---|---|---|---|---|---|---|---|---|---|
| SC-01 | [Enforce MFA on all administrative accounts] | Preventive | New | — | R-01 | P1 | [YYYY-MM-DD] | [8.4.1] | [Login attempt without second factor is refused; config export] | TBD |
| SC-02 | [Administrative access only through a hardened jump host] | Preventive | New | — | R-01 | P1 | [YYYY-MM-DD] | [ ] | [Direct SSH from user network fails; firewall rule review] | TBD |

### 3.2 [Domain, e.g., Vulnerability and patch management]

| ID | Control | Type | Status | Existing control | Risks treated | Priority | Target date | [Compliance reference] | Verification | Owner |
|---|---|---|---|---|---|---|---|---|---|---|
| SC-03 | [Patch critical vulnerabilities within 14 days] | Preventive | New | — | R-02 | P2 | [YYYY-MM-DD] | [6.3.3] | [Monthly scan shows no critical findings older than 14 days] | TBD |

### 3.3 [Domain, e.g., Backup, recovery and resilience]

| ID | Control | Type | Status | Existing control | Risks treated | Priority | Target date | [Compliance reference] | Verification | Owner |
|---|---|---|---|---|---|---|---|---|---|---|
| SC-04 | [Quarterly tested restore of backups] | Corrective | Strengthen | C-02 | R-02 | P2 | [YYYY-MM-DD] | [ ] | [Restore test record with time to recover] | TBD |

---

## 4. Risk coverage

> Every TRA §8 risk, with ratings copied from the TRA. Must match the "Risks treated" column in section 3, in both directions.

| Risk | Current rating | Residual rating (TRA §9) | Controls |
|---|---|---|---|
| R-01 | [Critical] | [High] | [SC-01, SC-02] |
| R-02 | [High] | [Medium] | [SC-03, SC-04] |

---

## 5. Existing controls (TRA §7) and what happens to them

> Every existing TRA control (C-) appears here.

| Existing control | Effectiveness today | Outcome |
|---|---|---|
| [C-01 Perimeter firewall] | [Effective] | [Kept as is] |
| [C-02 Nightly backups] | [Partial] | [Strengthened by SC-04] |
| [C-03 Access logging] | [Partial] | [Replaced by SC-0n] |

---

## 6. Dependencies

| Control | Depends on | Why |
|---|---|---|
| [SC-02] | [SC-01] | [Jump host login requires MFA to be in place] |
