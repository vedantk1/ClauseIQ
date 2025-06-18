/**
 * Delete all documents confirmation modal
 * Extracted from main documents page
 */

import Modal from "@/components/ui/Modal";
import Button from "@/components/Button";

interface DeleteAllModalProps {
  isOpen: boolean;
  onClose: () => void;
  onConfirm: () => void;
}

export const DeleteAllModal = ({
  isOpen,
  onClose,
  onConfirm,
}: DeleteAllModalProps) => {
  return (
    <Modal isOpen={isOpen} onClose={onClose} title="Delete All" size="md">
      <div className="space-y-6">
        <p className="text-text-secondary">
          Are you sure you want to delete all documents? This action cannot be
          undone.
        </p>
        <div className="flex gap-3">
          <Button onClick={onClose} variant="secondary" className="flex-1">
            Cancel
          </Button>
          <Button onClick={onConfirm} variant="danger" className="flex-1">
            Delete All
          </Button>
        </div>
      </div>
    </Modal>
  );
};
