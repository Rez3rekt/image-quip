import { useState, useEffect } from 'react';
import '../../styles/ConnectionStatus.css';

const ConnectionStatus = ({ socket, isConnected: _isConnected }) => {
  const [connectionState, setConnectionState] = useState('connecting');
  const [reconnectAttempts, setReconnectAttempts] = useState(0);
  const [showStatus, setShowStatus] = useState(false);
  const [lastDisconnectTime, setLastDisconnectTime] = useState(null);

  useEffect(() => {
    if (!socket) {return;}

    const handleConnect = () => {
      setConnectionState('connected');
      setReconnectAttempts(0);
      setShowStatus(false);
    };

    const handleDisconnect = (reason) => {
      setConnectionState('disconnected');
      setLastDisconnectTime(Date.now());
      setShowStatus(true);
      console.log('Socket disconnected:', reason);
    };

    const handleConnectError = (error) => {
      setConnectionState('error');
      setShowStatus(true);
      console.error('Socket connection error:', error);
    };

    const handleReconnectAttempt = (attempt) => {
      setConnectionState('reconnecting');
      setReconnectAttempts(attempt);
      setShowStatus(true);
    };

    const handleReconnectError = (error) => {
      setConnectionState('reconnect-failed');
      setShowStatus(true);
      console.error('Socket reconnection error:', error);
    };

    const handleReconnectFailed = () => {
      setConnectionState('reconnect-failed');
      setShowStatus(true);
    };

    // Socket event listeners
    socket.on('connect', handleConnect);
    socket.on('disconnect', handleDisconnect);
    socket.on('connect_error', handleConnectError);
    socket.on('reconnect_attempt', handleReconnectAttempt);
    socket.on('reconnect_error', handleReconnectError);
    socket.on('reconnect_failed', handleReconnectFailed);

    // Cleanup
    return () => {
      socket.off('connect', handleConnect);
      socket.off('disconnect', handleDisconnect);
      socket.off('connect_error', handleConnectError);
      socket.off('reconnect_attempt', handleReconnectAttempt);
      socket.off('reconnect_error', handleReconnectError);
      socket.off('reconnect_failed', handleReconnectFailed);
    };
  }, [socket]);

  // Auto-hide status after successful connection
  useEffect(() => {
    if (connectionState === 'connected' && showStatus) {
      const timer = setTimeout(() => setShowStatus(false), 3000);
      return () => clearTimeout(timer);
    }
  }, [connectionState, showStatus]);

  // Show status indicator when connection issues occur
  useEffect(() => {
    setShowStatus(connectionState !== 'connected');
  }, [connectionState]);

  const getStatusInfo = () => {
    switch (connectionState) {
      case 'connected':
        return {
          icon: '🟢',
          message: 'Connected',
          className: 'connection-status--connected',
        };
      case 'connecting':
        return {
          icon: '🟡',
          message: 'Connecting...',
          className: 'connection-status--connecting',
        };
      case 'disconnected':
        return {
          icon: '🔴',
          message: 'Connection lost',
          className: 'connection-status--disconnected',
        };
      case 'reconnecting':
        return {
          icon: '🟡',
          message: `Reconnecting... (${reconnectAttempts})`,
          className: 'connection-status--reconnecting',
        };
      case 'reconnect-failed':
        return {
          icon: '🔴',
          message: 'Connection failed',
          className: 'connection-status--failed',
        };
      case 'error':
        return {
          icon: '⚠️',
          message: 'Connection error',
          className: 'connection-status--error',
        };
      default:
        return {
          icon: '⚪',
          message: 'Unknown status',
          className: 'connection-status--unknown',
        };
    }
  };

  const handleRetryConnection = () => {
    if (socket && !socket.connected) {
      socket.connect();
      setConnectionState('connecting');
    }
  };

  const statusInfo = getStatusInfo();

  if (!showStatus && connectionState === 'connected') {
    return null;
  }

  return (
    <div className={`connection-status ${statusInfo.className} ${showStatus ? 'connection-status--visible' : ''}`}>
      <div className="connection-status__content">
        <span className="connection-status__icon">{statusInfo.icon}</span>
        <span className="connection-status__message">{statusInfo.message}</span>
        
        {(connectionState === 'disconnected' || connectionState === 'reconnect-failed' || connectionState === 'error') && (
          <button 
            className="connection-status__retry"
            onClick={handleRetryConnection}
            aria-label="Retry connection"
          >
            🔄
          </button>
        )}
      </div>
      
      {connectionState === 'disconnected' && lastDisconnectTime && (
        <div className="connection-status__details">
          <small>
            Try refreshing the page if issues persist
          </small>
        </div>
      )}
    </div>
  );
};

export default ConnectionStatus; 