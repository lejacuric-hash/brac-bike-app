import { BrowserRouter, Routes, Route } from 'react-router-dom'
import Navigation from './components/Navigation'
import HomePage from './pages/HomePage'
import TrailsPage from './pages/TrailsPage'
import PlanRoutePage from './pages/PlanRoutePage'
import TipsPage from './pages/TipsPage'
import BookPage from './pages/BookPage'

function App() {
  return (
    <BrowserRouter>
      <Navigation />
      <main className="app-main" style={{ paddingBottom: '72px' }}>
        <Routes>
          <Route path="/" element={<HomePage />} />
          <Route path="/trails" element={<TrailsPage />} />
          <Route path="/plan" element={<PlanRoutePage />} />
          <Route path="/tips" element={<TipsPage />} />
          <Route path="/book" element={<BookPage />} />
        </Routes>
      </main>
    </BrowserRouter>
  )
}

export default App