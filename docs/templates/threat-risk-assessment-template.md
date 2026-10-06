# Threat Risk Assessment: [System / Project Name]

> Template. Replace everything in `[brackets]` and delete guidance notes (lines starting with `>`) before issuing.
> For the method behind each section, see [threat-risk-assessment-process.md](../threat-risk-assessment-process.md).

## Document control

| Field | Value |
|---|---|
| Document ID | [TRA-YYYY-NNN] |
| Version | [0.1] |
| Status | [Draft / In review / Approved] |
| Assessment date | [YYYY-MM-DD] |
| Next review date | [YYYY-MM-DD] |
| Author(s) | [Name, role] |
| Reviewer(s) | [Name, role] |
| Risk owner / approver | [Name, role] |
| Classification | [e.g., Internal / Confidential] |

### Revision history

| Version | Date | Author | Changes |
|---|---|---|---|
| 0.1 | [YYYY-MM-DD] | [Name] | Initial draft |

---

## 1. Executive summary

> Write this last. One page maximum: what was assessed, the overall risk posture, the top risks, and the key decisions needed.

- **Scope:** [one-line description]
- **Overall residual risk:** [Low / Medium / High / Critical]
- **Risks identified:** [n] total: [n] Critical, [n] High, [n] Medium, [n] Low
- **Top risks:**
  1. [R-01: short description, rating]
  2. [R-02: short description, rating]
  3. [R-03: short description, rating]
- **Decisions required:** [e.g., approve funding for X; accept residual risk R-05]

---

## 2. Scope and context

### 2.1 Purpose

[Why this TRA is being done: new system, major change, periodic review, audit finding, incident, etc.]

### 2.2 In scope

- [Systems, applications, infrastructure]
- [Business processes]
- [Locations / facilities]
- [Data types]

### 2.3 Out of scope

- [Item]: [reason]

### 2.4 System description

[Short description of what the system does, who uses it, and how it connects to other systems. Attach or link an architecture / data-flow diagram.]

### 2.5 Stakeholders

| Name | Role | Interest / responsibility |
|---|---|---|
| [Name] | [Business owner] | [Accountable for the service] |
| [Name] | [System owner] | [Technical operation] |
| [Name] | [Security] | [Assessment lead] |

### 2.6 Legal, regulatory and policy requirements

- [e.g., Privacy legislation, PCI DSS, ISO 27001, internal security policy]

### 2.7 Assumptions and constraints

- [Assumption or constraint]

---

## 3. Methodology and risk criteria

### 3.1 Approach

[Framework used (e.g., NIST SP 800-30, ISO 27005, HTRA) and how information was gathered: interviews, document review, scans, workshops.]

### 3.2 Likelihood scale

| Score | Level | Description |
|---|---|---|
| 1 | Rare | May occur only in exceptional circumstances (< once in 10 years) |
| 2 | Unlikely | Could occur but not expected (once in 3–10 years) |
| 3 | Possible | Might occur (once in 1–3 years) |
| 4 | Likely | Will probably occur (about once a year) |
| 5 | Almost certain | Expected to occur (several times a year) |

### 3.3 Impact scale

| Score | Level | Financial | Operational | Data / privacy | Reputational | Safety / legal |
|---|---|---|---|---|---|---|
| 1 | Negligible | [< $X] | [Minor disruption, < 1 hr] | [No sensitive data] | [No external attention] | [None] |
| 2 | Minor | [$X–$Y] | [< 1 day] | [Limited internal data] | [Local complaints] | [Minor breach of policy] |
| 3 | Moderate | [$Y–$Z] | [1–3 days] | [Some personal data] | [Regional media] | [Regulatory notice] |
| 4 | Major | [$Z–$W] | [3–7 days] | [Large volume of personal data] | [National media] | [Fines, injury] |
| 5 | Severe | [> $W] | [> 7 days / service loss] | [Sensitive data at scale] | [Lasting brand damage] | [Prosecution, loss of life] |

> Tailor the thresholds to the organization before scoring anything.

### 3.4 Risk matrix

Risk score = Likelihood × Impact.

| Likelihood ↓ / Impact → | 1 | 2 | 3 | 4 | 5 |
|---|---|---|---|---|---|
| **5** | 5 M | 10 H | 15 H | 20 C | 25 C |
| **4** | 4 L | 8 M | 12 H | 16 C | 20 C |
| **3** | 3 L | 6 M | 9 M | 12 H | 15 H |
| **2** | 2 L | 4 L | 6 M | 8 M | 10 H |
| **1** | 1 L | 2 L | 3 L | 4 L | 5 M |

| Rating | Score | Required action |
|---|---|---|
| **Critical (C)** | 16–25 | Immediate action; executive notification; do not proceed without treatment |
| **High (H)** | 10–15 | Treatment plan required within [30] days; senior management acceptance |
| **Medium (M)** | 5–9 | Treat within [90] days or formally accept by risk owner |
| **Low (L)** | 1–4 | Accept and monitor through normal processes |

### 3.5 Risk tolerance

