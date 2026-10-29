package io.github.kaualimadesouza.topa.loja

private val OK = byteArrayOf(0x90.toByte(), 0x00)
private val NOT_FOUND = byteArrayOf(0x6A, 0x82.toByte())
private val WRONG_OFFSET = byteArrayOf(0x6B, 0x00)
private val NOT_SUPPORTED = byteArrayOf(0x6D, 0x00)

// SELECT by name of the NFC Forum NDEF tag application (AID D2760000850101)
private val SELECT_NDEF_APP = byteArrayOf(0x00, 0xA4.toByte(), 0x04, 0x00, 0x07, 0xD2.toByte(), 0x76, 0x00, 0x00, 0x85.toByte(), 0x01, 0x01)
private const val CC_FILE = 0xE103
private const val NDEF_FILE = 0xE104
private const val MAX_READ = 0x3B
private const val MAX_COMMAND = 0x34

// URI identifier codes, longest first so "https://www." wins over "https://"
private val URI_PREFIXES = listOf("https://www." to 0x02, "http://www." to 0x01, "https://" to 0x04, "http://" to 0x03)

private fun ByteArray.startsWith(prefix: ByteArray) = size >= prefix.size && prefix.indices.all { this[it] == prefix[it] }

private fun u16(value: Int) = byteArrayOf((value shr 8).toByte(), value.toByte())

private fun uriRecord(url: String): ByteArray {
    val (prefix, code) = URI_PREFIXES.firstOrNull { url.startsWith(it.first) } ?: ("" to 0x00)
    val payload = byteArrayOf(code.toByte()) + url.removePrefix(prefix).toByteArray(Charsets.UTF_8)
    val length = if (payload.size < 256) byteArrayOf(payload.size.toByte()) else u16(payload.size shr 16) + u16(payload.size)
    val header = if (payload.size < 256) 0xD1 else 0xC1
    return byteArrayOf(header.toByte(), 0x01) + length + 0x55.toByte() + payload
}

private fun ndefFile(url: String): ByteArray {
    val record = uriRecord(url)
    return u16(record.size) + record
}

private fun capabilityContainer(ndefSize: Int): ByteArray =
    u16(15) + 0x20.toByte() + u16(MAX_READ) + u16(MAX_COMMAND) + byteArrayOf(0x04, 0x06) + u16(NDEF_FILE) + u16(ndefSize) +
        byteArrayOf(0x00, 0xFF.toByte())

/** The read-only NDEF application of an NFC Forum Type 4 tag holding one URI record; pure Kotlin so the JVM tests it. */
class Type4Tag {
    // taken when the reader selects the application, so the CC and the NDEF file always agree
    private var ndef: ByteArray? = null
    private var file: ByteArray? = null

    /** Answers one command APDU; a null [url] means nothing is published, so the tag is not there. */
    fun respond(apdu: ByteArray, url: String?): ByteArray {
        if (url == null) return NOT_FOUND
        if (apdu.startsWith(SELECT_NDEF_APP)) {
            ndef = ndefFile(url)
            file = null
            return OK
        }
        val ndef = ndef ?: return NOT_FOUND
        val instruction = if (apdu.size >= 5 && apdu[0] == 0x00.toByte()) apdu[1].toInt() and 0xFF else -1
        return when (instruction) {
            0xA4 -> select(apdu, ndef)
            0xB0 -> read(apdu)
            else -> NOT_SUPPORTED
        }
    }

    fun reset() {
        ndef = null
        file = null
    }

    private fun select(apdu: ByteArray, ndef: ByteArray): ByteArray {
        val id = if (apdu.size >= 7) ((apdu[5].toInt() and 0xFF) shl 8) or (apdu[6].toInt() and 0xFF) else -1
        file = when (id) {
            CC_FILE -> capabilityContainer(ndef.size)
            NDEF_FILE -> ndef
            else -> return NOT_FOUND
        }
        return OK
    }

    private fun read(apdu: ByteArray): ByteArray {
        val content = file ?: return NOT_FOUND
        val offset = ((apdu[2].toInt() and 0x7F) shl 8) or (apdu[3].toInt() and 0xFF)
        if (offset >= content.size) return WRONG_OFFSET
        val wanted = (apdu[4].toInt() and 0xFF).let { if (it == 0) 256 else it }
        return content.copyOfRange(offset, minOf(offset + wanted, content.size)) + OK
    }
}