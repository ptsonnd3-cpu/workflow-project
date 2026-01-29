import React from 'react';

const ProgressBar = ({ 
  value, 
  max = 100, 
  min = 0, 
  size = 'medium', 
  variant = 'primary',
  showPercentage = true,
  animated = false,
  label,
  className = ''
}) => {
  const percentage = Math.min(Math.max(((value - min) / (max - min)) * 100, 0), 100);
  
  const sizeClasses = {
    small: 'progress-small',
    medium: 'progress-medium', 
    large: 'progress-large'
  };

  const variantClasses = {
    primary: 'progress-primary',
    success: 'progress-success',
    warning: 'progress-warning',
    danger: 'progress-danger',
    info: 'progress-info'
  };

  return (
    <div className={`progress-container ${className}`}>
      {label && (
        <div className="progress-label">
          <span>{label}</span>
          {showPercentage && (
            <span className="progress-percentage">{Math.round(percentage)}%</span>
          )}
        </div>
      )}
      <div className={`progress-bar ${sizeClasses[size]} ${variantClasses[variant]}`}>
        <div 
          className={`progress-fill ${animated ? 'progress-animated' : ''}`}
          style={{ width: `${percentage}%` }}
          role="progressbar"
          aria-valuenow={value}
          aria-valuemin={min}
          aria-valuemax={max}
        />
      </div>
      
      <style jsx>{`
        .progress-container {
          width: 100%;
        }
        
        .progress-label {
          display: flex;
          justify-content: space-between;
          align-items: center;
          margin-bottom: 4px;
          font-size: 14px;
          color: #374151;
        }
        
        .progress-percentage {
          font-weight: 600;
          color: #6b7280;
        }
        
        .progress-bar {
          width: 100%;
          background-color: #f3f4f6;
          border-radius: 4px;
          overflow: hidden;
          box-shadow: inset 0 1px 2px rgba(0, 0, 0, 0.1);
        }
        
        .progress-small {
          height: 6px;
        }
        
        .progress-medium {
          height: 12px;
        }
        
        .progress-large {
          height: 20px;
        }
        
        .progress-fill {
          height: 100%;
          transition: width 0.3s ease-in-out;
          border-radius: 4px;
        }
        
        .progress-animated .progress-fill {
          background-image: linear-gradient(
            45deg,
            rgba(255, 255, 255, 0.15) 25%,
            transparent 25%,
            transparent 50%,
            rgba(255, 255, 255, 0.15) 50%,
            rgba(255, 255, 255, 0.15) 75%,
            transparent 75%,
            transparent
          );
          background-size: 20px 20px;
          animation: progress-animate 1s linear infinite;
        }
        
        .progress-primary .progress-fill {
          background-color: #3b82f6;
        }
        
        .progress-success .progress-fill {
          background-color: #10b981;
        }
        
        .progress-warning .progress-fill {
          background-color: #f59e0b;
        }
        
        .progress-danger .progress-fill {
          background-color: #ef4444;
        }
        
        .progress-info .progress-fill {
          background-color: #06b6d4;
        }
        
        @keyframes progress-animate {
          0% {
            background-position: 0 0;
          }
          100% {
            background-position: 20px 0;
          }
        }
      `}</style>
    </div>
  );
};

// Circular Progress component
export const CircularProgress = ({ 
  value, 
  max = 100,
  size = 80,
  strokeWidth = 4,
  variant = 'primary',
  showPercentage = true,
  animated = false 
}) => {
  const percentage = Math.min(Math.max((value / max) * 100, 0), 100);
  const radius = (size - strokeWidth) / 2;
  const circumference = 2 * Math.PI * radius;
  const strokeDashoffset = circumference - (percentage / 100) * circumference;

  const colors = {
    primary: '#3b82f6',
    success: '#10b981',
    warning: '#f59e0b',
    danger: '#ef4444',
    info: '#06b6d4'
  };

  return (
    <div className="circular-progress">
      <svg width={size} height={size} className="circular-progress-svg">
        {/* Background circle */}
        <circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          fill="none"
          stroke="#f3f4f6"
          strokeWidth={strokeWidth}
        />
        {/* Progress circle */}
        <circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          fill="none"
          stroke={colors[variant]}
          strokeWidth={strokeWidth}
          strokeLinecap="round"
          strokeDasharray={circumference}
          strokeDashoffset={strokeDashoffset}
          className={animated ? 'circular-progress-animated' : ''}
        />
      </svg>
      {showPercentage && (
        <div className="circular-progress-text">
          {Math.round(percentage)}%
        </div>
      )}
      
      <style jsx>{`
        .circular-progress {
          position: relative;
          display: inline-block;
        }
        
        .circular-progress-svg {
          transform: rotate(-90deg);
        }
        
        .circular-progress-svg circle:last-child {
          transition: stroke-dashoffset 0.3s ease-in-out;
        }
        
        .circular-progress-animated circle:last-child {
          animation: circular-progress-animate 2s linear infinite;
        }
        
        .circular-progress-text {
          position: absolute;
          top: 50%;
          left: 50%;
          transform: translate(-50%, -50%);
          font-size: ${size * 0.2}px;
          font-weight: 600;
          color: #374151;
        }
        
        @keyframes circular-progress-animate {
          0% {
            stroke-dashoffset: ${circumference};
          }
          100% {
            stroke-dashoffset: ${strokeDashoffset};
          }
        }
      `}</style>
    </div>
  );
};

export default ProgressBar;