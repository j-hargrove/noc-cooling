import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { App } from './App'
import { applyEmbedRoot, embedTheme, isEmbed } from './demo/embed'
import { StatesPage } from './states/StatesPage'

// Manual routing: the project has no router yet, and only needs two pages
// (the product, and the /states verification page). See vercel.json for
// the SPA rewrite that makes /states resolve in production.
const embed = isEmbed(window.location.search)
// Before first render, so an embed never paints its own page ground (src/demo/embed.css).
if (embed) applyEmbedRoot(document.documentElement, embedTheme(window.location.search))

const page = window.location.pathname === '/states' ? <StatesPage /> : <App embed={embed} />

createRoot(document.getElementById('root')!).render(
  <StrictMode>{page}</StrictMode>,
)
