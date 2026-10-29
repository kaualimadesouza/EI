package io.github.kaualimadesouza.topa

import org.junit.Assert.assertEquals
import org.junit.Test

fun semverToVersionCode(versionName: String, fallback: Int = 1): Int {
    val cleanVersion = versionName.substringBefore('-')
    val parts = cleanVersion.split('.').mapNotNull { it.toIntOrNull() }
    return if (parts.size >= 3) {
        parts[0] * 100000 + parts[1] * 1000 + parts[2]
    } else {
        fallback
    }
}

class VersionCodeTest {
    @Test
    fun derivesVersionCodeFromSemver() {
        assertEquals(1003, semverToVersionCode("0.1.3"))
        assertEquals(1003, semverToVersionCode("0.1.3-rc1"))
        assertEquals(1003, semverToVersionCode("0.1.3-beta.2"))
        assertEquals(1004, semverToVersionCode("0.1.4"))
        assertEquals(1100, semverToVersionCode("0.1.100"))
        assertEquals(2000, semverToVersionCode("0.2.0"))
        assertEquals(100000, semverToVersionCode("1.0.0"))
        assertEquals(102004, semverToVersionCode("1.2.4"))
    }

    @Test
    fun fallsBackToProvidedCodeWhenNotSemver() {
        assertEquals(1, semverToVersionCode("alpha"))
        assertEquals(42, semverToVersionCode("dev", 42))
    }
}
