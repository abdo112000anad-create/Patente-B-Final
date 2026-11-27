package it.patenteb.sideload.v29;

import org.junit.Test;
import static org.junit.Assert.assertEquals;
import static org.junit.Assert.assertFalse;
import static org.junit.Assert.assertTrue;

public class NativeTtsPolicyTest {
    @Test public void acceptsOnlyNonNullNonWhitespaceText() {
        assertFalse(NativeTtsPolicy.hasSpeakableText(null));
        assertFalse(NativeTtsPolicy.hasSpeakableText(""));
        assertFalse(NativeTtsPolicy.hasSpeakableText(" \t\n "));
        assertTrue(NativeTtsPolicy.hasSpeakableText(" ciao "));
    }

    @Test public void acceptsValidLanguageTagsAndRejectsMalformedValues() {
        assertTrue(NativeTtsPolicy.supportsLocale("it-IT"));
        assertTrue(NativeTtsPolicy.supportsLocale("it-it"));
        assertTrue(NativeTtsPolicy.supportsLocale("en-US"));
        assertTrue(NativeTtsPolicy.supportsLocale("ar-EG"));
        assertTrue(NativeTtsPolicy.supportsLocale("it"));
        assertFalse(NativeTtsPolicy.supportsLocale(null));
        assertFalse(NativeTtsPolicy.supportsLocale(""));
        assertFalse(NativeTtsPolicy.supportsLocale(" "));
        assertFalse(NativeTtsPolicy.supportsLocale("it_IT"));
        assertFalse(NativeTtsPolicy.supportsLocale("not-a-locale!"));
    }

    @Test public void initializationHasAFiniteTimeout() {
        assertEquals(15000L, NativeTtsPolicy.initializationTimeoutMillis());
    }

    @Test public void timeoutIsClampedAndScalesAtBoundaries() {
        assertEquals(20000L, NativeTtsPolicy.timeoutMillisForTextLength(0));
        assertEquals(20000L, NativeTtsPolicy.timeoutMillisForTextLength(57));
        assertEquals(20300L, NativeTtsPolicy.timeoutMillisForTextLength(58));
        assertEquals(119700L, NativeTtsPolicy.timeoutMillisForTextLength(342));
        assertEquals(120000L, NativeTtsPolicy.timeoutMillisForTextLength(343));
        assertEquals(120000L, NativeTtsPolicy.timeoutMillisForTextLength(Integer.MAX_VALUE));
    }

    @Test public void callbacksMatchOnlyTheCurrentNonNullUtteranceId() {
        assertTrue(NativeTtsPolicy.matchesUtterance("current", "current"));
        assertFalse(NativeTtsPolicy.matchesUtterance("current", "stale"));
        assertFalse(NativeTtsPolicy.matchesUtterance(null, "current"));
        assertFalse(NativeTtsPolicy.matchesUtterance("current", null));
        assertFalse(NativeTtsPolicy.matchesUtterance(null, null));
    }
}
