# Compliance Boundary and Accuracy Statement

This project is intentionally **aligned with** selected security engineering concepts; it is not itself a certified federal system.

## India

The design follows privacy-by-design concepts such as clear purpose, data minimization, explicit choice, withdrawal, transparency and security safeguards. The final legal obligations depend on the real operator, purpose, users, data, infrastructure, contracts and the commencement status of applicable provisions.

The Government of India notified the Digital Personal Data Protection Rules, 2025 on 13 November 2025 with phased commencement dates. Therefore, an engineering project dated September 2026 should not claim that every DPDP provision is already in force.

The Information Technology Act and its associated rules may also remain relevant depending on the processing context and the effective date of superseding provisions.

## United States federal frameworks

FedRAMP is a federal cloud authorization program. It is not a generic certification badge for a personal website.

The 2026 FedRAMP Consolidated Rules modernize the program. The current FedRAMP material also makes clear that the program involves CSPs, agencies, independent assessors and FedRAMP governance. A portfolio project should not say "FedRAMP Moderate/High compliant" merely because it copies a few controls.

For engineering practice, this project uses NIST SP 800-53/800-53B control families and Moderate/High baseline concepts as a reference architecture. Formal FedRAMP authorization would additionally require a real cloud service boundary, evidence, assessments, organizational governance, supply-chain evidence, continuous monitoring and the current applicable FedRAMP process.

## How to describe this project publicly

Recommended wording:

> "Consent-first, QR-paired remote screen-sharing lab implementing ephemeral authorization, least privilege, privacy-by-design, WebRTC signaling controls and a NIST/FedRAMP-informed control baseline."

Avoid:

> "FedRAMP High certified"
> "FISMA approved"
> "NASA-grade secure"
> "ISRO-grade secure"

unless a formal external authorization actually exists.
