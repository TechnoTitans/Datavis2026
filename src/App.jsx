// src/App.jsx
import './App.css'
import './styles/tables.css'
import './styles/role-pages.css'
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import AppLayout from './components/AppLayout'
import Data from './pages/Data'
import QualData from './pages/QualData'
import PitScoutingData from './pages/PitScoutingData'
import Settings from './pages/Settings'
import Rankings from './pages/Rankings'
import Upload from './pages/Upload'
import Defense from './pages/Defense'
import Offense from './pages/Offense'

function App() {
  return (
    <BrowserRouter>
      <AppLayout>
        <Routes>
          <Route path="/" element={<Data />} />
          <Route path="/team-data" element={<Data />} />
          <Route path="/qual-data" element={<QualData />} />
          <Route path="/pit-scouting-data" element={<PitScoutingData />} />
          <Route path="/defense" element={<Defense />} />
          <Route path="/shooter" element={<Offense />} />
          <Route path="/rankings" element={<Rankings />} />
          <Route path="/upload" element={<Upload />} />
          <Route path="/settings" element={<Settings />} />
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </AppLayout>
    </BrowserRouter>
  )
}

export default App
