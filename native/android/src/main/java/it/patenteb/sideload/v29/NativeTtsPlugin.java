package it.patenteb.sideload.v29;

import android.content.Context;
import android.os.Bundle;
import android.os.Handler;
import android.os.Looper;
import android.speech.tts.TextToSpeech;
import android.speech.tts.UtteranceProgressListener;
import androidx.annotation.NonNull;
import com.getcapacitor.JSObject;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.CapacitorPlugin;
import java.util.ArrayList;
import java.util.List;
import java.util.Locale;
import java.util.UUID;

/** Bridges Android's selected system TTS engine to the Italian-only learning UI. */
@CapacitorPlugin(name = "NativeTts")
public class NativeTtsPlugin extends Plugin {
    private static final String ITALIAN_LOCALE = "it-IT";
    private static final float ITALIAN_RATE = 0.8f;
    private static final float ITALIAN_PITCH = 1.0f;

    private final Handler mainHandler = new Handler(Looper.getMainLooper());
    private final Object lock = new Object();
    private final List<PluginCall> initializationCalls = new ArrayList<>();
    private TextToSpeech textToSpeech;
    private PluginCall activeSpeakCall;
    private String activeUtteranceId;
    private Runnable activeTimeout;
    private boolean initializing;
    private boolean ttsInitialized;
    private boolean engineReady;
    private boolean italianAvailable;
    private String initializationError = "";

    @PluginMethod
    public void initialize(PluginCall call) {
        mainHandler.post(() -> initializeOnMainThread(call));
    }

    private void initializeOnMainThread(PluginCall call) {
        synchronized (lock) {
            if (engineReady) {
                call.resolve(initializationResult());
                return;
            }
            initializationCalls.add(call);
            if (initializing) return;
            initializing = true;
        }

        if (ttsInitialized && textToSpeech != null) {
            finishInitialization(TextToSpeech.SUCCESS);
            return;
        }
        try {
            Context context = getContext().getApplicationContext();
            textToSpeech = new TextToSpeech(context, status -> mainHandler.post(() -> finishInitialization(status)));
        } catch (RuntimeException error) {
            synchronized (lock) {
                initializing = false;
                engineReady = false;
                italianAvailable = false;
                initializationError = "tts-engine-initialization-failed";
            }
            resolveInitializationCalls();
        }
    }

    private void finishInitialization(int status) {
        synchronized (lock) {
            initializing = false;
            if (status != TextToSpeech.SUCCESS || textToSpeech == null) {
                ttsInitialized = false;
                engineReady = false;
                italianAvailable = false;
                initializationError = "tts-engine-initialization-failed";
                if (textToSpeech != null) {
                    try { textToSpeech.shutdown(); } catch (RuntimeException ignored) {}
                    textToSpeech = null;
                }
            } else {
                ttsInitialized = true;
                textToSpeech.setOnUtteranceProgressListener(new UtteranceProgressListener() {
                    @Override
                    public void onStart(String utteranceId) {}

                    @Override
                    public void onDone(String utteranceId) {
                        mainHandler.post(() -> finishUtterance(utteranceId, true, null));
                    }

                    @Override
                    public void onError(String utteranceId) {
                        mainHandler.post(() -> finishUtterance(utteranceId, false, "tts-playback-failed"));
                    }

                    @Override
                    public void onError(String utteranceId, int errorCode) {
                        mainHandler.post(() -> finishUtterance(utteranceId, false, "tts-playback-error-" + errorCode));
                    }

                    @Override
                    public void onStop(String utteranceId, boolean interrupted) {
                        mainHandler.post(() -> finishUtterance(utteranceId, false, null));
                    }

                    @Override
                    public void onRangeStart(String utteranceId, int start, int end, int frame) {
                        JSObject progress = new JSObject();
                        progress.put("utteranceId", utteranceId);
                        progress.put("locale", ITALIAN_LOCALE);
                        progress.put("start", start);
                        progress.put("end", end);
                        mainHandler.post(() -> notifyListeners("progress", progress));
                    }
                });
                int languageStatus = textToSpeech.setLanguage(Locale.forLanguageTag(ITALIAN_LOCALE));
                italianAvailable = languageStatus != TextToSpeech.LANG_MISSING_DATA
                    && languageStatus != TextToSpeech.LANG_NOT_SUPPORTED;
                if (italianAvailable) {
                    textToSpeech.setPitch(ITALIAN_PITCH);
                    textToSpeech.setSpeechRate(ITALIAN_RATE);
                    engineReady = true;
                    initializationError = "";
                } else {
                    engineReady = false;
                    initializationError = "language-unavailable";
                }
            }
        }
        resolveInitializationCalls();
    }

