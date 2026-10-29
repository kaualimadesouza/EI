import './index.css'

import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'

import { App } from './App'
import { createAdapters, detectRuntime, isPhoneApp, roleSwitch } from './composition'

const runtime = detectRuntime()
const adapters = createAdapters(import.meta.env.VITE_API_URL, runtime)

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App
      adapters={adapters}
      phone={isPhoneApp(runtime)}
      storeRole={runtime.storeRole}
      onSwitchRole={roleSwitch(runtime, () => window.location.reload())}
    />
  </StrictMode>,
)
