import { useState, useRef } from 'react'
import './FileUpload.css'

function FileUpload({ onFileSelect, accept = ".svg,image/svg+xml", disabled = false }) {
  const [isDragOver, setIsDragOver] = useState(false)
  const [selectedFile, setSelectedFile] = useState(null)
  const fileInputRef = useRef(null)

  const handleDragOver = (e) => {
    e.preventDefault()
    if (!disabled) {
      setIsDragOver(true)
    }
  }

  const handleDragLeave = (e) => {
    e.preventDefault()
    setIsDragOver(false)
  }

  const handleDrop = (e) => {
    e.preventDefault()
    setIsDragOver(false)

    if (disabled) return

    const files = Array.from(e.dataTransfer.files)
    const file = files[0]

    if (file && file.type === 'image/svg+xml') {
      setSelectedFile(file)
      onFileSelect(file)
    }
  }

  const handleFileInputChange = (e) => {
    const file = e.target.files[0]
    if (file) {
      setSelectedFile(file)
      onFileSelect(file)
    }
  }

  const handleClick = () => {
    if (!disabled) {
      fileInputRef.current?.click()
    }
  }

  const handleRemoveFile = (e) => {
    e.stopPropagation()
    setSelectedFile(null)
    onFileSelect(null)
    if (fileInputRef.current) {
      fileInputRef.current.value = ''
    }
  }

  return (
    <div
      className={`file-upload ${isDragOver ? 'drag-over' : ''} ${disabled ? 'disabled' : ''} ${selectedFile ? 'has-file' : ''}`}
      onDragOver={handleDragOver}
      onDragLeave={handleDragLeave}
      onDrop={handleDrop}
      onClick={handleClick}
    >
      <input
        ref={fileInputRef}
        type="file"
        accept={accept}
        onChange={handleFileInputChange}
        disabled={disabled}
        style={{ display: 'none' }}
      />

      {selectedFile ? (
        <div className="file-selected">
          <div className="file-info">
            <div className="file-icon">📄</div>
            <div className="file-details">
              <div className="file-name">{selectedFile.name}</div>
              <div className="file-size">{(selectedFile.size / 1024).toFixed(1)} KB</div>
            </div>
          </div>
          <button
            className="remove-file-btn"
            onClick={handleRemoveFile}
            disabled={disabled}
          >
            ✕
          </button>
        </div>
      ) : (
        <div className="file-upload-content">
          <div className="upload-icon">📁</div>
          <div className="upload-text">
            <strong>Click to browse</strong> or drag and drop your SVG file here
          </div>
        </div>
      )}
    </div>
  )
}

export default FileUpload
