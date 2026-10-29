package io.github.kaualimadesouza.topa

import org.junit.Assert.assertEquals
import org.junit.Test

fun semverToVersionCode(versionName: String, fallback: Int = 1): Int {
    val parts = versionName.split(".").mapNotNull { it.toIntOrNull() }
    return if (parts.size >= 3) {
        parts[0] * 10000 + parts[1] * 100 + parts[2]
    } else {
        fallback
    }
}

class VersionCodeTest {
    @Test
    fun derivesVersionCodeFromSemver() {
        assertEquals(103, semverToVersionCode("0.1.3"))
        assertEquals(104, semverToVersionCode("0.1.4"))
        assertEquals(200, semverToVersionCode("0.2.0"))
        assertEquals(10000, semverToVersionCode("1.0.0"))
        assertEquals(10204, semverToVersionCode("1.2.4"))
    }

    @Test
    fun fallsBackToProvidedCodeWhenNotSemver() {
        assertEquals(1, semverToVersionCode("alpha"))
        assertEquals(42, semverToVersionCode("dev", 42))
    }
}
