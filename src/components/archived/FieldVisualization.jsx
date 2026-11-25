import PropTypes from 'prop-types'

/**
 * Field visualization component for auto paths
 * @param {Object} props - Component props
 * @param {string} props.autoPath - Auto path string to visualize
 * @returns {JSX.Element} - Field visualization component
 */
const FieldVisualization = ({ autoPath }) => {
  const allianceColor = '#2563eb'

  // Position mapping based on your SVG coordinates (clockwise from top-left)
  const positions = {
    'A': { x: 727, y: 761 },   // A/B pair - left
    'B': { x: 727, y: 761 },   // Same as A
    'C': { x: 847, y: 553 },   // C/D pair - top-left
    'D': { x: 847, y: 553 },   // Same as C
    'E': { x: 1087, y: 553 },  // E/F pair - top-right
    'F': { x: 1087, y: 553 },  // Same as E
    'G': { x: 1207, y: 761 },  // G/H pair - right
    'H': { x: 1207, y: 761 },  // Same as G
    'I': { x: 1087, y: 969 },  // I/J pair - bottom-right
    'J': { x: 1087, y: 969 },  // Same as I
    'K': { x: 847, y: 969 },   // K/L pair - bottom-left
    'L': { x: 847, y: 969 }    // Same as K
  }

  // CS station positions (from your diagonal rectangles)
  const csPositions = {
    'CS1': { x: 200, y: 1300 },
    'CS2': { x: 200, y: 300 }
  }

  // Net center position
  const netCenter = { x: 1620, y: 794 }

  // Parse auto path to get movement sequence
  const parsePathSequence = (path) => {
    if (!path || path.length === 0) return []
    
    const positionOrders = [netCenter] // Start from net center
    let cleanPath = path.replace(/LEAVE\s?/g, '')
    
    let i = 0
    while (i < cleanPath.length) {
      // Check for CS stations first
      if (cleanPath[i] === 'C' && i + 1 < cleanPath.length && cleanPath[i + 1] === 'S' && 
          i + 2 < cleanPath.length && (cleanPath[i + 2] === '1' || cleanPath[i + 2] === '2')) {
        const csStation = 'CS' + cleanPath[i + 2]
        positionOrders.push(csPositions[csStation])
        i += 3
      }
      // Check for position + level + optional miss
      else if (cleanPath[i] >= 'A' && cleanPath[i] <= 'L' && i + 1 < cleanPath.length && cleanPath[i + 1] >= '1' && cleanPath[i + 1] <= '4') {
        const pos = cleanPath[i]
        const missed = i + 2 < cleanPath.length && cleanPath[i + 2] === 'M'
        
        if (positions[pos]) {
          positionOrders.push(positions[pos])
        }
        
        i += missed ? 3 : 2
      }
      // Check for Net scoring
      else if (cleanPath[i] === 'N') {
        const missed = i + 1 < cleanPath.length && cleanPath[i + 1] === 'M'
        positionOrders.push(netCenter)
        i += missed ? 2 : 1
      }
      // Skip processor since it's not used in auto
      else if (cleanPath[i] === 'P') {
        const missed = i + 1 < cleanPath.length && cleanPath[i + 1] === 'M'
        i += missed ? 2 : 1
      }
      // Skip Q stations for now
      else if (cleanPath[i] === 'Q' && i + 1 < cleanPath.length && cleanPath[i + 1] >= '1' && cleanPath[i + 1] <= '3') {
        i += 2
      }
      // Skip random S letters (not part of CS)
      else if (cleanPath[i] === 'S') {
        i++
      }
      else {
        i++
      }
    }
    
    return positionOrders
  }

  const positionOrders = parsePathSequence(autoPath)

  // Create gradients array for subgradient steps (do not use it yet)
  const gradients = []
  for (let i = 0; i < positionOrders.length; i++) {
    const t = i / (positionOrders.length - 1)
    const r = Math.round(255 * t)
    const g = Math.round(255 * (1 - t))
    gradients.push(`rgb(${r},${g},0)`)
  }

  return (
    <div className="field-visualization">
      <div className="field-visualization-canvas">
        <svg width="800" height="500" viewBox="0 0 1733 1589" className="field-visualization-svg">
          <defs>
            {/* Arrow marker definition */}
            <marker
              id="arrowhead"
              markerWidth="6"
              markerHeight="4"
              refX="5"
              refY="2"
              orient="auto"
            >
              <polygon
                points="0 0, 6 2, 0 4"
                fill={allianceColor}
              />
            </marker>
          </defs>

          {/* Your exact SVG - nothing moved */}
          <rect width="1733" height="1588" fill="#343434"/>
          <path d="M967 426L1257.12 593.5V928.5L967 1096L676.882 928.5V593.5L967 426Z" fill="#D9D9D9"/>
          <circle cx="345" cy="761" r="65" fill="#06D265"/>
          <circle cx="345" cy="1139" r="65" fill="#06D265"/>
          <circle cx="345" cy="384" r="65" fill="#06D265"/>
          <rect x="1507" width="226" height="1588" fill="#D9D9D9"/>
          <rect y="258.109" width="450" height="72" transform="rotate(-35 0 258.109)" fill="#D9D9D9"/>
          <rect width="450" height="72" transform="matrix(0.819152 0.573576 0.573576 -0.819152 0 1329.98)" fill="#D9D9D9"/>
          <circle cx="1207" cy="761" r="50" fill="#777777"/>
          <circle cx="1087" cy="553" r="50" fill="#777777"/>
          <circle cx="847" cy="969" r="50" fill="#777777"/>
          <circle cx="1087" cy="969" r="50" fill="#777777"/>
          <circle cx="847" cy="553" r="50" fill="#777777"/>
          <circle cx="727" cy="761" r="50" fill="#777777"/>

          {/* Position labels - clockwise starting from left */}
          <text x="727" y="771" textAnchor="middle" fontSize="24" fontWeight="bold" fill="white">1</text>
          <text x="847" y="563" textAnchor="middle" fontSize="24" fontWeight="bold" fill="white">2</text>
          <text x="1087" y="563" textAnchor="middle" fontSize="24" fontWeight="bold" fill="white">3</text>
          <text x="1207" y="771" textAnchor="middle" fontSize="24" fontWeight="bold" fill="white">4</text>
          <text x="1087" y="979" textAnchor="middle" fontSize="24" fontWeight="bold" fill="white">5</text>
          <text x="847" y="979" textAnchor="middle" fontSize="24" fontWeight="bold" fill="white">6</text>

          {/* Draw arrows from position to position */}
          {positionOrders.map((position, index) => {
            if (index === 0) return null // Skip first position (no arrow to draw)
            
            const prevPosition = positionOrders[index - 1]
            
            // Check if this path has been used before
            const pathKey = `${prevPosition.x},${prevPosition.y}-${position.x},${position.y}`
            const reversePathKey = `${position.x},${position.y}-${prevPosition.x},${prevPosition.y}`
            
            let pathsUsed = 0
            for (let j = 1; j < index; j++) {
              const checkPrev = positionOrders[j - 1]
              const checkCurrent = positionOrders[j]
              const checkPath = `${checkPrev.x},${checkPrev.y}-${checkCurrent.x},${checkCurrent.y}`
              const checkReverse = `${checkCurrent.x},${checkCurrent.y}-${checkPrev.x},${checkPrev.y}`
              
              if (checkPath === pathKey || checkReverse === pathKey || 
                  checkPath === reversePathKey || checkReverse === reversePathKey) {
                pathsUsed++
              }
            }
            
            // Color is driven by the per-segment gradient.

            // Always use a valid gradient index for arrows
            // const gradientIndex = index - 1

            return (
              <g key={`seg-${index}`}>
                <linearGradient
                  id={`arrowGradient-${index}`}
                  x1={prevPosition.x}
                  y1={prevPosition.y}
                  x2={position.x}
                  y2={position.y}
                  gradientUnits="userSpaceOnUse"
                >
                  <stop offset="0%" stopColor={gradients[index - 1]} />
                  <stop offset="100%" stopColor={gradients[index]} />
                </linearGradient>
                {pathsUsed === 0 ? (
                  <line
                    key={`arrow-${index}`}
                    x1={prevPosition.x}
                    y1={prevPosition.y}
                    x2={position.x}
                    y2={position.y}
                    stroke={`url(#arrowGradient-${index})`}
                    strokeWidth="15"
                    markerEnd="url(#arrowhead)"
                    opacity="0.9"
                  />
                ) : (
                  (() => {
                    const midX = (prevPosition.x + position.x) / 2
                    const midY = (prevPosition.y + position.y) / 2
                    
                    // Calculate perpendicular offset
                    const dx = position.x - prevPosition.x
                    const dy = position.y - prevPosition.y
                    const length = Math.sqrt(dx * dx + dy * dy)
                    
                    // Normalize and create perpendicular vector
                    const perpX = -dy / length
                    const perpY = dx / length
                    
                    // Offset amount based on how many times this path has been used
                    const offset = (pathsUsed + 1) * 50
                    
                    const controlX = midX + perpX * offset
                    const controlY = midY + perpY * offset
                    
                    const pathData = `M ${prevPosition.x} ${prevPosition.y} Q ${controlX} ${controlY} ${position.x} ${position.y}`
                    
                    return (
                      <path
                        key={`arrow-${index}`}
                        d={pathData}
                        stroke={`url(#arrowGradient-${index})`}
                        strokeWidth="15"
                        fill="none"
                        markerEnd="url(#arrowhead)"
                        opacity="0.9"
                      />
                    )
                  })()
                )}
              </g>
            )
          })}
        </svg>
      </div>
      
      <div className="field-visualization-caption">
        <strong className="field-visualization-caption-label">Auto Path:</strong> {autoPath || 'No path data'}
      </div>
    </div>
  )
}

FieldVisualization.propTypes = {
  autoPath: PropTypes.string.isRequired
}

export default FieldVisualization
