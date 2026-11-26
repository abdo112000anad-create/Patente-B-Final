package it.patenteb.sideload.v29;

/** Pure policy decisions shared by the native TTS bridge and JVM unit tests. */
final class NativeTtsPolicy {
    static final String ITALIAN_LOCALE = "it-IT";
    private static final long MIN_TIMEOUT_MS = 20000L;
    private static final long MAX_TIMEOUT_MS = 120000L;
    private static final long TIMEOUT_PER_CHARACTER_MS = 350L;

    private NativeTtsPolicy() {}

    static boolean hasSpeakableText(String text) {
        return text != null && !text.trim().isEmpty();
    }

    static boolean supportsLocale(String locale) {
        return ITALIAN_LOCALE.equals(locale);
    }

    static long timeoutMillisForTextLength(int textLength) {
        return Math.max(MIN_TIMEOUT_MS, Math.min(MAX_TIMEOUT_MS, textLength * TIMEOUT_PER_CHARACTER_MS));
    }

    static boolean matchesUtterance(String expectedId, String actualId) {
        return expectedId != null && actualId != null && expectedId.equals(actualId);
    }
}
