package com.suyashshukla.phantomdroid;

import android.app.Notification;
import android.app.NotificationChannel;
import android.app.NotificationManager;
import android.app.PendingIntent;
import android.app.Service;
import android.content.Intent;
import android.media.projection.MediaProjection;
import android.os.IBinder;
import android.os.Build;
import android.content.pm.ServiceInfo;

import androidx.annotation.Nullable;
import androidx.core.app.NotificationCompat;

import org.json.JSONObject;
import org.webrtc.AudioSource;
import org.webrtc.DefaultVideoDecoderFactory;
import org.webrtc.DefaultVideoEncoderFactory;
import org.webrtc.EglBase;
import org.webrtc.MediaConstraints;
import org.webrtc.PeerConnection;
import org.webrtc.PeerConnectionFactory;
import org.webrtc.SdpObserver;
import org.webrtc.ScreenCapturerAndroid;
import org.webrtc.SessionDescription;
import org.webrtc.SurfaceTextureHelper;
import org.webrtc.VideoCapturer;
import org.webrtc.VideoSource;
import org.webrtc.VideoTrack;

import java.util.ArrayList;
import java.util.Arrays;
import java.util.Collections;
import java.util.List;

public class ScreenShareService extends Service implements SignalClient.Listener {
    public static final String EXTRA_SERVER_URL = "server_url";
    public static final String EXTRA_SESSION_ID = "session_id";
    public static final String EXTRA_GUEST_TOKEN = "guest_token";
    public static final String EXTRA_RESULT_CODE = "result_code";
    public static final String EXTRA_RESULT_DATA = "result_data";

    private static final String CHANNEL_ID = "phantom_droid_screen_share";
    private static final int NOTIFICATION_ID = 9101;
    public static final String ACTION_STOP = "com.suyashshukla.phantomdroid.STOP";

    private SignalClient signaling;
    private PeerConnectionFactory factory;
    private PeerConnection peerConnection;
    private EglBase eglBase;
    private SurfaceTextureHelper surfaceHelper;
    private ScreenCapturerAndroid capturer;
    private VideoSource videoSource;
    private VideoTrack videoTrack;

    private boolean peerReady = false;
    private boolean shuttingDown = false;
    private final List<org.webrtc.IceCandidate> pendingIceCandidates = new ArrayList<>();

    @Override
    public void onCreate() {
        super.onCreate();
        createChannel();
        PeerConnectionFactory.initialize(
                PeerConnectionFactory.InitializationOptions.builder(getApplicationContext())
                        .createInitializationOptions());
        eglBase = EglBase.create();

        factory = PeerConnectionFactory.builder()
                .setVideoEncoderFactory(
                        new DefaultVideoEncoderFactory(eglBase.getEglBaseContext(), true, true))
                .setVideoDecoderFactory(
                        new DefaultVideoDecoderFactory(eglBase.getEglBaseContext()))
                .createPeerConnectionFactory();

        showNotification("Screen sharing is active");
    }

    @Override
    public int onStartCommand(Intent intent, int flags, int startId) {
        Notification notification = buildNotification("Connecting to secure viewer…");
        if (Build.VERSION.SDK_INT >= 29) {
            startForeground(NOTIFICATION_ID, notification, ServiceInfo.FOREGROUND_SERVICE_TYPE_MEDIA_PROJECTION);
        } else {
            startForeground(NOTIFICATION_ID, notification);
        }

        if (intent == null) {
            stopWithReason("Screen sharing stopped.");
            return START_NOT_STICKY;
        }

        if (ACTION_STOP.equals(intent.getAction())) {
            stopWithReason("Stopped by the device owner.");
            return START_NOT_STICKY;
        }

        String serverUrl = intent.getStringExtra(EXTRA_SERVER_URL);
        String sessionId = intent.getStringExtra(EXTRA_SESSION_ID);
        String guestToken = intent.getStringExtra(EXTRA_GUEST_TOKEN);
        Intent resultData = intent.getParcelableExtra(EXTRA_RESULT_DATA);

        if (serverUrl == null || sessionId == null || guestToken == null || resultData == null) {
            stopSelf();
            return START_NOT_STICKY;
        }

        setupSignaling(serverUrl, sessionId, guestToken, resultData);
        return START_NOT_STICKY;
    }

    private void setupSignaling(
            String serverUrl,
            String sessionId,
            String guestToken,
            Intent resultData) {

        signaling = new SignalClient(this);
        signaling.connect(serverUrl, sessionId, guestToken);

        this.captureIntent = resultData;
    }

    private Intent captureIntent;
    private boolean remoteDescriptionNotSet = true;

