package com.suyashshukla.phantomdroid;

import android.os.Handler;
import android.os.Looper;

import org.json.JSONObject;

import java.util.Iterator;

import okhttp3.OkHttpClient;
import okhttp3.Request;
import okhttp3.WebSocket;
import okhttp3.WebSocketListener;

public final class SignalClient {
    public interface Listener {
        void onOpen();
        void onPeerReady();
        void onAnswer(JSONObject sdp);
        void onCandidate(JSONObject candidate);
        void onPeerLeft();
        void onSessionEnded();
        void onError(String message);
    }

    private final OkHttpClient client = new OkHttpClient();
    private final Handler main = new Handler(Looper.getMainLooper());
    private final Listener listener;
    private WebSocket socket;

    public SignalClient(Listener listener) {
        this.listener = listener;
    }

    public void connect(String serverUrl, String sessionId, String guestToken) {
        String ws = serverUrl.replaceFirst("^https://", "wss://")
                .replaceFirst("^http://", "ws://") + "/signal";
        Request request = new Request.Builder().url(ws).build();

        socket = client.newWebSocket(request, new WebSocketListener() {
            @Override
            public void onOpen(WebSocket webSocket, okhttp3.Response response) {
                sendJson(new JSONObject()
                        .put("type", "join")
                        .put("role", "guest")
                        .put("session", sessionId)
                        .put("credential", guestToken));
                main.post(listener::onOpen);
            }

            @Override
            public void onMessage(WebSocket webSocket, String text) {
                try {
                    JSONObject msg = new JSONObject(text);
                    String type = msg.optString("type", "");

                    switch (type) {
                        case "peer-ready":
                            main.post(listener::onPeerReady);
                            break;
                        case "answer":
                            main.post(() -> listener.onAnswer(msg.getJSONObject("sdp")));
                            break;
                        case "candidate":
                            main.post(() -> listener.onCandidate(msg.getJSONObject("candidate")));
                            break;
                        case "peer-left":
                            main.post(listener::onPeerLeft);
                            break;
                        case "session-ended":
                        case "session-expired":
                            main.post(listener::onSessionEnded);
                            break;
                        case "error":
                            main.post(() -> listener.onError(msg.optString("message", "Signaling error")));
                            break;
                        default:
                            break;
                    }
                } catch (Exception e) {
                    main.post(() -> listener.onError("Invalid signaling response."));
                }
            }

            @Override
            public void onFailure(WebSocket webSocket, Throwable t, okhttp3.Response response) {
                main.post(() -> listener.onError("Signaling connection failed: " + t.getMessage()));
            }
        });
    }

    public void sendJson(JSONObject payload) {
        if (socket != null) socket.send(payload.toString());
    }

    public void close() {
        try {
            if (socket != null) socket.close(1000, "done");
        } catch (Exception ignored) {}
        socket = null;
    }
}
