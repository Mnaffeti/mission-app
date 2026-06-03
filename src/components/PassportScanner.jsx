import { useState, useRef, useCallback } from 'react'

/* ════════════════════════════════════════════════════════════
   API CONFIG  — change the URL if the Flask server runs
   on a different host / port.
════════════════════════════════════════════════════════════ */
const PASSPORT_API_URL = 'http://localhost:5000/detect'

// ── Helpers ──────────────────────────────────────────────────
function fmtBytes(n) {
  if (n < 1024)    return n + ' B'
  if (n < 1048576) return (n / 1024).toFixed(1) + ' KB'
  return (n / 1048576).toFixed(1) + ' MB'
}

function fileToBase64(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onload  = () => resolve(reader.result.split(',')[1]) // strip "data:…;base64,"
    reader.onerror = reject
    reader.readAsDataURL(file)
  })
}

// ── API call ─────────────────────────────────────────────────
async function callPassportAPI(file) {
  // ── 1. File info ───────────────────────────────────────────
  console.group('[PassportAPI] callPassportAPI()')
  console.log('File:', { name: file.name, type: file.type, size: fmtBytes(file.size) })

  // ── 2. Base64 encode ───────────────────────────────────────
  let base64
  try {
    base64 = await fileToBase64(file)
    console.log('Base64 encoded — length:', base64.length, '| preview:', base64.slice(0, 40) + '…')
  } catch (e) {
    console.error('FileReader failed:', e)
    console.groupEnd()
    throw new Error('Could not read the selected file.')
  }

  // ── 3. HTTP request ────────────────────────────────────────
  console.log('POST →', PASSPORT_API_URL)
  let response
  try {
    response = await fetch(PASSPORT_API_URL, {
      method:  'POST',
      headers: { 'Content-Type': 'application/json' },
      body:    JSON.stringify({ image: base64 }),
    })
  } catch (e) {
    console.error('Network error (is the Flask server running?):', e)
    console.groupEnd()
    throw new Error(
      'Cannot reach the passport API. Make sure the Flask server is running:\n  python passport-detection/app.py'
    )
  }

  console.log('Response status:', response.status, response.statusText)

  // ── 4. Non-2xx ─────────────────────────────────────────────
  if (!response.ok) {
    const err = await response.json().catch(() => ({}))
    console.error('Server returned error body:', err)
    console.groupEnd()
    throw new Error(err.error || `Server error ${response.status}`)
  }

  // ── 5. Full raw response ───────────────────────────────────
  const data = await response.json()
  console.log('Raw API response:', data)
  console.log('has_passport:', data.has_passport)
  console.log('confidence:', data.confidence)
  console.log('person_info:', data.person_info)
  console.log('ocr_fields:', data.ocr_fields)
  console.log('mrz_fields:', data.mrz_fields)
  console.log('stage1_detections:', data.stage1_detections)

  // ── Not a passport ─────────────────────────────────────────
  if (!data.has_passport) {
    const mapped = {
      isValid:     false,
      message:     data.message || 'No passport detected in this image.',
      confidence:  0,
      stage1Image: data.stage1_image ?? null,
      mrzImage:    null,
    }
    console.log('Mapped result (not a passport):', mapped)
    console.groupEnd()
    return mapped
  }

  // ── Passport found ─────────────────────────────────────────
  const pi = data.person_info ?? {}
  console.log('person_info keys:', Object.keys(pi))

  const mapped = {
    isValid:        true,
    confidence:     data.confidence ?? 0,
    givenNames:     pi.given_names                              || '—',
    surname:        pi.surname                                  || '—',
    nationality:    pi.nationality                              || '—',
    sex:            pi.sex                                      || '—',
    dateOfBirth:    pi.date_of_birth_visual   ?? pi.date_of_birth   ?? '—',
    expiryDate:     pi.expiry_date                              || '—',
    passportNumber: pi.passport_number_visual ?? pi.passport_number ?? '—',
    issuingCountry: pi.issuing_country                          || '—',
    stage1Image:    data.stage1_image ?? null,
    mrzImage:       data.mrz_image    ?? null,
  }

  console.log('Mapped result:', mapped)
  console.groupEnd()
  return mapped
}

// ── Icons ─────────────────────────────────────────────────────
const CheckIcon = () => (
  <svg width="16" height="16" viewBox="0 0 24 24" fill="none"
       stroke="#34c759" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
    <polyline points="20 6 9 17 4 12" />
  </svg>
)
const CrossIcon = () => (
  <svg width="16" height="16" viewBox="0 0 24 24" fill="none"
       stroke="#ff453a" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
    <line x1="18" y1="6" x2="6" y2="18" /><line x1="6" y1="6" x2="18" y2="18" />
  </svg>
)

