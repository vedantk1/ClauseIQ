/**
 * Delete single document confirmation modal
 * Similar to DeleteAllModal but for individual documents
 */

import Modal from "@/components/ui/Modal";
import Button from "@/components/Button";

interface DeleteDocumentModalProps {
  isOpen: boolean;
  onClose: () => void;
  onConfirm: () => void;
  documentName: string;
}

export const DeleteDocumentModal = ({
  isOpen,
  onClose,
  onConfirm,
  documentName,
}: DeleteDocumentModalProps) => {
  return (
    <Modal isOpen={isOpen} onClose={onClose} title="Delete Document" size="md">
      <div className="space-y-6">
        <p className="text-text-secondary">
          Are you sure you want to delete{" "}
          <span className="font-medium text-text-primary">
            &ldquo;{documentName}&rdquo;
          </span>
          ? This action cannot be undone.
        </p>
        <div className="flex gap-3">
          <Button onClick={onClose} variant="secondary" className="flex-1">
            Cancel
          </Button>
          <Button onClick={onConfirm} variant="danger" className="flex-1">
            Delete Document
          </Button>
        </div>
      </div>
    </Modal>
  );
};
