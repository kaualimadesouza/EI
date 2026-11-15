import { useEffect, useRef } from 'react'

import { CloseIcon } from '../icons'
import styles from './LandingPage.module.css'

export function VideoDialog({ onClose }: { onClose: () => void }) {
  const ref = useRef<HTMLDialogElement>(null)

  useEffect(() => {
    const dialog = ref.current!
    dialog.showModal()
    return () => dialog.close()
  }, [])

  return (
    <dialog
      ref={ref}
      className={styles.videoDialog}
      aria-label="Veja o TOPA em 30 segundos"
      onCancel={onClose}
    >
      <div className={styles.videoDialogHead}>
        <p>Veja o TOPA em 30 segundos</p>
        <button type="button" aria-label="Fechar vídeo" onClick={onClose}>
          <CloseIcon size={22} />
        </button>
      </div>
      <video
        controls
        playsInline
        autoPlay
        preload="metadata"
        aria-label="Demonstração do TOPA"
        poster={`${import.meta.env.BASE_URL}landing/video-poster.webp`}
      >
        <source
          src={`${import.meta.env.BASE_URL}landing/topa-vertical-v2.mp4`}
          media="(max-width: 600px)"
          type="video/mp4"
        />
        <source src={`${import.meta.env.BASE_URL}landing/topa-horizontal-v2.mp4`} type="video/mp4" />
      </video>
    </dialog>
  )
}