    private void startPeerAfterPairing() {
        if (!peerReady || captureIntent == null || peerConnection != null) return;
        try {
            setupPeerConnection();
            startScreenCapture();
            createOffer();
            sendConsent("share-permission-granted");
            signaling.sendJson(new JSONObject().put("type", "share-status").put("active", true));
            showNotification("Live screen sharing active — tap to stop");
        } catch (Exception e) {
            sendConsent("share-permission-denied");
            stopWithReason("Failed to start screen sharing.");
        }
    }

    private void setupPeerConnection() {
        List<PeerConnection.IceServer> iceServers = new ArrayList<>();
        iceServers.add(PeerConnection.IceServer.builder("stun:stun.l.google.com:19302").createIceServer());

        PeerConnection.RTCConfiguration rtcConfig = new PeerConnection.RTCConfiguration(iceServers);
        rtcConfig.sdpSemantics = PeerConnection.SdpSemantics.UNIFIED_PLAN;

        peerConnection = factory.createPeerConnection(rtcConfig, new PeerConnection.Observer() {
            @Override public void onSignalingChange(PeerConnection.SignalingState state) {}
            @Override public void onIceConnectionChange(PeerConnection.IceConnectionState state) {}
            @Override public void onIceConnectionReceivingChange(boolean receiving) {}
            @Override public void onIceGatheringChange(PeerConnection.IceGatheringState state) {}
            @Override public void onIceCandidate(PeerConnection.IceCandidate candidate) {
                try {
                    signaling.sendJson(new JSONObject()
                            .put("type", "candidate")
                            .put("candidate", new JSONObject()
                                    .put("candidate", candidate.sdp)
                                    .put("sdpMid", candidate.sdpMid)
                                    .put("sdpMLineIndex", candidate.sdpMLineIndex)));
                } catch (Exception ignored) {}
            }
            @Override public void onIceCandidatesRemoved(PeerConnection.IceCandidate[] candidates) {}
            @Override public void onAddStream(org.webrtc.MediaStream stream) {}
            @Override public void onRemoveStream(org.webrtc.MediaStream stream) {}
            @Override public void onDataChannel(org.webrtc.DataChannel dataChannel) {}
            @Override public void onRenegotiationNeeded() {}
            @Override public void onAddTrack(org.webrtc.RtpReceiver receiver, org.webrtc.MediaStream[] mediaStreams) {}
            @Override public void onConnectionChange(PeerConnection.PeerConnectionState newState) {}
            @Override public void onSelectedCandidatePairChanged(PeerConnection.CandidatePairChangeEvent event) {}
            @Override public void onStandardizedIceConnectionChange(PeerConnection.IceConnectionState state) {}
            @Override public void onTrack(org.webrtc.RtpTransceiver transceiver) {}
        });

        if (peerConnection == null) throw new IllegalStateException("Unable to create WebRTC peer.");
    }

    private void startScreenCapture() {
        videoSource = factory.createVideoSource(true);
        surfaceHelper = SurfaceTextureHelper.create(
                "Phantom-Droid-ScreenCapture",
                eglBase.getEglBaseContext());

        capturer = new ScreenCapturerAndroid(
                captureIntent,
                new MediaProjection.Callback() {
                    @Override
                    public void onStop() {
                        super.onStop();
                        stopWithReason("Android stopped the screen-capture permission.");
                    }
                });

        capturer.initialize(surfaceHelper, getApplicationContext(), videoSource.getCapturerObserver());
        capturer.startCapture(1280, 720, 15);

        videoTrack = factory.createVideoTrack("phantom-screen", videoSource);
        peerConnection.addTrack(videoTrack, Collections.singletonList("phantom-screen-stream"));
    }

    private void createOffer() {
        MediaConstraints constraints = new MediaConstraints();
        peerConnection.createOffer(new SdpObserver() {
            @Override public void onCreateSuccess(SessionDescription sdp) {
                peerConnection.setLocalDescription(new SimpleSdpObserver() {
                    @Override public void onSetSuccess() {
                        try {
                            signaling.sendJson(new JSONObject()
                                    .put("type", "offer")
                                    .put("sdp", new JSONObject()
                                            .put("type", "offer")
                                            .put("sdp", sdp.description)));
                        } catch (Exception ignored) {}
                    }
                }, sdp);
            }
            @Override public void onSetSuccess() {}
            @Override public void onCreateFailure(String error) { stopWithReason("Unable to create WebRTC offer."); }
            @Override public void onSetFailure(String error) {}
        }, constraints);
    }

    private void sendConsent(String stage) {
        try {
            if (signaling != null) {
                signaling.sendJson(new JSONObject()
                        .put("type", "consent-status")
                        .put("stage", stage));
            }
        } catch (Exception ignored) {}
    }

    @Override public void onOpen() {
        // The pre-consent was completed in MainActivity before the OS dialog.
        sendConsent("notice-accepted");
        sendConsent("consent-checklist-completed");
    }

    @Override public void onPeerReady() {
        peerReady = true;
        startPeerAfterPairing();
    }

