import './index.css'

import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'

import { App } from './App'
import { createAdapters } from './composition'

const adapters = createAdapters(import.meta.env.VITE_API_URL)

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App adapters={adapters} />
  </StrictMode>,
)
