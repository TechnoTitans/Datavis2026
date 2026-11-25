import { useState, useRef, useEffect, useMemo } from 'react'
import { useDataTable } from '../hooks/useAppData.js'
import { subscribeData } from '../utils/backend/data/dataAccessor.js'
import { listScans, saveScan, periodicUpload } from '../utils/backend/data/uploadQueue.js'
import { readScanArchive } from '../utils/backend/indexedDB/matchStorage.js'
import { canEditDatabase } from '../utils/frontend/permissions'
import QrScanner from 'qr-scanner'
import { approveUnconfirmedData, insertUnconfirmedData, rejectUnconfirmedData } from '../utils/backend/data/uploadQueue'
import { scannedDataToCSV, mergeScanRows } from '../utils/frontend/csv.js'
import { parseMatchQr, stripMatchMeta } from '../utils/frontend/matchRecord'
import { MATCH_FIELDS } from '../constants/matchSchema'
import { toast } from 'sonner'

function Upload() {
  const [isScanning, setIsScanning] = useState(false)
  const [parsedData, setParsedData] = useState(null)
  const [message, setMessage] = useState('')
  const [isAuthenticated, setIsAuthenticated] = useState(false)
  const [manualInput, setManualInput] = useState('')
  const { rows: unconfirmedData, error: reviewError } = useDataTable('unconfirmed_data', isAuthenticated)
  const [pendingScans, setPendingScans] = useState([])
  const [legacyScans, setLegacyScans] = useState([])
  const localScannedCSV = useMemo(() => scannedDataToCSV(mergeScanRows(legacyScans, pendingScans.map(entry => entry.row))), [legacyScans, pendingScans])
  const videoRef = useRef(null)
  const qrScannerRef = useRef(null)


  useEffect(() => {
    setIsAuthenticated(canEditDatabase())
    
    const checkPermissions = () => {
      setIsAuthenticated(canEditDatabase())
    }
    
    window.addEventListener('storage', checkPermissions)
    return () => window.removeEventListener('storage', checkPermissions)
  }, [])

  useEffect(() => {
    let active = true
    const load = async () => {
      try {
        const [pending, archive] = await Promise.all([listScans(), readScanArchive()])
        if (active) { setPendingScans(pending); setLegacyScans(archive) }
      } catch (error) { if (active) setMessage(`Unable to read saved scans: ${error.message}`) }
    }
    void load()
    const unsubscribe = subscribeData(key => { if (key === 'pending') void load() })
    return () => { active = false; unsubscribe() }
  }, [])

  useEffect(() => {
    return () => {
      stopScanning()
    }
  }, [])

  const startScanning = async () => {
    try {
      setIsScanning(true)
      setMessage('Starting QR scanner...')
      
      await new Promise(resolve => setTimeout(resolve, 100))
      
      if (!videoRef.current) {
        throw new Error('Video element not available')
      }
      
      if (qrScannerRef.current) {
        qrScannerRef.current.stop()
        qrScannerRef.current.destroy()
        qrScannerRef.current = null
      }
      
      qrScannerRef.current = new QrScanner(
        videoRef.current,
        result => {
          parseQRData(result.data)
          stopScanning()
        },
        {
          onDecodeError: () => {
          },
          preferredCamera: 'environment',
          highlightScanRegion: true,
          highlightCodeOutline: true,
          maxScansPerSecond: 5,
        }
      )
      
      try {
        await qrScannerRef.current.start()
        setMessage('QR scanner active. Point camera at QR code.')
      } catch (startError) {
        if (startError.name === 'NotFoundError' || startError.name === 'OverconstrainedError') {
          qrScannerRef.current.destroy()
          
          qrScannerRef.current = new QrScanner(
            videoRef.current,
            result => {
              parseQRData(result.data)
              stopScanning()
            },
            {
              onDecodeError: () => {
              },
              preferredCamera: 'user',
              highlightScanRegion: true,
              highlightCodeOutline: true,
              maxScansPerSecond: 5,
            }
          )
          
          await qrScannerRef.current.start()
          setMessage('Scanning')
        } else {
          throw startError
        }
      }
      
    } catch (error) {
      console.error('Error starting QR scanner:', error)
      let errorMessage = 'Error starting QR scanner: '
      
      if (error.name === 'NotAllowedError') {
        errorMessage += 'Camera permission denied. Please allow camera access and try again.'
      } else if (error.name === 'NotFoundError') {
        errorMessage += 'No camera found. Please check your camera connection.'
      } else if (error.name === 'NotSupportedError') {
        errorMessage += 'Camera not supported in this browser. Try Chrome, Firefox, or Safari.'
      } else if (error.name === 'NotReadableError') {
        errorMessage += 'Camera is already in use by another application.'
      } else {
        errorMessage += error.message
      }
      
      setMessage(errorMessage + ' - Use manual input.')
      setIsScanning(false)
      
      if (qrScannerRef.current) {
        qrScannerRef.current.destroy()
        qrScannerRef.current = null
      }
    }
  }

  const stopScanning = () => {
    setIsScanning(false)
    
    if (qrScannerRef.current) {
      try {
        qrScannerRef.current.stop()
        qrScannerRef.current.destroy()
      } catch (error) {
        console.error('Error stopping QR scanner:', error)
      }
      qrScannerRef.current = null
    }
    
    setMessage('')
  }

  const handleManualInput = () => {
    if (manualInput.trim()) {
      parseQRData(manualInput.trim())
      setManualInput('')
    }
  }

  const parseQRData = async (qrText) => {
    try {
      const data = parseMatchQr(qrText)
      await saveScan(stripMatchMeta(data))
      setParsedData(data)
      setMessage('Scan saved on this device. Uploads retry every 30 seconds when online.')
      return data
    } catch (error) {
      console.error('Error parsing QR data:', error)
      setMessage('Error parsing QR code: ' + error.message)
      setParsedData(null)
    }
  }

  const uploadToUnconfirmed = async () => {
    if (!parsedData) {
      setMessage('No data to upload - please scan or parse QR code first')
      toast.message('Nothing to upload', { description: 'Scan a QR code or paste data first.' })
      return
    }

    try {
      const dataToInsert = stripMatchMeta(parsedData)

      const result = await insertUnconfirmedData(dataToInsert)
      if (result?.error) throw result.error

      setMessage(result.queued ? 'Saved offline! Will sync when online.' : 'Data uploaded successfully to unconfirmed_data!')
      if (result.queued) {
        toast.message('Saved offline', { description: 'Will sync when online.' })
      } else {
        toast.success('Uploaded', { description: 'Added to unconfirmed data.' })
      }
      setParsedData(null)
      
    } catch (error) {
      console.error('Error uploading data:', error)
      setMessage('Error uploading data: ' + error.message)
      toast.error('Upload failed', { description: error.message })
    }
  }

  const approveData = async (unconfirmedItem) => {
    try {
      const result = await approveUnconfirmedData(stripMatchMeta(unconfirmedItem))
      if (result?.error) throw result.error

      setMessage(
        result.queued
          ? `Approval queued for ${unconfirmedItem['Scouting ID']} (will sync when online)`
          : `Approved data for ${unconfirmedItem['Scouting ID']}`,
      )
      if (result.queued) {
        toast.message('Approval queued', { description: unconfirmedItem['Scouting ID'] })
      } else {
        toast.success('Approved', { description: unconfirmedItem['Scouting ID'] })
      }

    } catch (error) {
      console.error('Error approving data:', error)
      setMessage('Error approving data: ' + error.message)
      toast.error('Approve failed', { description: error.message })
    }
  }

  const rejectData = async (unconfirmedItem) => {
    try {
      const result = await rejectUnconfirmedData(unconfirmedItem['Scouting ID'])
      if (result?.error) throw result.error

      setMessage(
        result.queued
          ? `Rejection queued for ${unconfirmedItem['Scouting ID']} (will sync when online)`
          : `Rejected data for ${unconfirmedItem['Scouting ID']}`,
      )
      if (result.queued) {
        toast.message('Rejection queued', { description: unconfirmedItem['Scouting ID'] })
      } else {
        toast.success('Rejected', { description: unconfirmedItem['Scouting ID'] })
      }

    } catch (error) {
      console.error('Error rejecting data:', error)
      setMessage('Error rejecting data: ' + error.message)
      toast.error('Reject failed', { description: error.message })
    }
  }

  return (
    <div className="upload-container">
      <section className="mb-4" aria-label="Pending uploads">
        <p role="status">{pendingScans.length} scan(s) waiting to upload.</p>
        {reviewError && <p role="alert">{reviewError}</p>}
        <button type="button" disabled={!pendingScans.length} onClick={() => {
          periodicUpload().ready.catch(error => setMessage(error.message))
        }}>Upload pending scans</button>
        {pendingScans.filter(entry => entry.lastError).map(entry => (
          <p key={entry.scoutingId} role="status">{entry.scoutingId}: {entry.lastError} — will retry.</p>
        ))}
      </section>
      <h2>Upload</h2>
      
      {/* QR Scanner Section */}
      <div className="upload-section">
        <h3>QR Code Scanner</h3>
        
        {/* Camera Scanner */}
        <div className="camera-section">
          <div className="camera-button-wrapper">
            <button 
              onClick={isScanning ? stopScanning : startScanning}
              className={`camera-button ${isScanning ? 'stop' : 'start'}`}
            >
              {isScanning ? 'Stop Camera' : 'Start Camera'}
            </button>
          </div>

          {isScanning && (
            <div className="video-container">
              <video
                ref={videoRef}
                autoPlay
                playsInline
                muted
              />
            </div>
          )}
        </div>

        {/* Manual Input */}
        <div className="manual-input-section">
          <h4>Manual QR Data Input</h4>
          <textarea
            value={manualInput}
            onChange={(e) => setManualInput(e.target.value)}
            className="manual-input-textarea"
          />
          <button 
            onClick={handleManualInput}
            disabled={!manualInput.trim()}
            className={`parse-button ${manualInput.trim() ? 'enabled' : 'disabled'}`}
          >
            Parse QR Data
          </button>
        </div>

        {message && (
          <div className={`message ${message.includes('Error') ? 'error' : 'success'}`}>
            {message}
          </div>
        )}

        {parsedData && (
          <div className="parsed-data-container">
            <h4>Parsed QR Data:</h4>
            <p><strong>Team:</strong> {parsedData._teamNumber}</p>
            <p><strong>Match:</strong> {parsedData._matchNumber}</p>
            <p><strong>Scouting ID:</strong> {parsedData['Scouting ID']}</p>
            {MATCH_FIELDS.map(field => (
              <p key={field.key}>
                <strong>{field.key}:</strong> {parsedData[field.key] == null ? 'null' : String(parsedData[field.key])}
              </p>
            ))}
            
            {parsedData['No Show'] !== undefined && <p><strong>No Show:</strong> {String(parsedData['No Show'])}</p>}
            <button 
              onClick={uploadToUnconfirmed}
              className="upload-button"
            >
              Upload
            </button>
          </div>
        )}
      </div>

      {isAuthenticated && (
        <div>
          <h3>Unconfirmed Data Management</h3>
          <p>Review and approve scanned data below:</p>
          
          {unconfirmedData.length === 0 ? (
            <p>No unconfirmed data found.</p>
          ) : (
            <div className="unconfirmed-data-container">
              {unconfirmedData.map((item) => (
                <div 
                  key={item['Scouting ID']} 
                  className="unconfirmed-item"
                >
                  <h4>{item['Scouting ID']}</h4>
                  <p><strong>Team:</strong> {item['Scouting ID']?.split('_')[1]} | <strong>Match:</strong> {item['Scouting ID']?.split('_')[2]}</p>
                  <p><strong>Scouter:</strong> {item['Scouter Name']} | <strong>Position:</strong> {item['Position']}</p>
                  <p><strong>Notes:</strong> {item['Notes']}</p>
                  
                  <div className="unconfirmed-item-actions">
                    <button 
                      onClick={() => approveData(item)}
                      className="approve-button"
                    >
                      Approve
                    </button>
                    <button 
                      onClick={() => rejectData(item)}
                      className="reject-button"
                    >
                      Reject
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}

          {localScannedCSV && (
            <div className="scanned-csv-preview">
              <h4>Local Scanned Data (CSV Format)</h4>
              <p className="csv-info">Scans saved on this device, shown in CSV format.</p>
              <pre className="csv-display">
                {localScannedCSV}
              </pre>
            </div>
          )}
        </div>
      )}
    </div>
  )
}

export default Upload
