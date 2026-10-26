import { HttpClient } from './adapters/http/http-client'
import { HttpConnection } from './adapters/http/http-connection'
import { HttpMenu } from './adapters/http/http-menu'
import { HttpOrders } from './adapters/http/http-orders'
import { LocalConnection } from './adapters/local/local-connection'
import { LocalMenu } from './adapters/local/local-menu'
import { LocalOrders } from './adapters/local/local-orders'
import type { Adapters } from './ports/adapters'

/** The only place that picks adapters: an API URL means the local backend, none means demo mode. */
export function createAdapters(apiUrl: string | undefined): Adapters {
  if (apiUrl) {
    const client = new HttpClient(apiUrl)
    return {
      mode: 'api',
      connection: new HttpConnection(apiUrl),
      menu: new HttpMenu(client),
      orders: new HttpOrders(client),
    }
  }
  const menu = new LocalMenu()
  return { mode: 'demo', connection: new LocalConnection(), menu, orders: new LocalOrders(menu) }
}
