import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'

// Placeholder shell. Real regions land after the contract is approved
// (see docs/BUILD_BRIEF.md, "Order of work").
function App() {
  return <div id="app-shell">NOC cooling alert — scaffold</div>
}

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
)
