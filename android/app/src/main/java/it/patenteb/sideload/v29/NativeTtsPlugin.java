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
    private static final String ITALIAN_LOCALE = NativeTtsPolicy.ITALIAN_LOCALE;
    private static final float ITALIAN_RATE = 0.8f;
    private static final float ITALIAN_PITCH = 1.0f;

    private final Handler mainHandler = new Handler(Looper.getMainLooper());
    private final Object lock = new Object();
    private final List<PluginCall> initializationCalls = new ArrayList<>();
    private Runnable initializationTimeout;
    private TextToSpeech textToSpeech;
    private PluginCall activeSpeakCall;
    private String activeUtteranceId;
    private String activeSpeakLocale = "";
    private Runnable activeTimeout;
    private boolean initializing;
    private boolean ttsInitialized;
    private boolean engineReady;
    private boolean languageAvailable;
    private String readyLocale = "";
    private String initializationLocale = ITALIAN_LOCALE;
    private int initializationGeneration;
    private String initializationError = "";

    @PluginMethod
    public void initialize(PluginCall call) {
        String locale = call.getString("locale", ITALIAN_LOCALE);
        if (!NativeTtsPolicy.supportsLocale(locale)) {
            call.reject("unsupported-locale");
            return;
        }
        mainHandler.post(() -> initializeOnMainThread(call, locale));
    }

    private void initializeOnMainThread(PluginCall call, String locale) {
        int generation;
        synchronized (lock) {
            if (engineReady && locale.equals(readyLocale)) {
                call.resolve(initializationResult());
                return;
            }
            initializationCalls.add(call);
            if (initializing) {
                initializationLocale = locale;
                return;
            }
            initializing = true;
            initializationLocale = locale;
            generation = ++initializationGeneration;
            initializationTimeout = () -> failInitialization(generation, "tts-engine-initialization-timeout");
            mainHandler.postDelayed(initializationTimeout, NativeTtsPolicy.initializationTimeoutMillis());
        }

        if (ttsInitialized && textToSpeech != null) {
            finishInitialization(TextToSpeech.SUCCESS, generation);
            return;
        }
        try {
            Context context = getContext().getApplicationContext();
            textToSpeech = new TextToSpeech(context, status -> mainHandler.post(() -> finishInitialization(status, generation)));
        } catch (RuntimeException error) {
            failInitialization(generation, "tts-engine-initialization-failed");
        }
    }

    private void finishInitialization(int status, int generation) {
        synchronized (lock) {
            if (!initializing || generation != initializationGeneration) return;
            initializing = false;
            if (initializationTimeout != null) {
                mainHandler.removeCallbacks(initializationTimeout);
                initializationTimeout = null;
            }
            if (status != TextToSpeech.SUCCESS || textToSpeech == null) {
                ttsInitialized = false;
                engineReady = false;
                languageAvailable = false;
                readyLocale = "";
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
                        mainHandler.post(() -> {
                            synchronized (lock) {
                                if (!NativeTtsPolicy.matchesUtterance(activeUtteranceId, utteranceId)) return;
                                JSObject progress = new JSObject();
                                progress.put("utteranceId", utteranceId);
                                progress.put("locale", activeSpeakLocale);
                                progress.put("start", start);
                                progress.put("end", end);
                                notifyListeners("progress", progress);
                            }
                        });
                    }
                });
                int languageStatus = textToSpeech.setLanguage(Locale.forLanguageTag(initializationLocale));
                languageAvailable = languageStatus >= TextToSpeech.LANG_AVAILABLE;
                if (languageAvailable) {
                    textToSpeech.setPitch(ITALIAN_PITCH);
                    textToSpeech.setSpeechRate(ITALIAN_RATE);
                    engineReady = true;
                    readyLocale = initializationLocale;
                    initializationError = "";
                } else {
                    engineReady = false;
                    readyLocale = "";
                    initializationError = "language-unavailable";
                }
            }
        }
        resolveInitializationCalls();
    }

    private void failInitialization(int generation, String error) {
        synchronized (lock) {
            if (!initializing || generation != initializationGeneration) return;
            initializing = false;
            if (initializationTimeout != null) {
                mainHandler.removeCallbacks(initializationTimeout);
                initializationTimeout = null;
            }
            ttsInitialized = false;
            engineReady = false;
            languageAvailable = false;
            readyLocale = "";
            initializationError = error;
            if (textToSpeech != null) {
                try { textToSpeech.shutdown(); } catch (RuntimeException ignored) {}
                textToSpeech = null;
            }
        }
        resolveInitializationCalls();
    }

    private JSObject initializationResult() {
        JSObject result = new JSObject();
        result.put("ready", engineReady && languageAvailable);
        result.put("locale", readyLocale.isEmpty() ? initializationLocale : readyLocale);
        result.put("languageAvailable", languageAvailable);
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
        String locale = call.getString("locale", ITALIAN_LOCALE);
        if (!NativeTtsPolicy.hasSpeakableText(text)) {
            call.reject("empty-text");
            return;
        }
        if (!NativeTtsPolicy.supportsLocale(locale)) {
            call.reject("unsupported-locale");
            return;
        }
        mainHandler.post(() -> speakOnMainThread(call, text, locale));
    }

    private void speakOnMainThread(PluginCall call, String text, String locale) {
        if (!engineReady || !languageAvailable || !locale.equals(readyLocale) || textToSpeech == null) {
            call.reject(initializationError.isEmpty() ? "tts-engine-not-ready" : initializationError);
            return;
        }
        String utteranceId = null;
        try {
            int languageStatus = textToSpeech.setLanguage(Locale.forLanguageTag(locale));
            if (languageStatus < TextToSpeech.LANG_AVAILABLE) {
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
                activeSpeakLocale = locale;
                long timeoutMs = NativeTtsPolicy.timeoutMillisForTextLength(text.length());
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
            if (activeSpeakCall == null || !NativeTtsPolicy.matchesUtterance(activeUtteranceId, utteranceId)) return;
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
        activeSpeakLocale = "";
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
