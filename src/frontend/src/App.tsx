import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import { Suspense } from 'react'

// Pages wired in Sprint 3b — stubs added as each is built
function App() {
  return (
    <BrowserRouter>
      <Suspense fallback={<div className="flex h-screen items-center justify-center text-muted-foreground">Loading…</div>}>
        <Routes>
          <Route path="/" element={<Navigate to="/login" replace />} />
          {/* Sprint 3b routes added here */}
        </Routes>
      </Suspense>
    </BrowserRouter>
  )
}

export default App