    private JSObject initializationResult() {
        JSObject result = new JSObject();
        result.put("ready", engineReady && italianAvailable);
        result.put("locale", ITALIAN_LOCALE);
        result.put("languageAvailable", italianAvailable);
        result.put("engine", textToSpeech == null ? "" : String.valueOf(textToSpeech.getDefaultEngine()));
        if (!initializationError.isEmpty()) result.put("error", initializationError);
        return result;
    }

    private void resolveInitializationCalls() {
        List<PluginCall> pending;
        JSObject result;
        synchronized (lock) {
            pending = new ArrayList<>(initializationCalls);
            initializationCalls.clear();
            result = initializationResult();
        }
        for (PluginCall pendingCall : pending) pendingCall.resolve(result);
    }

    @PluginMethod
    public void speak(PluginCall call) {
        String text = call.getString("text", "");
        String locale = call.getString("locale", "");
        if (text == null || text.trim().isEmpty()) {
            call.reject("empty-text");
            return;
        }
        if (!ITALIAN_LOCALE.equals(locale)) {
            call.reject("unsupported-locale");
            return;
        }
        mainHandler.post(() -> speakOnMainThread(call, text));
    }

    private void speakOnMainThread(PluginCall call, String text) {
        if (!engineReady || !italianAvailable || textToSpeech == null) {
            call.reject(initializationError.isEmpty() ? "tts-engine-not-ready" : initializationError);
            return;
        }
        String utteranceId = null;
        try {
            int languageStatus = textToSpeech.setLanguage(Locale.forLanguageTag(ITALIAN_LOCALE));
            if (languageStatus == TextToSpeech.LANG_MISSING_DATA || languageStatus == TextToSpeech.LANG_NOT_SUPPORTED) {
                call.reject("language-unavailable");
                return;
            }
            textToSpeech.setPitch(ITALIAN_PITCH);
            textToSpeech.setSpeechRate(ITALIAN_RATE);
            utteranceId = UUID.randomUUID().toString();
            final String timeoutUtteranceId = utteranceId;
            synchronized (lock) {
                finishActiveCallLocked(false, true, null);
                activeSpeakCall = call;
                activeUtteranceId = utteranceId;
                long timeoutMs = Math.max(20000L, Math.min(120000L, text.length() * 350L));
                activeTimeout = () -> {
                    finishUtterance(timeoutUtteranceId, false, "tts-playback-timeout");
                    try { if (textToSpeech != null) textToSpeech.stop(); } catch (RuntimeException ignored) {}
                };
                mainHandler.postDelayed(activeTimeout, timeoutMs);
            }
            Bundle options = new Bundle();
            options.putFloat(TextToSpeech.Engine.KEY_PARAM_VOLUME, 1.0f);
            int result = textToSpeech.speak(text, TextToSpeech.QUEUE_FLUSH, options, utteranceId);
            if (result == TextToSpeech.ERROR) finishUtterance(utteranceId, false, "tts-enqueue-failed");
        } catch (RuntimeException error) {
            if (utteranceId != null) finishUtterance(utteranceId, false, "tts-playback-failed");
            else call.reject("tts-playback-failed");
        }
    }

    @PluginMethod
    public void stop(PluginCall call) {
        mainHandler.post(() -> {
            synchronized (lock) {
                finishActiveCallLocked(false, true, null);
            }
            try {
                if (textToSpeech != null) textToSpeech.stop();
            } catch (RuntimeException ignored) {}
            JSObject result = new JSObject();
            result.put("stopped", true);
            call.resolve(result);
        });
    }

    private void finishUtterance(String utteranceId, boolean completed, String error) {
        synchronized (lock) {
            if (activeSpeakCall == null || !utteranceId.equals(activeUtteranceId)) return;
            finishActiveCallLocked(completed, !completed && error == null, error);
        }
    }

    private void finishActiveCallLocked(boolean completed, boolean cancelled, String error) {
        if (activeTimeout != null) {
            mainHandler.removeCallbacks(activeTimeout);
            activeTimeout = null;
        }
        PluginCall call = activeSpeakCall;
        activeSpeakCall = null;
        activeUtteranceId = null;
        if (call == null) return;
        if (error != null) {
            call.reject(error);
            return;
        }
        JSObject result = new JSObject();
        result.put("completed", completed);
        result.put("cancelled", cancelled);
        call.resolve(result);
    }

    @Override
    protected void handleOnDestroy() {
        mainHandler.post(() -> {
            synchronized (lock) {
                finishActiveCallLocked(false, true, null);
                engineReady = false;
                ttsInitialized = false;
                if (textToSpeech != null) {
                    try {
                        textToSpeech.stop();
                        textToSpeech.shutdown();
                    } catch (RuntimeException ignored) {}
                    textToSpeech = null;
                }
            }
        });
    }
}
