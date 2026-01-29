import React from 'react';

class ErrorBoundary extends React.Component {
  constructor(props) {
    super(props);
    this.state = { hasError: false, error: null, errorInfo: null };
  }

  static getDerivedStateFromError(error) {
    return { hasError: true };
  }

  componentDidCatch(error, errorInfo) {
    console.error('ErrorBoundary caught an error:', error, errorInfo);
    this.setState({
      error: error,
      errorInfo: errorInfo
    });
  }

  render() {
    if (this.state.hasError) {
      return (
        <div className="wf-alert" style={{ padding: '20px', margin: '20px' }}>
          <h3>⚠️ Có lỗi xảy ra</h3>
          <details style={{ whiteSpace: 'pre-wrap', marginTop: '10px' }}>
            <summary>Chi tiết lỗi (dành cho developer)</summary>
            <div style={{ 
              background: '#1a1a1a', 
              padding: '10px', 
              borderRadius: '4px',
              marginTop: '10px',
              fontSize: '12px',
              fontFamily: 'monospace'
            }}>
              <strong>Error:</strong> {this.state.error && this.state.error.toString()}
              <br />
              <strong>Stack:</strong> {this.state.errorInfo.componentStack}
            </div>
          </details>
          <div style={{ marginTop: '15px' }}>
            <button 
              className="wf-btn wf-btn-primary"
              onClick={() => window.location.reload()}
            >
              🔄 Reload trang
            </button>
            <button 
              className="wf-btn"
              style={{ marginLeft: '10px' }}
              onClick={() => this.setState({ hasError: false, error: null, errorInfo: null })}
            >
              ↩️ Thử lại
            </button>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}

export default ErrorBoundary;