[State the organization's risk appetite, e.g., "Risks rated High or above must be treated or formally accepted by the [role]."]

---

## 4. Asset inventory and valuation

> Rate each CIA attribute 1–5 using the impact scale in 3.3.

| ID | Asset | Type | Owner | Confidentiality | Integrity | Availability | Overall value |
|---|---|---|---|---|---|---|---|
| A-01 | [Customer database] | [Data] | [Name] | [5] | [4] | [3] | [5] |
| A-02 | [Web application] | [Software] | [Name] | [3] | [4] | [4] | [4] |
| A-03 | [Data centre] | [Facility] | [Name] | [2] | [3] | [5] | [5] |

> Overall value is normally the highest of the three CIA scores.

---

## 5. Threat assessment

| ID | Threat source | Category | Motivation | Capability (1–5) | Assets targeted | Description |
|---|---|---|---|---|---|---|
| T-01 | [Organized cybercriminals] | Deliberate | [Financial] | [4] | [A-01] | [Ransomware / data theft] |
| T-02 | [Malicious insider] | Deliberate | [Financial / grievance] | [3] | [A-01, A-02] | [Abuse of privileged access] |
| T-03 | [Staff error] | Accidental | N/A | N/A | [A-01] | [Misconfiguration, misdirected email] |
| T-04 | [Power outage] | Environmental | N/A | N/A | [A-03] | [Extended utility failure] |

> Categories: Deliberate, Accidental, Environmental/Natural. Consider STRIDE or MITRE ATT&CK for technical threats.

---

## 6. Vulnerability assessment

| ID | Vulnerability | Type | Affected assets | Source / evidence | Severity (1–5) |
|---|---|---|---|---|---|
| V-01 | [No MFA on admin accounts] | Technical | [A-01, A-02] | [Config review YYYY-MM-DD] | [4] |
| V-02 | [Unpatched web server] | Technical | [A-02] | [Scan report ref] | [4] |
| V-03 | [No security awareness training] | Personnel | [All] | [Interview] | [3] |
| V-04 | [No backup generator] | Physical | [A-03] | [Site visit] | [3] |

> Types: Technical, Procedural, Physical, Personnel.

---

## 7. Existing controls

| ID | Control | Type | Addresses | Effectiveness | Notes |
|---|---|---|---|---|---|
| C-01 | [Perimeter firewall] | Preventive | [T-01] | [Effective / Partial / Ineffective] | [ ] |
| C-02 | [Nightly backups] | Corrective | [T-01, T-03] | [Partial] | [Restores not tested] |
| C-03 | [Access logging] | Detective | [T-02] | [Partial] | [Logs not reviewed] |

> Types: Preventive, Detective, Corrective, Deterrent, Compensating.

---

## 8. Risk analysis and register

> One row per threat–vulnerability–asset scenario. Likelihood and impact reflect the existing controls in section 7.

| Risk ID | Risk scenario | Asset(s) | Threat | Vulnerability | Existing controls | L | I | Score | Rating | Risk owner |
|---|---|---|---|---|---|---|---|---|---|---|
| R-01 | [Cybercriminals compromise admin account and exfiltrate customer data] | A-01 | T-01 | V-01 | C-01, C-03 | [4] | [5] | [20] | [Critical] | [Name] |
| R-02 | [Attacker exploits unpatched web server to deploy ransomware] | A-02 | T-01 | V-02 | C-01, C-02 | [3] | [4] | [12] | [High] | [Name] |
| R-03 | [Staff misconfiguration exposes data publicly] | A-01 | T-03 | V-03 | C-03 | [3] | [4] | [12] | [High] | [Name] |
| R-04 | [Extended power loss takes service offline] | A-03 | T-04 | V-04 | None | [2] | [4] | [8] | [Medium] | [Name] |

---

## 9. Risk treatment plan

| Risk ID | Current rating | Treatment | Recommended action(s) | Owner | Target date | Cost / effort | Residual L | Residual I | Residual score | Residual rating |
|---|---|---|---|---|---|---|---|---|---|---|
| R-01 | Critical | Mitigate | [Enforce MFA on all admin accounts; PAM solution] | [Name] | [YYYY-MM-DD] | [Low] | [2] | [5] | [10] | [High] |
| R-02 | High | Mitigate | [Patch management process; WAF] | [Name] | [YYYY-MM-DD] | [Medium] | [2] | [4] | [8] | [Medium] |
| R-03 | High | Mitigate | [Awareness training; config baselines and review] | [Name] | [YYYY-MM-DD] | [Low] | [2] | [4] | [8] | [Medium] |
| R-04 | Medium | Transfer / Accept | [Business interruption insurance] | [Name] | [YYYY-MM-DD] | [Low] | [2] | [4] | [8] | [Medium] |

> Treatment options: **Mitigate**, **Transfer**, **Avoid**, **Accept**.

---

## 10. Residual risk summary

| Rating | Before treatment | After treatment |
|---|---|---|
| Critical | [n] | [n] |
| High | [n] | [n] |
| Medium | [n] | [n] |
| Low | [n] | [n] |

[Statement of overall residual risk and whether it is within tolerance.]

---

## 11. Risk acceptance and sign-off

> Every risk that remains above tolerance after treatment needs a named acceptor with the authority to accept it.

| Risk ID | Residual rating | Rationale for acceptance | Accepted by | Signature | Date |
|---|---|---|---|---|---|
| [R-01] | [High] | [Compensating controls in place until PAM rollout in Q2] | [Name, role] | | [YYYY-MM-DD] |

### Approval

| Role | Name | Signature | Date |
|---|---|---|---|
| Assessor | | | |
| System owner | | | |
| Risk owner / approver | | | |

---

## 12. Monitoring and review

- **Review frequency:** [e.g., annually]
- **Triggers for reassessment:** major system change, new significant threat, security incident, regulatory change, or audit finding.
- **Treatment tracking:** [where the treatment plan is tracked, e.g., risk register tool / ticketing system]

---

## Appendices

- **A.** Architecture / data-flow diagrams
- **B.** Interview list and evidence references
- **C.** Vulnerability scan / pen test reports
- **D.** Glossary
