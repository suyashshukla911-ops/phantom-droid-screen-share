import os
from fastapi.testclient import TestClient

os.environ["APP_ENV"] = "test"
os.environ["SESSION_TTL_SECONDS"] = "60"

from backend.app import app, sessions  # noqa: E402


def test_qr_session_and_consent_gated_signaling():
    sessions.clear()
    with TestClient(app) as client:
        response = client.post("/api/sessions")
        assert response.status_code == 200
        data = response.json()
        sid = data["session"]
        host_secret = data["host_secret"]
        join_url = data["join_url"]
        guest_token = join_url.split("#token=", 1)[1]
        assert "#token=" in join_url
        assert "?token=" not in join_url

        with client.websocket_connect("/signal") as host:
            assert host.receive_json()["type"] == "server-ready"
            host.send_json({"type":"join","role":"host","session":sid,"credential":host_secret})
            assert host.receive_json()["type"] == "authenticated"

            with client.websocket_connect("/signal") as guest:
                assert guest.receive_json()["type"] == "server-ready"
                guest.send_json({"type":"join","role":"guest","session":sid,"credential":guest_token})
                assert guest.receive_json()["type"] == "authenticated"
                assert host.receive_json()["type"] == "peer-ready"
                assert guest.receive_json()["type"] == "peer-ready"

                for stage in [
                    "purpose-confirmed",
                    "scope-confirmed",
                    "data-handling-confirmed",
                    "withdrawal-confirmed",
                    "consent-complete",
                ]:
                    guest.send_json({"type":"consent-status","stage":stage})
                    assert host.receive_json() == {"type":"consent-status","stage":stage}

                # An offer before active share is blocked by the server.
                guest.send_json({"type":"offer","sdp":{"type":"offer","sdp":"v=0\r\n"}})
                error = guest.receive_json()
                assert error["type"] == "error"

                guest.send_json({"type":"share-status","active":True})
                assert host.receive_json() == {"type":"share-status","active":True}

                guest.send_json({"type":"offer","sdp":{"type":"offer","sdp":"v=0\r\n"}})
                assert host.receive_json()["type"] == "offer"

                # Guest cannot forge the viewer's answer role.
                guest.send_json({"type":"answer","sdp":{"type":"answer","sdp":"v=0\r\n"}})
                assert guest.receive_json()["type"] == "error"


def test_end_session_is_host_only():
    sessions.clear()
    with TestClient(app) as client:
        data = client.post("/api/sessions").json()
        sid = data["session"]
        host_secret = data["host_secret"]
        token = data["join_url"].split("#token=", 1)[1]
        with client.websocket_connect("/signal") as host:
            host.receive_json()
            host.send_json({"type":"join","role":"host","session":sid,"credential":host_secret})
            assert host.receive_json()["type"] == "authenticated"
            with client.websocket_connect("/signal") as guest:
                guest.receive_json()
                guest.send_json({"type":"join","role":"guest","session":sid,"credential":token})
                guest.receive_json()
                host.receive_json(); guest.receive_json()
                guest.send_json({"type":"end-session"})
                assert guest.receive_json()["type"] == "error"
