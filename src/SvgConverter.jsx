import { useState } from 'react'
import ImageConverter from './utils/ImageConverter'
import FileUpload from './components/FileUpload'
import ProgressBar from './components/ProgressBar'
import './SvgConverter.css'

function SvgConverter() {
  const [svgFile, setSvgFile] = useState(null)
  const [svgContent, setSvgContent] = useState('')
  const [outputFormat, setOutputFormat] = useState('png')
  const [dpi, setDpi] = useState(72)
  const [transparentBackground, setTransparentBackground] = useState(false)
  const [isConverting, setIsConverting] = useState(false)
  const [progress, setProgress] = useState(0)
  const [error, setError] = useState(null)

  const handleFileSelect = (file) => {
    if (!file) {
      setSvgFile(null)
      setSvgContent('')
      setError(null)
      return
    }

    if (file.type !== 'image/svg+xml') {
      setError('Please select a valid SVG file')
      return
    }

    setSvgFile(file)
    setError(null)
    
    const reader = new FileReader()
    reader.onload = (e) => {
      const content = e.target.result
      if (ImageConverter.isValidSvg(content)) {
        setSvgContent(content)
      } else {
        setError('Invalid SVG file format')
      }
    }
    reader.readAsText(file)
  }

  const handleDpiChange = (newDpi) => {
    setDpi(newDpi)
  }

  const handleFormatChange = (format) => {
    setOutputFormat(format)
    // Reset transparent background when switching to JPEG
    if (format === 'jpeg') {
      setTransparentBackground(false)
    }
  }

  const handleTransparentBackgroundChange = (checked) => {
    setTransparentBackground(checked)
  }

  const convertImage = async () => {
    if (!svgContent) {
      setError('Please upload an SVG file first')
      return
    }

    setIsConverting(true)
    setProgress(0)
    setError(null)
    
    try {
      setProgress(25)
      
      const result = await ImageConverter.convertSvg(
        svgContent,
        outputFormat,
        dpi,
        1.0,
        transparentBackground
      )
      
      setProgress(75)
      
      setProgress(100)
      
      const filename = svgFile.name.replace('.svg', '')
      const extension = outputFormat === 'jpeg' ? 'jpg' : outputFormat
      
      ImageConverter.downloadFile(
        result.data,
        `${filename}.${extension}`,
        result.mimeType
      )
      
      setTimeout(() => {
        setProgress(0)
      }, 2000)
      
    } catch (error) {
      console.error('Conversion failed:', error)
      setError(`Conversion failed: ${error.message}`)
      setProgress(0)
    } finally {
      setIsConverting(false)
    }
  }


  return (
    <div className="svg-converter">
      <div className="converter-header">
        <div className="header-top">
          <h1>🎨 SVG Converter</h1>
          <a 
            href="https://github.com/yondddd/my-react-app" 
            target="_blank" 
            rel="noopener noreferrer"
            className="github-link"
          >
            <span className="github-icon">⭐</span>
            View on GitHub
          </a>
        </div>
        <p className="converter-description">
          Convert your SVG files to PNG, JPG, or TIFF formats with DPI selection
        </p>
      </div>

      {error && (
        <div className="error-message">
          ⚠️ {error}
        </div>
      )}

      <div className="converter-layout">
        <div className="left-panel">
          <div className="upload-section">
            <h2>📁 Upload SVG File</h2>
            <FileUpload
              onFileSelect={handleFileSelect}
              disabled={isConverting}
            />
          </div>

          <div className="settings-section">
            <div className="format-and-dpi">
              <div className="format-group">
                <h3>🎯 Format</h3>
                <div className="format-options-horizontal">
                  <label className={`format-option-compact ${outputFormat === 'png' ? 'selected' : ''}`}>
                    <input
                      type="radio"
                      value="png"
                      checked={outputFormat === 'png'}
                      onChange={(e) => handleFormatChange(e.target.value)}
                      disabled={isConverting}
                    />
                    <span>PNG</span>
                  </label>
                  <label className={`format-option-compact ${outputFormat === 'jpeg' ? 'selected' : ''}`}>
                    <input
                      type="radio"
                      value="jpeg"
                      checked={outputFormat === 'jpeg'}
                      onChange={(e) => handleFormatChange(e.target.value)}
                      disabled={isConverting}
                    />
                    <span>JPEG</span>
                  </label>
                  <label className={`format-option-compact ${outputFormat === 'tiff' ? 'selected' : ''}`}>
                    <input
                      type="radio"
                      value="tiff"
                      checked={outputFormat === 'tiff'}
                      onChange={(e) => handleFormatChange(e.target.value)}
                      disabled={isConverting}
                    />
                    <span>TIFF</span>
                  </label>
                </div>
              </div>

              <div className="dpi-group">
                <h3>📐 DPI</h3>
                <div className="dpi-options-horizontal">
                  <label className={`dpi-option-compact ${dpi === 72 ? 'selected' : ''}`}>
                    <input
                        type="radio"
                        value="72"
                        checked={dpi === 72}
                        onChange={(e) => handleDpiChange(Number(e.target.value))}
                        disabled={isConverting}
                    />
                    <span>72</span>
                  </label>
                  <label className={`dpi-option-compact ${dpi === 150 ? 'selected' : ''}`}>
                    <input
                        type="radio"
                        value="150"
                        checked={dpi === 150}
                        onChange={(e) => handleDpiChange(Number(e.target.value))}
                        disabled={isConverting}
                    />
                    <span>150</span>
                  </label>
                  <label className={`dpi-option-compact ${dpi === 300 ? 'selected' : ''}`}>
                    <input
                        type="radio"
                        value="300"
                        checked={dpi === 300}
                        onChange={(e) => handleDpiChange(Number(e.target.value))}
                        disabled={isConverting}
                    />
                    <span>300</span>
                  </label>
                  <label className={`dpi-option-compact ${dpi === 600 ? 'selected' : ''}`}>
                    <input
                        type="radio"
                        value="600"
                        checked={dpi === 600}
                        onChange={(e) => handleDpiChange(Number(e.target.value))}
                        disabled={isConverting}
                    />
                    <span>600</span>
                  </label>
                </div>
              </div>
            </div>

            {/* Transparent Background Option */}
            {(outputFormat === 'png' || outputFormat === 'tiff') && (
                <div className="transparency-group">
                  <h3>🌐 Background</h3>
                  <label className="transparency-toggle">
                    <input
                        type="checkbox"
                        checked={transparentBackground}
                        onChange={(e) => handleTransparentBackgroundChange(e.target.checked)}
                    disabled={isConverting}
                  />
                  <span className="toggle-text">
                    {transparentBackground ? 'Transparent' : 'White Background'}
                  </span>
                </label>
              </div>
            )}
            
          </div>

          <div className="action-section">
            <button
              className="convert-btn"
              onClick={convertImage}
              disabled={!svgContent || isConverting}
            >
              {isConverting ? (
                <>
                  <span className="loading-spinner">⏳</span>
                  Converting...
                </>
              ) : (
                <>
                  <span>🚀</span>
                  Convert Image
                </>
              )}
            </button>

            {(progress > 0 || isConverting) && (
              <ProgressBar
                progress={progress}
                status={isConverting ? 'loading' : progress === 100 ? 'success' : ''}
              />
            )}
          </div>
        </div>

      </div>
    </div>
  )
}

export default SvgConverter