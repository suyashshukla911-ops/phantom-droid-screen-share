import json
import os
from fastapi.testclient import TestClient

os.environ["APP_ENV"] = "test"
os.environ["SESSION_TTL_SECONDS"] = "60"

from backend.app import app, sessions  # noqa: E402


def test_qr_session_and_directional_signaling():
    sessions.clear()

    with TestClient(app) as client:
        response = client.post("/api/sessions")
        assert response.status_code == 200
        data = response.json()

        sid = data["session"]
        host_secret = data["host_secret"]
        join_url = data["join_url"]
        assert sid
        assert host_secret
        assert "#token=" in join_url

        with client.websocket_connect("/signal") as host:
            assert host.receive_json()["type"] == "server-ready"
            host.send_json({
                "type": "join",
                "role": "host",
                "session": sid,
                "credential": host_secret,
            })
            assert host.receive_json()["type"] == "authenticated"

            guest_token = join_url.split("#token=", 1)[1]
            with client.websocket_connect("/signal") as guest:
                assert guest.receive_json()["type"] == "server-ready"
                guest.send_json({
                    "type": "join",
                    "role": "guest",
                    "session": sid,
                    "credential": guest_token,
                })
                assert guest.receive_json()["type"] == "authenticated"

                assert host.receive_json()["type"] == "peer-ready"
                assert guest.receive_json()["type"] == "peer-ready"

                guest.send_json({
                    "type": "consent-status",
                    "stage": "consent-checklist-completed",
                })
                assert host.receive_json() == {
                    "type": "consent-status",
                    "stage": "consent-checklist-completed",
                }

                guest.send_json({
                    "type": "offer",
                    "sdp": {"type": "offer", "sdp": "v=0\r\n"},
                })
                offer = host.receive_json()
                assert offer["type"] == "offer"

                # A guest attempting to send an answer must be rejected.
                guest.send_json({
                    "type": "answer",
                    "sdp": {"type": "answer", "sdp": "v=0\r\n"},
                })
                error = guest.receive_json()
                assert error["type"] == "error"
