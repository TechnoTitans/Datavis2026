import PropTypes from 'prop-types'
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer
} from 'recharts'
import { MAX_MATCHES, TEAM_COLORS } from '../../../constants/scoring'

/**
 * Base line chart component for team data
 * @param {Object} props - Component props
 * @param {Object} props.chartDataByTeam - Chart data organized by team
 * @param {string[]} props.selectedTeams - Array of selected team numbers
 * @param {string} props.dataKey - Key for the data to display
 * @param {string} props.title - Chart title
 * @param {Function} props.hasDataCheck - Function to check if there's data
 * @param {Function} props.getYDomain - Function to get Y axis domain
 * @param {string} props.noDataMessage - Message when no data
 * @returns {JSX.Element} - Line chart component
 */
const BaseLineChart = ({
  chartDataByTeam,
  selectedTeams,
  dataKey,
  title,
  hasDataCheck,
  getYDomain,
  noDataMessage = "No data for this field."
}) => {
  const hasData = hasDataCheck(chartDataByTeam, selectedTeams, dataKey)
  
  if (!hasData) {
    return <p>{noDataMessage}</p>
  }

  const yDomain = getYDomain ? getYDomain(chartDataByTeam, selectedTeams, dataKey) : [0, 100]

  return (
    <div className="base-line-chart">
      <h3 className="base-line-chart-title">{title}</h3>
      <ResponsiveContainer width="100%" height={250}>
        <LineChart margin={{ top: 20, right: 30, left: 10, bottom: 20 }}>
          <CartesianGrid strokeDasharray="3 3" />
          <XAxis 
            dataKey="match" 
            type="number"
            scale="linear"
            domain={[1, MAX_MATCHES]}
            ticks={Array.from({ length: Math.floor(MAX_MATCHES / 10) + 1 }, (_, i) => (i + 1) * 10).filter(tick => tick <= MAX_MATCHES)}
            label={{ value: "Match", position: "insideBottomLeft", offset: -15, textAnchor: "start", dx: 60 }} 
          />
          <YAxis
            allowDecimals={true}
            domain={yDomain}
          />
          <Tooltip />
          <Legend />
          {selectedTeams.map((team, i) => (
            <Line
              key={team}
              type="monotone"
              dataKey={dataKey}
              name={`Team ${team}`}
              data={chartDataByTeam[team] || []}
              stroke={TEAM_COLORS[i % TEAM_COLORS.length]}
              dot
              connectNulls
            />
          ))}
        </LineChart>
      </ResponsiveContainer>
    </div>
  )
}

BaseLineChart.propTypes = {
  chartDataByTeam: PropTypes.object.isRequired,
  selectedTeams: PropTypes.arrayOf(PropTypes.string).isRequired,
  dataKey: PropTypes.string.isRequired,
  title: PropTypes.string.isRequired,
  hasDataCheck: PropTypes.func.isRequired,
  getYDomain: PropTypes.func,
  noDataMessage: PropTypes.string
}

export default BaseLineChart
