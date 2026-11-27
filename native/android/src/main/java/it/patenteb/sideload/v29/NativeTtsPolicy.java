package it.patenteb.sideload.v29;

import java.util.Locale;

/** Pure policy decisions shared by the native TTS bridge and JVM unit tests. */
final class NativeTtsPolicy {
    static final String ITALIAN_LOCALE = "it-IT";
    private static final long INITIALIZATION_TIMEOUT_MS = 15000L;
    private static final long MIN_TIMEOUT_MS = 20000L;
    private static final long MAX_TIMEOUT_MS = 120000L;
    private static final long TIMEOUT_PER_CHARACTER_MS = 350L;

    private NativeTtsPolicy() {}

    static boolean hasSpeakableText(String text) {
        return text != null && !text.trim().isEmpty();
    }

    static boolean supportsLocale(String locale) {
        if (locale == null || locale.isEmpty() || !locale.equals(locale.trim())) return false;
        Locale parsed = Locale.forLanguageTag(locale);
        String canonical = parsed.toLanguageTag();
        return !parsed.getLanguage().isEmpty() && !"und".equalsIgnoreCase(canonical)
            && canonical.equalsIgnoreCase(locale);
    }

    static long initializationTimeoutMillis() {
        return INITIALIZATION_TIMEOUT_MS;
    }

    static long timeoutMillisForTextLength(int textLength) {
        return Math.max(MIN_TIMEOUT_MS, Math.min(MAX_TIMEOUT_MS, textLength * TIMEOUT_PER_CHARACTER_MS));
    }

    static boolean matchesUtterance(String expectedId, String actualId) {
        return expectedId != null && actualId != null && expectedId.equals(actualId);
    }
}
