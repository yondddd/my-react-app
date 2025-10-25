import iconDpi from '../assets/icon-dpi.svg'
import './DpiSelector.css'

const DPI_OPTIONS = [
  { value: 72, label: '72 DPI', description: 'Web/Screen' },
  { value: 150, label: '150 DPI', description: 'Print Draft' },
  { value: 300, label: '300 DPI', description: 'High Quality Print' }
]

function DpiSelector({ dpi, onDpiChange, disabled = false }) {
  return (
    <div className="dpi-selector">
      <h3>
        <img src={iconDpi} alt="" aria-hidden="true" className="section-icon" />
        Resolution (DPI)
      </h3>
      <div className="dpi-options">
        {DPI_OPTIONS.map((option) => (
          <label 
            key={option.value}
            className={`dpi-option ${dpi === option.value ? 'selected' : ''}`}
          >
            <input
              type="radio"
              value={option.value}
              checked={dpi === option.value}
              onChange={(e) => onDpiChange(Number(e.target.value))}
              disabled={disabled}
            />
            <span className="dpi-label">
              <strong>{option.label}</strong>
              <small>{option.description}</small>
            </span>
          </label>
        ))}
      </div>
      <div className="dpi-info">
        Higher DPI = Larger file size but better quality for print
      </div>
    </div>
  )
}

export default DpiSelector
