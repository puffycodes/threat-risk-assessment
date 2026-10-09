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

[Notes on the diagram: which zones or elements are recommendations, and any that depend on open design questions (§14).]

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

> Sections 7 to 10 describe the design across all components. In each cell, give the current state with a citation, a recommendation marked "(R)", or "TBD (Q-nn)" when it depends on an open question. Don't invent values. Where the TRA lists an item but its treatment plan doesn't cover it, say so in the row and report it as a gap in the TRA.

## 7. Data classification and handling

> One row per data type in TRA §2.2 and the data assets in TRA §4. Take the classification from the asset's confidentiality rating, or from the organization's scheme if the TRA gives one.

| Data | Asset | Classification | Where stored | At rest | In transit | Retention | Owner | Controls |
|---|---|---|---|---|---|---|---|---|
| [Customer records] | [A-01] | [Confidential (C 4)] | [Database server] | [Disk encryption (R)] | [TLS (F-03)] | [TBD (Q-07)] | [Business owner] | [SC-07] |

---

## 8. Identity and access

> One row per group of people or kind of account, including service accounts and API keys.

| Who or what | Authenticates to | Method | Access granted | Provisioning and review | Controls |
|---|---|---|---|---|---|
| [Administrators] | [Jump host] | [Password + hardware key] | [Web server and database server only] | [Named accounts; reviewed every 6 months (R)] | [SC-01, SC-02] |
| [Application service account] | [Database] | [Password] | [Read/write on its own tables] | [TBD (Q-05)] | [SC-07] |

---

## 9. Cryptography and secrets

> List every secret in the TRA's assets, including those with no treatment in the TRA.

| Where encryption is used | Protocol or algorithm | Keys or certificates | Renewal or rotation | Controls |
|---|---|---|---|---|
| [Internet → WAF (F-01)] | [TLS 1.2 and 1.3] | [Public certificate] | [Automatic renewal (R)] | [SC-05] |

| Secret | Asset | Stored in | Who or what can read it | Rotation | Controls |
|---|---|---|---|---|---|
| [Database credential] | [A-04] | [Secrets manager (R)] | [Application only] | [Yearly and on suspected compromise (R)] | [SC-08] |

---

## 10. Logging and monitoring

> One row per log source. Take the retention from a compliance requirement only if the TRA says the framework applies (§2.6).

| Source | Events logged | Destination | Retention | Alerts | Reviewed by | Controls |
|---|---|---|---|---|---|---|
| [Jump host] | [Logins, failures, sessions] | [Central log system (F-05)] | [TBD (Q-09)] | [Login from a new source (R)] | [TBD] | [SC-09] |

---

## 11. Component design

> One subsection per component or area. Each ends with the controls it implements and the TRA risks it treats. Don't repeat what sections 7 to 10 already say; refer to them.

### 11.1 [Component, e.g., Internet boundary]

- [Design point]
- [Design point]

**Controls:** [SC-05, SC-06] **Risks:** [R-02]

### 11.2 [Component, e.g., Administrative access]

- [Design point]
- [Design point]

**Controls:** [SC-01, SC-02] **Risks:** [R-01]

### 11.3 [Component, e.g., Data store]

- [Design point]
- [Design point]

**Controls:** [SC-07] **Risks:** [R-01, R-03]

---

## 12. Design decisions

> Record a decision wherever the TRA leaves a real choice. Decision owners are humans; leave as TBD.

| ID | Decision | Options considered | Recommendation | Rationale | Decision owner |
|---|---|---|---|---|---|
| DD-01 | [How to provide privileged access] | [Jump host; PAM product; VPN only] | [Jump host] | [Lowest cost that meets R-01 treatment] | TBD |

---

## 13. Residual risk if implemented

> Take this from TRA §9 and §10. Do not re-score.

[Overall residual risk from the TRA, whether it is within tolerance, and any conditions it depends on (e.g., DD-01 decided, Q-04 answered).]

| Rating | Before treatment | After treatment |
|---|---|---|
| Critical | [n] | [n] |
| High | [n] | [n] |
| Medium | [n] | [n] |
| Low | [n] | [n] |

---

## 14. Open design questions

> Use the question numbers from the clarifications file.

| Question | Design element affected |
|---|---|
| [Q-04: Is cardholder data stored?] | [§5 zones; §6 F-03; §7; SC-07] |

---

## 15. Assumptions

- [Assumption inherited from TRA §2.7]
- [Assumption added by this design]: (design)
