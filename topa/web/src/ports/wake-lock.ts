/** Keeps the screen on while the customer waits: a locked phone neither checks its order nor buzzes. */
export interface WakeLockPort {
  /** Holds the screen on until the returned function lets go. */
  hold(): () => void
}
