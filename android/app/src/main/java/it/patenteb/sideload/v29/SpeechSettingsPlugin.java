package it.patenteb.sideload.v29;

import android.app.Activity;
import android.content.Intent;
import android.speech.tts.TextToSpeech;

import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.CapacitorPlugin;

/** Opens Android's standard TTS data installer; speech remains Web Speech in the WebView. */
@CapacitorPlugin(name = "SpeechSettings")
public class SpeechSettingsPlugin extends Plugin {
    @PluginMethod
    public void openVoiceDataSettings(PluginCall call) {
        Activity activity = getActivity();
        if (activity == null || activity.isFinishing() || activity.isDestroyed()) {
            call.reject("speech_data_settings_unavailable");
            return;
        }
        activity.runOnUiThread(() -> {
            try {
                Intent intent = new Intent(TextToSpeech.Engine.ACTION_INSTALL_TTS_DATA);
                activity.startActivity(intent);
                call.resolve();
            } catch (Exception error) {
                call.reject("speech_data_settings_unavailable");
            }
        });
    }
}
