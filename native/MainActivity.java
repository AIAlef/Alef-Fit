package fit.alef.app;

import android.os.Bundle;
import android.view.View;
import com.getcapacitor.BridgeActivity;

// Copied over the generated MainActivity by the APK build (CI workflow +
// tools/build-apk.sh). Turns off the Android over-scroll stretch on the
// WebView: it stretched the WHOLE page, so the fixed bottom tab bar slid
// down with the list on a pull-down. CSS overscroll-behavior does not
// reach this View-level effect.
public class MainActivity extends BridgeActivity {
    @Override
    protected void onCreate(Bundle savedInstanceState) {
        super.onCreate(savedInstanceState);
        if (getBridge() != null) {
            getBridge().getWebView().setOverScrollMode(View.OVER_SCROLL_NEVER);
        }
    }
}
