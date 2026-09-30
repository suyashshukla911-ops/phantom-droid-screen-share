# Portfolio Integration — later stage only

Do not modify the portfolio yet.

The eventual integration target is the existing SECURITY node in the portfolio's interactive system stack. The rest of the portfolio remains independent.

Recommended deployment pattern:
- Portfolio: existing site/hosting.
- Phantom-Droid: separate HTTPS service.
- SECURITY node opens the Phantom-Droid host console in a modal or new route.
- The QR continues to point to the Phantom-Droid service.
- No secrets are embedded into the portfolio.

Integration should be a small adapter:
`SECURITY click -> open cybersecurity lab -> host console`

Do not move the Python signaling server into the static portfolio repository.
