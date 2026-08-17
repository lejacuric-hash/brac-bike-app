package com.bracbybike.app;

import android.content.Context;
import android.os.Bundle;
import android.os.PowerManager;

import com.getcapacitor.BridgeActivity;

public class MainActivity extends BridgeActivity {
    @Override
    public void onCreate(Bundle savedInstanceState) {
        super.onCreate(savedInstanceState);

        PowerManager pm = (PowerManager) getSystemService(Context.POWER_SERVICE);
        PowerManager.WakeLock wakeLock = pm.newWakeLock(
            PowerManager.PARTIAL_WAKE_LOCK, "BracBike::RideTracking"
        );
        wakeLock.acquire();
    }
}
