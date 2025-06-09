import { Component } from 'react';
import './ErrorBoundary.css';

class ErrorBoundary extends Component {
  constructor(props) {
    super(props);
    this.state = { 
      hasError: false, 
      error: null, 
      errorInfo: null,
      errorId: null,
    };
  }

  static getDerivedStateFromError(_error) {
    // Update state so the next render will show the fallback UI
    return { hasError: true };
  }

  componentDidCatch(error, errorInfo) {
    // Generate a unique error ID for tracking
    const errorId = `err_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    
    this.setState({
      error,
      errorInfo,
      errorId,
    });

    // Log error details
    console.error('Error Boundary caught an error:', {
      errorId,
      error: error.toString(),
      errorInfo,
      stack: error.stack,
      timestamp: new Date().toISOString(),
      userAgent: navigator.userAgent,
      url: window.location.href,
    });

    // In production, you might want to send this to an error reporting service
    if (process.env.NODE_ENV === 'production') {
      this.reportError(error, errorInfo, errorId);
    }
  }

  reportError(error, errorInfo, errorId) {
    // This would typically send to an error reporting service like Sentry
    // For now, we'll just log it
    const errorReport = {
      errorId,
      message: error.toString(),
      stack: error.stack,
      componentStack: errorInfo.componentStack,
      timestamp: new Date().toISOString(),
      userAgent: navigator.userAgent,
      url: window.location.href,
    };

    // You could send this to your server or error reporting service
    console.error('Error Report:', errorReport);
  }

  handleRetry() {
    this.setState({
      hasError: false,
      error: null,
      errorInfo: null,
      errorId: null,
    });
  }

  handleReload() {
    window.location.reload();
  }

  render() {
    if (this.state.hasError) {
      const { error, errorId } = this.state;
      const { fallback: CustomFallback } = this.props;

      // If a custom fallback component is provided, use it
      if (CustomFallback) {
        return (
          <CustomFallback
            error={error}
            errorId={errorId}
            onRetry={this.handleRetry}
            onReload={this.handleReload}
          />
        );
      }

      // Default error UI
      return (
        <div className="error-boundary">
          <div className="error-boundary-content">
            <div className="error-icon">⚠️</div>
            <h2>Oops! Something went wrong</h2>
            <p>
              We&apos;re sorry, but something unexpected happened. The error has been logged 
              and we&apos;ll look into it.
            </p>
            
            {process.env.NODE_ENV === 'development' && (
              <details className="error-details">
                <summary>Error Details (Development)</summary>
                <div className="error-info">
                  <p><strong>Error ID:</strong> {errorId}</p>
                  <p><strong>Error:</strong> {error && error.toString()}</p>
                  {error && error.stack && (
                    <pre className="error-stack">{error.stack}</pre>
                  )}
                </div>
              </details>
            )}

            <div className="error-actions">
              <button 
                onClick={this.handleRetry}
                className="retry-button"
              >
                Try Again
              </button>
              <button 
                onClick={this.handleReload}
                className="reload-button"
              >
                Reload Page
              </button>
            </div>

            <div className="error-help">
              <p>
                If this problem persists, try:
              </p>
              <ul>
                <li>Refreshing the page</li>
                <li>Clearing your browser cache</li>
                <li>Checking your internet connection</li>
              </ul>
            </div>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}

export default ErrorBoundary; 