    @Override public void onAnswer(JSONObject sdp) {
        if (peerConnection == null) return;
        try {
            SessionDescription answer = new SessionDescription(
                    SessionDescription.Type.ANSWER,
                    sdp.getString("sdp"));
            peerConnection.setRemoteDescription(new SimpleSdpObserver() {
                @Override public void onSetSuccess() {
                    remoteDescriptionNotSet = false;
                    for (org.webrtc.IceCandidate candidate : new ArrayList<>(pendingIceCandidates)) {
                        try { peerConnection.addIceCandidate(candidate); } catch (Exception ignored) {}
                    }
                    pendingIceCandidates.clear();
                }
            }, answer);
        } catch (Exception e) {
            stopWithReason("Invalid WebRTC answer.");
        }
    }

    @Override public void onCandidate(JSONObject candidate) {
        try {
            org.webrtc.IceCandidate ice = new org.webrtc.IceCandidate(
                    candidate.optString("sdpMid", null),
                    candidate.getInt("sdpMLineIndex"),
                    candidate.getString("candidate"));
            if (peerConnection == null || remoteDescriptionNotSet) {
                pendingIceCandidates.add(ice);
            } else {
                peerConnection.addIceCandidate(ice);
            }
        } catch (Exception ignored) {}
    }

    @Override public void onPeerLeft() {
        stopWithReason("Viewer left the session.");
    }

    @Override public void onSessionEnded() {
        stopWithReason("Session ended.");
    }

    @Override public void onError(String message) {
        showNotification(message);
    }

    private static class SimpleSdpObserver implements SdpObserver {
        @Override public void onCreateSuccess(SessionDescription sdp) {}
        @Override public void onSetSuccess() {}
        @Override public void onCreateFailure(String error) {}
        @Override public void onSetFailure(String error) {}
    }

    private void createChannel() {
        if (Build.VERSION.SDK_INT >= 26) {
            NotificationChannel channel = new NotificationChannel(
                    CHANNEL_ID, "Phantom-Droid screen sharing",
                    NotificationManager.IMPORTANCE_LOW);
            channel.setDescription("Visible status for active screen capture.");
            getSystemService(NotificationManager.class).createNotificationChannel(channel);
        }
    }

    private Notification buildNotification(String text) {
        Intent stop = new Intent(this, ScreenShareService.class)
                .setAction(ACTION_STOP);
        PendingIntent stopPending = PendingIntent.getService(
                this, 99, stop,
                PendingIntent.FLAG_UPDATE_CURRENT | PendingIntent.FLAG_IMMUTABLE);

        return new NotificationCompat.Builder(this, CHANNEL_ID)
                .setSmallIcon(android.R.drawable.ic_menu_view)
                .setContentTitle("Phantom-Droid")
                .setContentText(text)
                .setOngoing(true)
                .addAction(android.R.drawable.ic_media_pause, "Stop sharing", stopPending)
                .build();
    }

    private void showNotification(String text) {
        getSystemService(NotificationManager.class).notify(NOTIFICATION_ID, buildNotification(text));
    }

    private void stopWithReason(String reason) {
        if (shuttingDown) return;
        shuttingDown = true;
        try {
            signaling.sendJson(new JSONObject().put("type", "share-status").put("active", false));
            signaling.sendJson(new JSONObject().put("type", "stop-share"));
            signaling.sendJson(new JSONObject().put("type", "consent-status").put("stage", "revoked"));
        } catch (Exception ignored) {}
        cleanup();
        showNotification(reason);
        stopForeground(STOP_FOREGROUND_REMOVE);
        stopSelf();
    }

    private void cleanup() {
        try { if (capturer != null) capturer.stopCapture(); } catch (Exception ignored) {}
        try { if (capturer != null) capturer.dispose(); } catch (Exception ignored) {}
        try { if (surfaceHelper != null) surfaceHelper.dispose(); } catch (Exception ignored) {}
        try { if (videoTrack != null) videoTrack.dispose(); } catch (Exception ignored) {}
        try { if (videoSource != null) videoSource.dispose(); } catch (Exception ignored) {}
        try { if (peerConnection != null) peerConnection.close(); } catch (Exception ignored) {}
        if (signaling != null) signaling.close();
        peerConnection = null;
        capturer = null;
        surfaceHelper = null;
        videoTrack = null;
        videoSource = null;
    }

    @Override
    public void onDestroy() {
        if (!shuttingDown) {
            shuttingDown = true;
            cleanup();
        }
        super.onDestroy();
    }

    @Override
    public void onTaskRemoved(Intent rootIntent) {
        stopWithReason("Sharing stopped because the sender app was closed.");
        super.onTaskRemoved(rootIntent);
    }

    @Nullable
    @Override
    public IBinder onBind(Intent intent) { return null; }

}
