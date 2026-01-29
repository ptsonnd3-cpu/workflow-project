import React, { useEffect, useState } from 'react';
import { createPortal } from 'react-dom';
import './Modal.css';

const Modal = ({
  isOpen,
  onClose,
  title,
  children,
  size = 'medium',
  closable = true,
  footer,
  className = '',
  overlayClassName = '',
  closeOnOverlayClick = true,
  closeOnEscapeKey = true
}) => {
  const [isVisible, setIsVisible] = useState(false);
  const [portalElement, setPortalElement] = useState(null);

  useEffect(() => {
    // Create portal element
    const element = document.createElement('div');
    element.id = 'modal-portal';
    document.body.appendChild(element);
    setPortalElement(element);

    return () => {
      if (element.parentNode) {
        element.parentNode.removeChild(element);
      }
    };
  }, []);

  useEffect(() => {
    if (isOpen) {
      setIsVisible(true);
      // Disable body scroll
      document.body.style.overflow = 'hidden';
    } else {
      setIsVisible(false);
      // Re-enable body scroll
      document.body.style.overflow = '';
    }

    return () => {
      document.body.style.overflow = '';
    };
  }, [isOpen]);

  useEffect(() => {
    if (!closeOnEscapeKey) return;

    const handleEscapeKey = (event) => {
      if (event.key === 'Escape' && isOpen) {
        onClose();
      }
    };

    document.addEventListener('keydown', handleEscapeKey);
    return () => {
      document.removeEventListener('keydown', handleEscapeKey);
    };
  }, [isOpen, onClose, closeOnEscapeKey]);

  const handleOverlayClick = (event) => {
    if (closeOnOverlayClick && event.target === event.currentTarget) {
      onClose();
    }
  };

  const sizeClasses = {
    small: 'modal-small',
    medium: 'modal-medium',
    large: 'modal-large',
    fullscreen: 'modal-fullscreen'
  };

  if (!portalElement || !isVisible) {
    return null;
  }

  const modalContent = (
    <div 
      className={`modal-overlay ${overlayClassName} ${isOpen ? 'modal-overlay-open' : ''}`}
      onClick={handleOverlayClick}
    >
      <div className={`modal-container ${sizeClasses[size]} ${className} ${isOpen ? 'modal-container-open' : ''}`}>
        {/* Header */}
        {(title || closable) && (
          <div className="modal-header">
            {title && <h3 className="modal-title">{title}</h3>}
            {closable && (
              <button 
                className="modal-close-button"
                onClick={onClose}
                aria-label="Đóng modal"
              >
                ×
              </button>
            )}
          </div>
        )}

        {/* Body */}
        <div className="modal-body">
          {children}
        </div>

        {/* Footer */}
        {footer && (
          <div className="modal-footer">
            {footer}
          </div>
        )}
      </div>

      <style jsx>{`
        .modal-overlay {
          position: fixed;
          top: 0;
          left: 0;
          right: 0;
          bottom: 0;
          background-color: rgba(0, 0, 0, 0.5);
          display: flex;
          align-items: center;
          justify-content: center;
          z-index: 1000;
          opacity: 0;
          transition: opacity 0.3s ease-in-out;
          padding: 20px;
          box-sizing: border-box;
        }

        .modal-overlay-open {
          opacity: 1;
        }

        .modal-container {
          background: #1e1e1e;
          border: 1px solid #333;
          border-radius: 8px;
          box-shadow: 0 25px 50px -12px rgba(0, 0, 0, 0.5);
          max-height: 90vh;
          display: flex;
          flex-direction: column;
          transform: scale(0.95);
          transition: transform 0.3s ease-in-out;
          overflow: hidden;
        }

        .modal-container-open {
          transform: scale(1);
        }

        .modal-small {
          width: 100%;
          max-width: 400px;
        }

        .modal-medium {
          width: 100%;
          max-width: 600px;
        }

        .modal-large {
          width: 100%;
          max-width: 800px;
        }

        .modal-fullscreen {
          width: 95vw;
          height: 95vh;
          max-width: none;
          max-height: none;
        }

        .modal-header {
          display: flex;
          align-items: center;
          justify-content: space-between;
          padding: 20px 24px;
          border-bottom: 1px solid #333;
          flex-shrink: 0;
        }

        .modal-title {
          margin: 0;
          font-size: 18px;
          font-weight: 600;
          color: #e0e0e0;
        }

        .modal-close-button {
          background: none;
          border: none;
          font-size: 24px;
          cursor: pointer;
          color: #999;
          padding: 4px;
          line-height: 1;
          display: flex;
          align-items: center;
          justify-content: center;
          width: 32px;
          height: 32px;
          border-radius: 4px;
          transition: all 0.2s;
        }

        .modal-close-button:hover {
          background-color: #333;
          color: #e0e0e0;
        }

        .modal-body {
          padding: 24px;
          overflow-y: auto;
          flex-grow: 1;
        }

        .modal-footer {
          padding: 16px 24px;
          border-top: 1px solid #e5e7eb;
          display: flex;
          justify-content: flex-end;
          gap: 8px;
          flex-shrink: 0;
        }

        @media (max-width: 640px) {
          .modal-overlay {
            padding: 10px;
          }
          
          .modal-container {
            max-height: 95vh;
          }
          
          .modal-small,
          .modal-medium,
          .modal-large {
            width: 100%;
            max-width: none;
          }
          
          .modal-fullscreen {
            width: 100%;
            height: 100%;
            border-radius: 0;
          }
          
          .modal-header {
            padding: 16px 20px;
          }
          
          .modal-body {
            padding: 20px;
          }
          
          .modal-footer {
            padding: 16px 20px;
          }
        }
      `}</style>
    </div>
  );

  return createPortal(modalContent, portalElement);
};

// Modal confirmation helper
export const ConfirmModal = ({ 
  isOpen, 
  onClose, 
  onConfirm, 
  title = "Xác nhận", 
  message = "Bạn có chắc chắn muốn thực hiện hành động này?",
  confirmText = "Xác nhận",
  cancelText = "Hủy",
  variant = "primary" // primary, danger, warning
}) => {
  const handleConfirm = () => {
    onConfirm();
    onClose();
  };

  const variantClasses = {
    primary: 'btn-primary',
    danger: 'btn-danger', 
    warning: 'btn-warning'
  };

  const footer = (
    <>
      <button className="btn btn-secondary" onClick={onClose}>
        {cancelText}
      </button>
      <button className={`btn ${variantClasses[variant]}`} onClick={handleConfirm}>
        {confirmText}
      </button>
      <style jsx>{`
        .btn {
          padding: 8px 16px;
          border: none;
          border-radius: 4px;
          cursor: pointer;
          font-size: 14px;
          font-weight: 500;
          transition: all 0.2s;
        }
        
        .btn-secondary {
          background-color: #f3f4f6;
          color: #374151;
        }
        
        .btn-secondary:hover {
          background-color: #e5e7eb;
        }
        
        .btn-primary {
          background-color: #3b82f6;
          color: white;
        }
        
        .btn-primary:hover {
          background-color: #2563eb;
        }
        
        .btn-danger {
          background-color: #ef4444;
          color: white;
        }
        
        .btn-danger:hover {
          background-color: #dc2626;
        }
        
        .btn-warning {
          background-color: #f59e0b;
          color: white;
        }
        
        .btn-warning:hover {
          background-color: #d97706;
        }
      `}</style>
    </>
  );

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title={title}
      size="small"
      footer={footer}
    >
      <div style={{ textAlign: 'center', padding: '16px 0' }}>
        {message}
      </div>
    </Modal>
  );
};

export default Modal;