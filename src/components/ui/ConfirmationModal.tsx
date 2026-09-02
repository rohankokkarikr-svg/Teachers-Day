import { AlertTriangle } from 'lucide-react';
import Modal from './Modal';
import Button from './Button';

interface ConfirmationModalProps {
  isOpen: boolean;
  onClose: () => void;
  onConfirm: () => void;
  title: string;
  message: string;
  warning?: string;
  confirmText?: string;
  cancelText?: string;
  variant?: 'danger' | 'primary' | 'gold';
  isLoading?: boolean;
}

export default function ConfirmationModal({
  isOpen,
  onClose,
  onConfirm,
  title,
  message,
  warning,
  confirmText = 'Confirm',
  cancelText = 'Cancel',
  variant = 'primary',
  isLoading = false,
}: ConfirmationModalProps) {
  return (
    <Modal isOpen={isOpen} onClose={onClose} title={title} size="sm">
      <div className="space-y-4">
        <p className="text-sm text-surface-300">{message}</p>

        {warning && (
          <div className="flex items-start gap-2 p-3 rounded-xl bg-amber-500/10 border border-amber-500/20">
            <AlertTriangle size={16} className="text-amber-400 flex-shrink-0 mt-0.5" />
            <p className="text-xs text-amber-300">{warning}</p>
          </div>
        )}

        <div className="flex gap-3 pt-2">
          <Button
            variant="secondary"
            onClick={onClose}
            disabled={isLoading}
            fullWidth
          >
            {cancelText}
          </Button>
          <Button
            variant={variant === 'danger' ? 'danger' : variant === 'gold' ? 'gold' : 'primary'}
            onClick={onConfirm}
            isLoading={isLoading}
            fullWidth
          >
            {confirmText}
          </Button>
        </div>
      </div>
    </Modal>
  );
}
