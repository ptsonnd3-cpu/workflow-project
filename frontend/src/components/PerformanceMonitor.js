import React, { useState, useEffect } from 'react';

// Performance monitor hook
export const usePerformanceMonitor = () => {
  const [metrics, setMetrics] = useState({
    renderTime: 0,
    memoryUsage: 0,
    apiCallCount: 0,
    totalApiTime: 0,
    errors: []
  });

  const startApiCall = (endpoint) => {
    const startTime = performance.now();
    return {
      end: () => {
        const duration = performance.now() - startTime;
        setMetrics(prev => ({
          ...prev,
          apiCallCount: prev.apiCallCount + 1,
          totalApiTime: prev.totalApiTime + duration
        }));
        
        console.log(`API Call: ${endpoint} took ${duration.toFixed(2)}ms`);
        return duration;
      }
    };
  };

  const trackRenderTime = (componentName, duration) => {
    setMetrics(prev => ({
      ...prev,
      renderTime: Math.max(prev.renderTime, duration)
    }));
    
    if (duration > 16) { // More than 1 frame (60fps)
      console.warn(`Slow render: ${componentName} took ${duration.toFixed(2)}ms`);
    }
  };

  const trackError = (error, context) => {
    const errorInfo = {
      message: error.message,
      context,
      timestamp: new Date().toISOString(),
      stack: error.stack
    };
    
    setMetrics(prev => ({
      ...prev,
      errors: [...prev.errors.slice(-9), errorInfo] // Keep last 10 errors
    }));
  };

  const updateMemoryUsage = () => {
    if (performance.memory) {
      setMetrics(prev => ({
        ...prev,
        memoryUsage: performance.memory.usedJSHeapSize / 1024 / 1024 // MB
      }));
    }
  };

  useEffect(() => {
    const interval = setInterval(updateMemoryUsage, 5000); // Update every 5s
    return () => clearInterval(interval);
  }, []);

  const getAverageApiTime = () => {
    return metrics.apiCallCount > 0 ? metrics.totalApiTime / metrics.apiCallCount : 0;
  };

  const resetMetrics = () => {
    setMetrics({
      renderTime: 0,
      memoryUsage: 0,
      apiCallCount: 0,
      totalApiTime: 0,
      errors: []
    });
  };

  return {
    metrics,
    startApiCall,
    trackRenderTime,
    trackError,
    getAverageApiTime,
    resetMetrics
  };
};

// Performance Monitor Component
const PerformanceMonitor = ({ show = false, onToggle }) => {
  const { 
    metrics, 
    getAverageApiTime, 
    resetMetrics 
  } = usePerformanceMonitor();

  if (!show) {
    return (
      <button
        onClick={onToggle}
        style={{
          position: 'fixed',
          bottom: '20px',
          right: '20px',
          padding: '8px 12px',
          background: '#374151',
          color: 'white',
          border: 'none',
          borderRadius: '4px',
          fontSize: '12px',
          cursor: 'pointer',
          zIndex: 9999
        }}
      >
        📊 Perf
      </button>
    );
  }

  return (
    <div style={{
      position: 'fixed',
      bottom: '20px',
      right: '20px',
      width: '300px',
      background: 'white',
      border: '1px solid #e5e7eb',
      borderRadius: '8px',
      boxShadow: '0 10px 15px -3px rgba(0, 0, 0, 0.1)',
      zIndex: 9999,
      fontSize: '12px'
    }}>
      {/* Header */}
      <div style={{
        padding: '12px',
        borderBottom: '1px solid #e5e7eb',
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center',
        background: '#f9fafb'
      }}>
        <h3 style={{ margin: 0, fontSize: '14px', fontWeight: 600 }}>
          Performance Monitor
        </h3>
        <div>
          <button
            onClick={resetMetrics}
            style={{
              padding: '4px 8px',
              background: '#ef4444',
              color: 'white',
              border: 'none',
              borderRadius: '4px',
              cursor: 'pointer',
              marginRight: '8px',
              fontSize: '11px'
            }}
          >
            Reset
          </button>
          <button
            onClick={onToggle}
            style={{
              background: 'none',
              border: 'none',
              cursor: 'pointer',
              fontSize: '16px'
            }}
          >
            ×
          </button>
        </div>
      </div>

      {/* Metrics */}
      <div style={{ padding: '12px' }}>
        <div style={{ marginBottom: '8px' }}>
          <strong>Render Time:</strong> {metrics.renderTime.toFixed(2)}ms
          <div style={{
            width: '100%',
            height: '4px',
            background: '#e5e7eb',
            borderRadius: '2px',
            marginTop: '4px'
          }}>
            <div style={{
              width: `${Math.min((metrics.renderTime / 100) * 100, 100)}%`,
              height: '100%',
              background: metrics.renderTime > 16 ? '#ef4444' : '#10b981',
              borderRadius: '2px'
            }} />
          </div>
        </div>

        <div style={{ marginBottom: '8px' }}>
          <strong>Memory Usage:</strong> {metrics.memoryUsage.toFixed(1)} MB
          <div style={{
            width: '100%',
            height: '4px',
            background: '#e5e7eb',
            borderRadius: '2px',
            marginTop: '4px'
          }}>
            <div style={{
              width: `${Math.min((metrics.memoryUsage / 100) * 100, 100)}%`,
              height: '100%',
              background: metrics.memoryUsage > 50 ? '#f59e0b' : '#3b82f6',
              borderRadius: '2px'
            }} />
          </div>
        </div>

        <div style={{ marginBottom: '8px' }}>
          <strong>API Calls:</strong> {metrics.apiCallCount}
          <br />
          <strong>Avg Response Time:</strong> {getAverageApiTime().toFixed(2)}ms
        </div>

        {metrics.errors.length > 0 && (
          <div style={{ marginBottom: '8px' }}>
            <strong style={{ color: '#ef4444' }}>
              Recent Errors ({metrics.errors.length}):
            </strong>
            <div style={{
              maxHeight: '100px',
              overflowY: 'auto',
              marginTop: '4px'
            }}>
              {metrics.errors.slice(-3).map((error, index) => (
                <div key={index} style={{
                  padding: '4px',
                  background: '#fef2f2',
                  border: '1px solid #fecaca',
                  borderRadius: '4px',
                  marginBottom: '4px'
                }}>
                  <div style={{ color: '#dc2626', fontWeight: 600 }}>
                    {error.message}
                  </div>
                  <div style={{ color: '#6b7280', fontSize: '11px' }}>
                    {error.context} • {new Date(error.timestamp).toLocaleTimeString()}
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

// HOC to measure component render time
export const withPerformanceTracking = (WrappedComponent, componentName) => {
  return React.memo((props) => {
    const [renderStart] = useState(() => performance.now());
    
    useEffect(() => {
      const renderEnd = performance.now();
      const duration = renderEnd - renderStart;
      
      if (window.performanceMonitor) {
        window.performanceMonitor.trackRenderTime(componentName, duration);
      }
    });

    return <WrappedComponent {...props} />;
  });
};

// Performance context provider
export const PerformanceContext = React.createContext();

export const PerformanceProvider = ({ children }) => {
  const performanceTools = usePerformanceMonitor();
  
  // Make it available globally for easier access
  useEffect(() => {
    window.performanceMonitor = performanceTools;
    return () => {
      delete window.performanceMonitor;
    };
  }, [performanceTools]);

  return (
    <PerformanceContext.Provider value={performanceTools}>
      {children}
    </PerformanceContext.Provider>
  );
};

export default PerformanceMonitor;