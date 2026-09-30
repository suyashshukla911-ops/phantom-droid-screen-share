package com.suyashshukla.phantomdroid;

import android.app.Activity;
import android.content.Intent;
import android.media.projection.MediaProjectionConfig;
import android.media.projection.MediaProjectionManager;
import android.net.Uri;
import android.os.Build;
import android.os.Bundle;
import android.Manifest;
import android.widget.Button;
import android.widget.CheckBox;
import android.widget.TextView;

import androidx.appcompat.app.AppCompatActivity;
import androidx.core.app.ActivityCompat;

public class MainActivity extends AppCompatActivity {
    private static final int REQUEST_MEDIA_PROJECTION = 7301;
    private static final int REQUEST_NOTIFICATIONS = 7302;

    private TextView sessionText;
    private TextView statusText;
    private Button authorizeButton;
    private Button stopButton;
    private CheckBox purpose, scope, withdraw, twoDevices;

    private String serverUrl;
    private String sessionId;
    private String guestToken;

    @Override
    protected void onCreate(Bundle savedInstanceState) {
        super.onCreate(savedInstanceState);
        setContentView(R.layout.activity_main);

        if (Build.VERSION.SDK_INT >= 33 && checkSelfPermission(Manifest.permission.POST_NOTIFICATIONS) != android.content.pm.PackageManager.PERMISSION_GRANTED) {
            ActivityCompat.requestPermissions(this, new String[]{Manifest.permission.POST_NOTIFICATIONS}, REQUEST_NOTIFICATIONS);
        }

        sessionText = findViewById(R.id.sessionText);
        statusText = findViewById(R.id.status);
        authorizeButton = findViewById(R.id.authorizeButton);
        stopButton = findViewById(R.id.stopButton);

        purpose = findViewById(R.id.purpose);
        scope = findViewById(R.id.scope);
        withdraw = findViewById(R.id.withdraw);
        twoDevices = findViewById(R.id.twoDevices);

        loadJoinIntent(getIntent());

        CheckBox.OnCheckedChangeListener listener = (buttonView, isChecked) ->
                authorizeButton.setEnabled(allRequiredChecks() && hasSession());

        purpose.setOnCheckedChangeListener(listener);
        scope.setOnCheckedChangeListener(listener);
        withdraw.setOnCheckedChangeListener(listener);
        twoDevices.setOnCheckedChangeListener(listener);

        authorizeButton.setOnClickListener(v -> requestProjection());
        stopButton.setOnClickListener(v -> {
            Intent stop = new Intent(this, ScreenShareService.class).setAction(ScreenShareService.ACTION_STOP);
            startService(stop);
            stopButton.setVisibility(Button.GONE);
            authorizeButton.setVisibility(Button.VISIBLE);
            statusText.setText("Screen sharing stopped.");
        });
    }

    private boolean allRequiredChecks() {
        return purpose.isChecked() && scope.isChecked() && withdraw.isChecked() && twoDevices.isChecked();
    }

    private boolean hasSession() {
        return serverUrl != null && sessionId != null && guestToken != null;
    }

    private void loadJoinIntent(Intent intent) {
        Uri data = intent.getData();
        if (data == null) {
            statusText.setText("Open the QR join link from the viewer console.");
            return;
        }

        Uri uri = data;
        String server;
        String sid;
        String token;

        if ("phantomdroid".equalsIgnoreCase(uri.getScheme())) {
            server = uri.getQueryParameter("server");
            sid = uri.getQueryParameter("session");
            token = uri.getQueryParameter("token");
        } else {
            server = uri.getScheme() + "://" + uri.getAuthority();
            sid = uri.getQueryParameter("session");
            token = uri.getQueryParameter("token");
        }

        if (server == null || sid == null || token == null || !server.startsWith("https://")) {
            statusText.setText("Invalid secure session link.");
            return;
        }

        serverUrl = server;
        sessionId = sid;
        guestToken = token;
        sessionText.setText("Session: " + sid + "\nServer: " + server);
        statusText.setText("Read the notice, complete every specific consent choice, then continue.");
    }

    private void requestProjection() {
        if (!hasSession() || !allRequiredChecks()) {
            statusText.setText("Complete all required consent choices first.");
            return;
        }

        statusText.setText("Starting the operating-system screen-share permission prompt…");

        MediaProjectionManager manager =
                (MediaProjectionManager) getSystemService(MEDIA_PROJECTION_SERVICE);

        Intent captureIntent;
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.UPSIDE_DOWN_CAKE) {
            captureIntent = manager.createScreenCaptureIntent(
                    MediaProjectionConfig.createConfigForDefaultDisplay());
        } else {
            captureIntent = manager.createScreenCaptureIntent();
        }

        startActivityForResult(captureIntent, REQUEST_MEDIA_PROJECTION);
    }

    @Override
    protected void onNewIntent(Intent intent) {
        super.onNewIntent(intent);
        setIntent(intent);
        loadJoinIntent(intent);
    }

    @Override
    protected void onActivityResult(int requestCode, int resultCode, Intent data) {
        super.onActivityResult(requestCode, resultCode, data);

        if (requestCode != REQUEST_MEDIA_PROJECTION) return;

        if (resultCode != Activity.RESULT_OK || data == null) {
            statusText.setText("Screen-share permission denied. No screen was shared.");
            return;
        }

        Intent service = new Intent(this, ScreenShareService.class);
        service.putExtra(ScreenShareService.EXTRA_SERVER_URL, serverUrl);
        service.putExtra(ScreenShareService.EXTRA_SESSION_ID, sessionId);
        service.putExtra(ScreenShareService.EXTRA_GUEST_TOKEN, guestToken);
        service.putExtra(ScreenShareService.EXTRA_RESULT_CODE, resultCode);
        service.putExtra(ScreenShareService.EXTRA_RESULT_DATA, data);

        if (Build.VERSION.SDK_INT >= 26) {
            startForegroundService(service);
        } else {
            startService(service);
        }

        statusText.setText("OS permission granted. Connecting the authorized screen stream…");
        authorizeButton.setVisibility(Button.GONE);
        stopButton.setVisibility(Button.VISIBLE);
    }
}
