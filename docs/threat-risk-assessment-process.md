# Threat Risk Assessment Process

A threat risk assessment (TRA) usually follows these steps. Frameworks such as NIST SP 800-30, ISO 27005, OCTAVE and the Canadian Harmonized TRA (HTRA) use different names for them, but the sequence is much the same.

## 1. Define scope and context

- Set the system, process or facility being assessed, and where its boundaries are.
- Identify stakeholders, business objectives, and legal or regulatory requirements.
- Set the risk criteria: what likelihood and impact scales you'll use, and how much risk is acceptable.

## 2. Identify and value assets

- List the assets in scope: data, systems, people, facilities, services and reputation.
- Rate how much each one matters for **confidentiality, integrity and availability**. One way is the business impact if it were compromised.

## 3. Identify threats

- Work out who or what could cause harm:
  - **Deliberate:** criminals, insiders, nation-states, hacktivists
  - **Accidental:** human error
  - **Natural or environmental:** fire, flood, power loss
- Describe each threat's capability, motivation and likely attack paths. Threat intelligence and methods like STRIDE or MITRE ATT&CK help here.

## 4. Identify vulnerabilities

- Find weaknesses a threat could exploit, whether technical, procedural, physical or personnel.
- Sources include vulnerability scans, pen tests, architecture reviews, audits and interviews.

## 5. Evaluate existing controls

- List the safeguards already in place and how well they work.
- This tells you the *current* risk rather than the theoretical one.

## 6. Determine likelihood

- Estimate how likely each threat is to exploit each vulnerability, given the existing controls.

## 7. Determine impact

- Estimate the consequences if it happens: financial, operational, safety, legal or reputational.

## 8. Calculate and rate risk

- **Risk = Likelihood × Impact**, usually plotted on a risk matrix (e.g., 5×5).
- Rank the risks (Low / Medium / High / Critical) and compare them against your risk tolerance.

## 9. Recommend risk treatment

For each risk above tolerance, choose one of these:

- **Mitigate:** add or strengthen controls
- **Transfer:** for example, insurance or outsourcing
- **Avoid:** stop the risky activity
- **Accept:** a documented decision by someone with the authority to make it

Then estimate the **residual risk** left after treatment.

## 10. Document and report

- Write the TRA report, covering scope, method, findings, the risk register, recommendations and residual risk.
- Get formal risk acceptance or sign-off from management.

## 11. Implement, monitor and review

- Track remediation through a risk treatment plan.
- Reassess regularly, and whenever something major changes, such as a new system, a new threat or an incident. A TRA describes risk at one point in time and needs updating.

---

**Short version:** Scope → Assets → Threats → Vulnerabilities → Controls → Likelihood → Impact → Risk rating → Treatment → Report → Monitor.
