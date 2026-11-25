function StatRangeChart({ data, fieldName }) {
  if (!data || data.length === 0) {
    return <p className="no-table-data">No data available</p>
  }

  return (
    <div className="stat-range-table-container">
      <table className="stat-range-table">
        <thead>
          <tr>
            <th>Field</th>
            <th>Average</th>
            <th>Minimum</th>
            <th>Maximum</th>
          </tr>
        </thead>
        <tbody>
          {data.map((row, index) => (
            <tr key={index}>
              <td className="field-name">{row.field}</td>
              <td className="stat-value">{typeof row.avg === 'number' ? row.avg.toFixed(2) : row.avg}</td>
              <td className="stat-value">{typeof row.min === 'number' ? row.min.toFixed(2) : row.min}</td>
              <td className="stat-value">{typeof row.max === 'number' ? row.max.toFixed(2) : row.max}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}

export default StatRangeChart