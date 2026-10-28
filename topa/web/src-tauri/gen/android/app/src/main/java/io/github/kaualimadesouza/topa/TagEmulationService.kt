package io.github.kaualimadesouza.topa

import android.nfc.cardemulation.HostApduService
import android.os.Bundle

/** Answers phones as an NFC tag holding the URL the kiosk published, so an Android totem needs no sticker. */
class TagEmulationService : HostApduService() {
    private val tag = Type4Tag()

    override fun processCommandApdu(commandApdu: ByteArray, extras: Bundle?): ByteArray =
        tag.respond(commandApdu, publishedUrl)

    override fun onDeactivated(reason: Int) = tag.reset()

    companion object {
        /** Set through MainActivity's bridge while the kiosk runs; null keeps the tag silent. */
        @Volatile
        var publishedUrl: String? = null
    }
}
