import './index.css'

import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'

import { App } from './App'
import { createAdapters, detectRuntime, isPhoneApp, setTotem } from './composition'

const runtime = detectRuntime()
const adapters = createAdapters(import.meta.env.VITE_API_URL, runtime)

function switchRole(totem: boolean) {
  setTotem(totem)
  window.location.reload()
}

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App
      adapters={adapters}
      phone={isPhoneApp(runtime)}
      onUseAsTotem={() => switchRole(true)}
      onLeaveTotem={runtime.totem ? () => switchRole(false) : undefined}
    />
  </StrictMode>,
)
