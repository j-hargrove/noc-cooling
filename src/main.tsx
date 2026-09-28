import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { App } from './App'
import { StatesPage } from './states/StatesPage'

// Manual routing: the project has no router yet, and only needs two pages
// (the product, and the /states verification page). See vercel.json for
// the SPA rewrite that makes /states resolve in production.
const page = window.location.pathname === '/states' ? <StatesPage /> : <App />

createRoot(document.getElementById('root')!).render(
  <StrictMode>{page}</StrictMode>,
)
