// src/App.jsx
import './App.css'
import './styles/tables.css'
import './styles/role-pages.css'
import { BrowserRouter, Routes, Route } from 'react-router-dom'
import Layout from './pages/TopBar' // acts as layout wrapper
import TeamData from './pages/TeamData'
import QualData from './pages/QualData'
import PitScoutingData from './pages/PitScoutingData'
import StatboticsData from './pages/StatboticsData'
import TBAData from './pages/TBAData'
import Compare from './pages/Compare'
import Settings from './pages/Settings'
import MatchStrategy from './pages/MatchStrategy'
import Rankings from './pages/Rankings'
import Picklist from './pages/Picklist'
import Upload from './pages/Upload'
import TeamAnalysis from './pages/TeamAnalysis'
import AutoPaths from './pages/AutoPaths'
import PrescoutingData from './pages/PrescoutingData'
import Defense from './pages/Defense'
import ShooterFerry from './pages/ShooterFerry'

function App() {
  return (
    <BrowserRouter>
      <Layout>
        <Routes>
          <Route path="/" element={<TeamData />} />
          <Route path="/team-data" element={<TeamData />} />
          <Route path="/qual-data" element={<QualData />} />
          <Route path="/pit-scouting-data" element={<PitScoutingData />} />
          <Route path="/prescouting-data" element={<PrescoutingData />} />
          <Route path="/statbotics-data" element={<StatboticsData />} /> 
          <Route path="/TBA-data" element={<TBAData />} /> 
          <Route path="/compare" element={<Compare />} />
          <Route path="/defense" element={<Defense />} />
          <Route path="/shooter" element={<ShooterFerry />} />
          <Route path="/team-analysis" element={<TeamAnalysis />} />
          <Route path="/match-strategy" element={<MatchStrategy />} />
          <Route path="/rankings" element={<Rankings />} />
          <Route path="/picklist" element={<Picklist />} />
          <Route path="/auto-paths" element={<AutoPaths />} />
          <Route path="/upload" element={<Upload />} />
          <Route path="/settings" element={<Settings />} />
        </Routes>
      </Layout>
    </BrowserRouter>
  )
}

export default App