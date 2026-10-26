/** Whether the backend that keeps the orders answers right now. */
export interface ConnectionPort {
  isReachable(): Promise<boolean>
}
