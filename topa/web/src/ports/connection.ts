/** Where the kiosk keeps its orders: the local API, or the in-browser demo store. */
export interface Connection {
  mode: 'api' | 'demo'
  reachable: boolean
}

export interface ConnectionPort {
  check(): Promise<Connection>
}