// ── Component ─────────────────────────────────────────────────
export default function PassportScanner() {
  const [file,     setFile]     = useState(null)
  const [preview,  setPreview]  = useState(null)
  const [dragover, setDragover] = useState(false)
  const [loading,  setLoading]  = useState(false)
  const [result,   setResult]   = useState(null)
  const [apiError, setApiError] = useState(null)
  const inputRef = useRef(null)

  const handleFile = useCallback(f => {
    if (!f) return
    setFile(f)
    setResult(null)
    setApiError(null)
    if (f.type.startsWith('image/')) {
      const reader = new FileReader()
      reader.onload = ev => setPreview(ev.target.result)
      reader.readAsDataURL(f)
    } else {
      setPreview(null)
    }
  }, [])

  function clearFile() {
    setFile(null); setPreview(null)
    setResult(null); setApiError(null)
    if (inputRef.current) inputRef.current.value = ''
  }

  async function validate() {
    if (!file) return
    setLoading(true); setResult(null); setApiError(null)
    try {
      setResult(await callPassportAPI(file))
    } catch (err) {
      setApiError(err.message)
    } finally {
      setLoading(false)
    }
  }

  // ── Fields to render when passport is found ─────────────────
  const fields = result?.isValid ? [
    { label: 'Given Names',     value: result.givenNames     },
    { label: 'Surname',         value: result.surname        },
    { label: 'Nationality',     value: result.nationality    },
    { label: 'Sex',             value: result.sex            },
    { label: 'Date of Birth',   value: result.dateOfBirth    },
    { label: 'Expiry Date',     value: result.expiryDate     },
    { label: 'Passport Number', value: result.passportNumber },
    { label: 'Issuing Country', value: result.issuingCountry },
  ] : []

  const showResult = result !== null || apiError !== null
  const isOk       = result?.isValid === true && !apiError

  return (
    <>
      <div className="page-header">
        <div className="page-title">Passport Scanner</div>
        <div className="page-subtitle">
          Upload a passport image 
        </div>
      </div>

      <div className="page-body">

        {/* Drop zone */}
        <div
          className={`upload-zone${dragover ? ' dragover' : ''}`}
          onClick={() => inputRef.current?.click()}
          onDragOver={e  => { e.preventDefault(); setDragover(true) }}
          onDragLeave={() => setDragover(false)}
          onDrop={e => { e.preventDefault(); setDragover(false); handleFile(e.dataTransfer.files[0]) }}
        >
          <div className="upload-icon">
            <svg width="26" height="26" viewBox="0 0 24 24" fill="none"
                 stroke="#0066cc" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
              <polyline points="16 16 12 12 8 16" />
              <line x1="12" y1="12" x2="12" y2="21" />
              <path d="M20.39 18.39A5 5 0 0 0 18 9h-1.26A8 8 0 1 0 3 16.3" />
            </svg>
          </div>
          <p className="upload-title">Drop your passport image here</p>
          <p className="upload-hint">or <span>click to browse files</span></p>
          <p className="upload-types">JPEG · PNG · PDF &nbsp;·&nbsp; Max 10 MB</p>
        </div>
        <input
          ref={inputRef} type="file"
          accept="image/*,application/pdf"
          style={{ display: 'none' }}
          onChange={e => handleFile(e.target.files[0])}
        />

        {/* File preview row */}
        {file && (
          <div className="file-preview">
            <div className="file-thumb">
              {preview
                ? <img src={preview} alt="" />
                : <svg width="22" height="22" viewBox="0 0 24 24" fill="none"
                       stroke="#0066cc" strokeWidth="1.5" strokeLinecap="round">
                    <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
                    <polyline points="14 2 14 8 20 8" />
                  </svg>
              }
            </div>
            <div className="file-meta">
              <div className="file-name">{file.name}</div>
              <div className="file-size">{fmtBytes(file.size)}</div>
            </div>
            <button className="file-remove" onClick={clearFile} title="Remove">
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none"
                   stroke="currentColor" strokeWidth="2" strokeLinecap="round">
                <line x1="18" y1="6" x2="6" y2="18" /><line x1="6" y1="6" x2="18" y2="18" />
              </svg>
            </button>
          </div>
        )}

        {/* Action button */}
        <button className="btn-primary" onClick={validate} disabled={!file || loading}>
          {loading && <span className="spinner" />}
          {loading ? 'Scanning…' : file ? 'Validate & Extract' : 'Select a file to validate'}
        </button>

        {/* ── Result ─────────────────────────────────────────────── */}
        {showResult && (
          <div className="result-card">

            {/* Header */}
            <div className="result-header">
              <div className={`status-icon ${isOk ? 'status-ok' : 'status-err'}`}>
                {isOk ? <CheckIcon /> : <CrossIcon />}
              </div>
              <div style={{ flex: 1 }}>
                <div className="result-title">
                  {apiError
                    ? 'Request Failed'
                    : result?.isValid
                    ? 'Passport Verified'
                    : 'Not a Passport'}
                </div>
                <div className="result-sub">
                  {apiError
                    ? null
                    : result?.isValid
                    ? `Detection confidence ${Math.round((result.confidence ?? 0) * 100)}%`
                    : result?.message}
                </div>
              </div>
              {result?.isValid && (
                <div className="confidence-badge">
                  {Math.round((result.confidence ?? 0) * 100)}%
                </div>
              )}
            </div>

            {/* API / network error detail */}
            {apiError && (
              <div className="passport-error-body">
                <pre className="error-pre">{apiError}</pre>
              </div>
            )}

            {/* Fields grid — only when passport found */}
            {result?.isValid && (
              <div className="passport-grid">
                {fields.map(f => (
                  <div key={f.label} className="passport-field">
                    <div className="field-label">{f.label}</div>
                    <div className="field-value">{f.value}</div>
                  </div>
                ))}
              </div>
            )}

            {/* Annotated detection images */}
            {(result?.stage1Image || result?.mrzImage) && (
              <div className="detection-images">
                {result.stage1Image && (
                  <div className="detection-img-card">
                    <div className="detection-img-label">Stage 1 — Passport detection</div>
                    <img
                      className="detection-img"
                      src={`data:image/jpeg;base64,${result.stage1Image}`}
                      alt="Passport detection result"
                    />
                  </div>
                )}
                {result.mrzImage && (
                  <div className="detection-img-card">
                    <div className="detection-img-label">Stage 2 — MRZ extraction</div>
                    <img
                      className="detection-img"
                      src={`data:image/jpeg;base64,${result.mrzImage}`}
                      alt="MRZ extraction result"
                    />
                  </div>
                )}
              </div>
            )}

          </div>
        )}

      </div>
    </>
  )
}
