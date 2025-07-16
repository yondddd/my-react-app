import './ProgressBar.css'

function ProgressBar({ progress, status, className = '' }) {
  return (
    <div className={`progress-container ${className}`}>
      <div className="progress-bar">
        <div 
          className={`progress-fill ${status}`}
          style={{ width: `${progress}%` }}
        />
      </div>
      <div className="progress-text">
        {status === 'loading' && 'Converting...'}
        {status === 'success' && 'Conversion Complete!'}
        {status === 'error' && 'Conversion Failed'}
        {!status && `${progress}%`}
      </div>
    </div>
  )
}

export default ProgressBar