import '../../styles/archived/page-styles.css'
import TeamSelector from '../../components/TeamSelector'
import Loading from '../../components/Loading'
import { useTeamData } from '../../hooks/useScoutingData.js'
import { useSelectedTeams } from '../../hooks/usePreferences.js'
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from 'recharts'

function TeamAnalysis() {
  const [selectedTeams, setSelectedTeams] = useSelectedTeams('selectedTeamsAnalysis', [])
  const safeSelectedTeams = Array.isArray(selectedTeams) ? selectedTeams : []
  
  const dummyTeams = safeSelectedTeams.length > 0 ? safeSelectedTeams : ['0']
  const { allTeams, matchRows: allMatchRows, loading, error } = useTeamData(dummyTeams, true)
  
  const matchRows = safeSelectedTeams.length > 0 
    ? allMatchRows.filter(row => safeSelectedTeams.includes(Number(row['Scouting ID'].split('_')[1])))
    : allMatchRows

  const handleTeamToggle = (team) => {
    const teamNum = Number(team);
    if (safeSelectedTeams.includes(teamNum)) {
      setSelectedTeams([])
    } else {
      setSelectedTeams([teamNum]);
    }
  }

  const clearAllTeams = () => {
    setSelectedTeams([])
  }

  const renderHeatMap = () => {
    if (!safeSelectedTeams.length) {
      return null
    }

    const frequencyMap = {}

    matchRows.forEach(row => {
      const shotCoordinates = row['Shot Coordinates']

      if (shotCoordinates) {
        const coordinates = shotCoordinates.split(';').filter(coord => coord.trim() !== '')
        coordinates.forEach(coord => {
          if (!frequencyMap[coord]) {
            frequencyMap[coord] = 0
          }
          frequencyMap[coord] += 1
        })
      }
    })

    if (Object.keys(frequencyMap).length === 0) {
      return null
    }

    const maxFrequency = Math.max(...Object.values(frequencyMap))

    const marginX = 12;
    const marginY = 0;
    const gridWidth = 830;
    const gridHeight = 810;
    const cellWidth = gridWidth / 8;
    const cellHeight = gridHeight / 8;

    const gradients = [];
    const circles = Object.entries(frequencyMap).map(([coord, freq], idx) => {
      let [x, y] = coord.split(',').map(Number);
      if (isNaN(x) || isNaN(y)) return null;
      x = Math.min(x, 7);
      y = Math.min(y, 7);
      const normalizedFreq = freq / maxFrequency;
      const radius = 15 + normalizedFreq * 35;
      const gradId = `circle-gradient-${idx}`;
      gradients.push(
        <radialGradient key={gradId} id={gradId} cx="50%" cy="50%" r="50%">
          <stop offset="0%" stopColor="rgba(0,255,0,1)" stopOpacity={0.8 + normalizedFreq * 0.2} />
          <stop offset="100%" stopColor="rgba(0,255,0,0.1)" stopOpacity={0.1} />
        </radialGradient>
      );
      return (
        <circle
          key={coord}
          cx={marginX + x * cellWidth}
          cy={marginY + y * cellHeight}
          r={radius}
          fill={`url(#${gradId})`}
        />
      );
    })

    return [
      <defs key="heatmap-defs">{gradients}</defs>,
      ...circles,
    ];
  }

  if (loading) return <Loading />
  if (error) return <p role="alert">{error}</p>

  return (
    <div>
      <div style={{ marginBottom: '16px', textAlign: 'center' }}>
      </div>
      <div className="auto-paths-container">
        <h1>Scoring Locations</h1>

        <TeamSelector
          allTeams={allTeams || []}
          selectedTeams={safeSelectedTeams}
          onTeamToggle={handleTeamToggle}
          onClearAll={clearAllTeams}
          title="Select Team"
        />

        <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', minHeight: '800px' }}>
          <div style={{ position: 'relative', width: '800px', height: '800px' }}>
            <img src="/rebuiltauton.png" alt="Background" style={{ width: '100%', height: '100%' }} />
            <svg
              style={{ position: 'absolute', top: 0, left: 0, width: '100%', height: '100%' }}
              viewBox="0 0 800 800"
            >
              {renderHeatMap()}
            </svg>
          </div>
        </div>
      </div>
    </div>
  )
}

export default TeamAnalysis
