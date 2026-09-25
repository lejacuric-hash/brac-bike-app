import { BrowserRouter, Routes, Route } from 'react-router-dom'
import { RideProvider } from './contexts/RideContext'
import Navigation from './components/Navigation'
import FirstLaunchModal from './components/FirstLaunchModal'
import HomePage from './pages/HomePage'
import TrailsPage from './pages/TrailsPage'
import PlanRoutePage from './pages/PlanRoutePage'
import TipsPage from './pages/TipsPage'
import BookPage from './pages/BookPage'
import GameHubPage from './game/pages/GameHubPage'
import GamePage from './game/pages/GamePage'
import StopPage from './game/pages/StopPage'
import LeaderboardPage from './game/pages/LeaderboardPage'
import AdminPage from './game/pages/AdminPage'
import GameMapPage from './game/pages/GameMapPage'
import FinalePage from './game/pages/FinalePage'
import DeepLinkHandler from './game/DeepLinkHandler'

function App() {
  return (
    <RideProvider>
      <BrowserRouter>
        <FirstLaunchModal />
        <DeepLinkHandler />
        <Navigation />
        <main className="app-main">
          <Routes>
            <Route path="/" element={<HomePage />} />
            <Route path="/trails" element={<TrailsPage />} />
            <Route path="/plan" element={<PlanRoutePage />} />
            <Route path="/tips" element={<TipsPage />} />
            <Route path="/book" element={<BookPage />} />
            <Route path="/game" element={<GameHubPage />} />
            <Route path="/game/leaderboard" element={<LeaderboardPage />} />
            <Route path="/game/admin" element={<AdminPage />} />
            <Route path="/game/finale" element={<FinalePage />} />
            <Route path="/game/stop/:stopId" element={<StopPage />} />
            <Route path="/game/stop/:stopId/map" element={<GameMapPage />} />
            <Route path="/game/:gameId" element={<GamePage />} />
          </Routes>
        </main>
      </BrowserRouter>
    </RideProvider>
  )
}

export default App