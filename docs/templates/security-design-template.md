# Security Design: [System / Project Name]

> Template. Replace everything in `[brackets]` and delete guidance notes (lines starting with `>`) before issuing.
> This design is derived from a completed TRA ([threat-risk-assessment-template.md](threat-risk-assessment-template.md)). Its companion is the control list ([security-controls-template.md](security-controls-template.md)).

## Document control

| Field | Value |
|---|---|
| Document ID | [SD-YYYY-NNN] |
| Version | [0.1] |
| Status | [Draft / In review / Approved] |
| Date | [YYYY-MM-DD] |
| Based on | [TRA-YYYY-NNN v0.x; clarifications v0.x] |
| Companion document | [Security Controls: CTL-YYYY-NNN v0.x] |
| Author(s) | [Name, role] |
| Reviewer / approver | [Name, role] |
| Classification | [e.g., Internal / Confidential] |

### Revision history

| Version | Date | Author | Changes |
|---|---|---|---|
| 0.1 | [YYYY-MM-DD] | [Name] | Initial draft |

---

## 1. Purpose and basis

[What this design is for. State that it is a **target** design derived from the TRA's treatment plan, not a description of the system as built. Name the TRA and clarifications versions it is based on, and the scope it covers (TRA §2.2).]

---

## 2. Design principles

> Derive each principle from the main drivers in the TRA: the highest-rated risks, the legal and regulatory requirements (§2.6), and recurring vulnerabilities.

| ID | Principle | Why (TRA reference) |
|---|---|---|
| DP-01 | [Minimize the sensitive-data footprint] | [R-01, R-03; §2.6 privacy legislation] |
| DP-02 | [Defence in depth at the internet boundary] | [R-02] |
| DP-03 | [Least privilege for all administrative access] | [R-01; V-01] |

---

## 3. Current state (as evidenced)

> Evidence only: TRA facts and clarification answers, each with a citation. Anything not evidenced is not described here.

| Element | Current state | Evidence |
|---|---|---|
| [Web server] | [Internet-facing, version X] | [TRA §2.4; Q-03 answer] |
| [Admin access] | [Password only, no MFA] | [TRA V-01] |
| [Backups] | [Nightly, restores not tested] | [TRA C-02] |

```
[ASCII diagram of the current state]

  Internet ──► [Firewall C-01] ──► [Web server] ──► [Database]
```

---

## 4. Target architecture

> Label every element with the controls (SC-) it implements. Mark zones and elements that are recommendations rather than existing.

```
[ASCII diagram of the target architecture]

  Internet ──► [WAF SC-05] ──► [DMZ: web server SC-03, SC-04] ──► [Internal: database SC-07]
                                         ▲
                       [Admin jump host SC-01, SC-02] (recommended)
```

[Notes on the diagram: which zones or elements are recommendations, and any that depend on open design questions (§10).]

---

## 5. Security zones and trust boundaries

| Zone | Contents | Trust level | Boundary controls |
|---|---|---|---|
| [Internet] | [Public users] | Untrusted | [SC-05] |
| [DMZ] | [Web server] | Low | [SC-05, SC-06] |
| [Internal] | [Database] | High | [SC-06, SC-07] |
| [Management] (recommended) | [Jump host, admin tools] | High | [SC-01, SC-02] |

---

## 6. Data flows

> List every allowed flow. All other flows are denied.

| ID | From → To | Protocol / port | Data | Controls | Notes |
|---|---|---|---|---|---|
| F-01 | [Internet → WAF] | [HTTPS / 443] | [Customer requests] | [SC-05] | [ ] |
| F-02 | [WAF → Web server] | [HTTPS / 443] | [Filtered requests] | [SC-05, SC-06] | [ ] |
| F-03 | [Web server → Database] | [TLS / 5432] | [Customer records] | [SC-07] | [ ] |
| F-04 | [Jump host → Web server] | [SSH / 22] | [Administration] | [SC-01, SC-02] | [Recommended] |

**All flows not listed above are denied.**

---

## 7. Component design

> One subsection per component or area. Each ends with the controls it implements and the TRA risks it treats.

### 7.1 [Component, e.g., Internet boundary]

- [Design point]
- [Design point]

**Controls:** [SC-05, SC-06] **Risks:** [R-02]

### 7.2 [Component, e.g., Administrative access]

- [Design point]
- [Design point]

**Controls:** [SC-01, SC-02] **Risks:** [R-01]

### 7.3 [Component, e.g., Data store]

- [Design point]
- [Design point]

**Controls:** [SC-07] **Risks:** [R-01, R-03]

---

## 8. Design decisions

> Record a decision wherever the TRA leaves a real choice. Decision owners are humans; leave as TBD.

| ID | Decision | Options considered | Recommendation | Rationale | Decision owner |
|---|---|---|---|---|---|
| DD-01 | [How to provide privileged access] | [Jump host; PAM product; VPN only] | [Jump host] | [Lowest cost that meets R-01 treatment] | TBD |

---

## 9. Residual risk if implemented

> Take this from TRA §9 and §10. Do not re-score.

[Overall residual risk from the TRA, whether it is within tolerance, and any conditions it depends on (e.g., DD-01 decided, Q-04 answered).]

| Rating | Before treatment | After treatment |
|---|---|---|
| Critical | [n] | [n] |
| High | [n] | [n] |
| Medium | [n] | [n] |
| Low | [n] | [n] |

---

## 10. Open design questions

> Use the question numbers from the clarifications file.

| Question | Design element affected |
|---|---|
| [Q-04: Is cardholder data stored?] | [§5 zones; §6 F-03; SC-07] |

---

## 11. Assumptions

- [Assumption inherited from TRA §2.7]
- [Assumption added by this design]: (design)
