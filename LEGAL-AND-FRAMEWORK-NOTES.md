# Legal / Framework Notes

This document is an engineering orientation, not legal advice.

## India — DPDPA 2023 / Rules 2025

The Digital Personal Data Protection Act, 2023 states in section 5 that a notice accompanying a consent request should inform the individual about the personal data and purpose and the rights/complaint routes; section 6(1) describes consent as free, specific, informed, unconditional and unambiguous with clear affirmative action, limited to the data necessary for the specified purpose. Section 6(4) provides a right to withdraw consent with comparable ease.

**Important commencement point (30 September 2026):** the Government's 13 November 2025 commencement notification phases the Act. Sections 3–5, section 6(1)–(8) and (10), and several related provisions are scheduled to commence 18 months after publication. Therefore the project should not state that every DPDPA Act obligation is already legally operative on the current date. This project nevertheless implements the section 5/6-style consent principles as a privacy-by-design target.

The November 2025 DPDP Rules were also notified with phased commencement. Verify the official commencement status at the time of deployment.

## India — IT Act

The application is designed only for authorized access. It does not attempt to bypass Android permissions or access a device without the owner's affirmative authorization. The legal applicability of the Information Technology Act and associated security/privacy rules depends on the exact deployment, data, actors and current commencement status; obtain Indian legal review before making a public compliance claim.

## NIST / FISMA-oriented engineering

NIST SP 800-53B defines low, moderate and high security baselines and a privacy baseline, with tailoring guidance. This project uses those concepts as a control catalog and documents implemented controls vs. residual/organizational controls.

FISMA is a U.S. federal statutory framework; it is not a certification badge for a student web project. A credible portfolio claim is that the implementation is mapped to relevant control families and evidence, not that it is FISMA compliant/authorized.

## FedRAMP 2026

FedRAMP is a U.S. federal cloud authorization program for in-scope agency cloud use. The official FedRAMP site now publishes Consolidated Rules for 2026 and notes the transition to the new rules/FedRAMP 20x.

This project can demonstrate familiarity with:
- access control
- identification/authentication
- audit and accountability
- system and communications protection
- privacy
- incident response
- risk assessment
- configuration and change management
- continuous monitoring
- supply-chain/dependency review

It cannot truthfully claim FedRAMP authorization, a JAB authorization, a 3PAO assessment, or federal agency approval. Those are organizational/formal processes involving applicable CSP/agency/assessor roles and evidence.

## NASA / ISRO

Do not describe a portfolio project as “NASA/ISRO level” or equivalent to an aerospace mission's security authorization without an actual mission-specific assurance process. The defensible presentation is: **high-assurance-inspired engineering design with documented threat modeling, controls, testing and residual risks.**
