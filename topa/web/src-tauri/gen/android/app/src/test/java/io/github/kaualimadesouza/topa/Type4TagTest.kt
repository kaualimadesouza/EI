package io.github.kaualimadesouza.topa

import org.junit.Assert.assertArrayEquals
import org.junit.Assert.assertEquals
import org.junit.Test

private const val URL = "https://topa-totem.vercel.app/?loja=lanchonete-bem-te-vi"

private fun hex(text: String): ByteArray =
    text.replace(" ", "").chunked(2).map { it.toInt(16).toByte() }.toByteArray()

private val OK = hex("9000")
private val SELECT_APP = hex("00A4040007D276000085010100")
private val SELECT_CC = hex("00A4000C02E103")
private val SELECT_NDEF = hex("00A4000C02E104")

private fun read(offset: Int, length: Int) = byteArrayOf(0, 0xB0.toByte(), (offset shr 8).toByte(), offset.toByte(), length.toByte())

private fun ByteArray.status() = copyOfRange(size - 2, size)

private fun ByteArray.data() = copyOfRange(0, size - 2)

/** What a phone does on tap: select the app, read the CC for the chunk size, then the NDEF file. */
private fun readMessage(tag: Type4Tag, url: String?): ByteArray {
    assertArrayEquals(OK, tag.respond(SELECT_APP, url))
    assertArrayEquals(OK, tag.respond(SELECT_CC, url))
    val cc = tag.respond(read(0, 15), url).data()
    val chunk = ((cc[3].toInt() and 0xFF) shl 8) or (cc[4].toInt() and 0xFF)
    assertArrayEquals(OK, tag.respond(SELECT_NDEF, url))
    val nlen = tag.respond(read(0, 2), url).data()
    val length = ((nlen[0].toInt() and 0xFF) shl 8) or (nlen[1].toInt() and 0xFF)
    var message = ByteArray(0)
    while (message.size < length) {
        message += tag.respond(read(2 + message.size, minOf(chunk, length - message.size)), url).data()
    }
    return message
}

class Type4TagTest {
    @Test
    fun servesThePublishedUrlAsOneUriRecord() {
        val rest = URL.removePrefix("https://").toByteArray()
        val expected = byteArrayOf(0xD1.toByte(), 0x01, (rest.size + 1).toByte(), 0x55, 0x04) + rest

        assertArrayEquals(expected, readMessage(Type4Tag(), URL))
    }

    @Test
    fun describesAReadOnlyNdefFileInTheCapabilityContainer() {
        val tag = Type4Tag()
        tag.respond(SELECT_APP, URL)
        tag.respond(SELECT_CC, URL)

        val cc = tag.respond(read(0, 15), URL)

        assertArrayEquals(OK, cc.status())
        assertArrayEquals(hex("000F 20 003B 0034 0406 E104"), cc.data().copyOfRange(0, 11))
        assertArrayEquals(hex("00 FF"), cc.data().copyOfRange(13, 15))
        // the max NDEF size covers NLEN plus the record, or readers reject the tag
        val ndefSize = 2 + readMessage(Type4Tag(), URL).size
        assertArrayEquals(byteArrayOf((ndefSize shr 8).toByte(), ndefSize.toByte()), cc.data().copyOfRange(11, 13))
    }

    @Test
    fun keepsTheUrlItHadWhenTheReaderSelectedTheApplication() {
        val tag = Type4Tag()
        tag.respond(SELECT_APP, URL)
        tag.respond(SELECT_NDEF, "https://example.com/?loja=outra")

        val nlen = tag.respond(read(0, 2), "https://example.com/?loja=outra").data()

        assertEquals(readMessage(Type4Tag(), URL).size, ((nlen[0].toInt() and 0xFF) shl 8) or (nlen[1].toInt() and 0xFF))
    }

    @Test
    fun switchesToTheLongRecordFormPast255PayloadBytes() {
        // the payload is the prefix code plus the URL, so 254 characters fill a short record exactly
        assertEquals(0xD1.toByte(), readMessage(Type4Tag(), "topa:" + "a".repeat(249))[0])
        assertEquals(0xC1.toByte(), readMessage(Type4Tag(), "topa:" + "a".repeat(250))[0])
    }

    @Test
    fun abbreviatesTheWwwPrefixAndUsesTheLongRecordFormForLongUrls() {
        val long = "http://www.example.com/" + "a".repeat(300)
        val message = readMessage(Type4Tag(), long)

        assertEquals(0xC1.toByte(), message[0])
        assertArrayEquals(hex("00000139"), message.copyOfRange(2, 6))
        assertEquals(0x01.toByte(), message[7])
        assertEquals(320, message.size)
    }

    @Test
    fun sendsAnUnknownSchemeWhole() {
        val message = readMessage(Type4Tag(), "topa:loja")

        assertArrayEquals(byteArrayOf(0x00) + "topa:loja".toByteArray(), message.copyOfRange(4, message.size))
    }

    @Test
    fun staysSilentWhileNothingIsPublished() {
        assertArrayEquals(hex("6A82"), Type4Tag().respond(SELECT_APP, null))
    }

    @Test
    fun refusesFilesBeforeTheNdefApplicationIsSelected() {
        assertArrayEquals(hex("6A82"), Type4Tag().respond(SELECT_CC, URL))
    }

    @Test
    fun refusesUnknownFilesAndReadsWithoutAFile() {
        val tag = Type4Tag()
        tag.respond(SELECT_APP, URL)

        assertArrayEquals(hex("6A82"), tag.respond(read(0, 2), URL))
        assertArrayEquals(hex("6A82"), tag.respond(hex("00A4000C02E105"), URL))
        assertArrayEquals(hex("6A82"), tag.respond(hex("00A4000C01E1"), URL))
    }

    @Test
    fun refusesAReadFromTheEndOnAndUnknownOrForeignInstructions() {
        val tag = Type4Tag()
        tag.respond(SELECT_APP, URL)
        tag.respond(SELECT_CC, URL)

        assertArrayEquals(hex("6B00"), tag.respond(read(15, 1), URL))
        assertArrayEquals(hex("6D00"), tag.respond(hex("00D6000001FF"), URL))
        assertArrayEquals(hex("6D00"), tag.respond(hex("80B0000002"), URL))
        assertArrayEquals(hex("6D00"), tag.respond(hex("00B0"), URL))
    }

    @Test
    fun forgetsTheSelectionWhenTheReaderLeaves() {
        val tag = Type4Tag()
        tag.respond(SELECT_APP, URL)
        tag.respond(SELECT_CC, URL)

        tag.reset()

        assertArrayEquals(hex("6A82"), tag.respond(read(0, 2), URL))
    }
}
