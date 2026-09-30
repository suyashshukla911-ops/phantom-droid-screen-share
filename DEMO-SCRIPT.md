# 90-second CISO demo script

1. "This QR contains a short-lived session credential only; it does not contain identity data."
2. "Pairing is not authorization. The phone must complete a separate notice-and-consent stage."
3. "The app then invokes Android's own MediaProjection consent prompt. The application cannot bypass it."
4. "After OS approval, the sender creates a single video track and sends it over WebRTC."
5. "The viewer is receive-only. There is no mouse, keyboard, shell or file-transfer control plane."
6. "Session state is ephemeral, screen frames are not written to the signaling service, and sessions expire."
7. "The implementation is documented against NIST 800-53-style control families and a FedRAMP-informed engineering baseline, without claiming federal authorization."
8. "The remaining production controls are explicit: TURN, centralized monitoring, SBOM/SCA, external secrets, scalable signaling, incident response and independent assessment."

This script deliberately distinguishes implemented controls from certification or legal conclusions.
