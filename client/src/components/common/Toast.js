import { useState, useEffect, useCallback } from 'react';
import '../../styles/Toast.css';

// Toast Context for managing global toasts
let toastCounter = 0;
const toastListeners = new Set();

export const showToast = (message, type = 'info', duration = 4000) => {
  const toast = {
    id: ++toastCounter,
    message,
    type, // 'success', 'error', 'warning', 'info'
    duration,
    timestamp: Date.now(),
  };

  toastListeners.forEach(listener => listener(toast));
  return toast.id;
};

// Individual Toast Component
const ToastItem = ({ toast, onClose }) => {
  const [isVisible, setIsVisible] = useState(false);
  const [isLeaving, setIsLeaving] = useState(false);

  const handleClose = useCallback(() => {
    setIsLeaving(true);
    setTimeout(() => onClose(toast.id), 300); // Match animation duration
  }, [toast.id, onClose]);

  useEffect(() => {
    // Animate in
    const timer = setTimeout(() => setIsVisible(true), 50);
    return () => clearTimeout(timer);
  }, []);

  useEffect(() => {
    if (toast.duration > 0) {
      const timer = setTimeout(() => {
        handleClose();
      }, toast.duration);
      return () => clearTimeout(timer);
    }
  }, [toast.duration, handleClose]);

  const getIcon = () => {
    switch (toast.type) {
      case 'success':
        return '✅';
      case 'error':
        return '❌';
      case 'warning':
        return '⚠️';
      case 'info':
      default:
        return 'ℹ️';
    }
  };

  return (
    <div
      className={`toast toast--${toast.type} ${isVisible ? 'toast--visible' : ''} ${
        isLeaving ? 'toast--leaving' : ''
      }`}
      onClick={handleClose}
    >
      <span className="toast__icon">{getIcon()}</span>
      <span className="toast__message">{toast.message}</span>
      <button className="toast__close" onClick={handleClose} aria-label="Close notification">
        ×
      </button>
    </div>
  );
};

// Toast Container Component
export const ToastContainer = () => {
  const [toasts, setToasts] = useState([]);

  useEffect(() => {
    const handleNewToast = (newToast) => {
      setToasts(current => [...current, newToast]);
    };

    toastListeners.add(handleNewToast);
    return () => toastListeners.delete(handleNewToast);
  }, []);

  const removeToast = useCallback((toastId) => {
    setToasts(current => current.filter(toast => toast.id !== toastId));
  }, []);

  if (toasts.length === 0) {return null;}

  return (
    <div className="toast-container">
      {toasts.map(toast => (
        <ToastItem
          key={toast.id}
          toast={toast}
          onClose={removeToast}
        />
      ))}
    </div>
  );
};

// Hook for using toasts in components
export const useToast = () => {
  return {
    showSuccess: (message, duration) => showToast(message, 'success', duration),
    showError: (message, duration) => showToast(message, 'error', duration),
    showWarning: (message, duration) => showToast(message, 'warning', duration),
    showInfo: (message, duration) => showToast(message, 'info', duration),
  };
};

export default ToastContainer; 