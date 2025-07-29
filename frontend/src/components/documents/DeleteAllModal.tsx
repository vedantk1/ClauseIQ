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
  deletingAll?: boolean;
}

export const DeleteAllModal = ({
  isOpen,
  onClose,
  onConfirm,
  deletingAll = false,
}: DeleteAllModalProps) => {
  return (
    <Modal isOpen={isOpen} onClose={deletingAll ? () => {} : onClose} title="Delete All" size="md">
      <div className="space-y-6">
        <p className="text-text-secondary">
          {deletingAll 
            ? "Deleting all documents... Please wait."
            : "Are you sure you want to delete all documents? This action cannot be undone."
          }
        </p>
        <div className="flex gap-3">
          <Button 
            onClick={onClose} 
            variant="secondary" 
            className="flex-1"
            disabled={deletingAll}
          >
            {deletingAll ? "Please wait..." : "Cancel"}
          </Button>
          <Button 
            onClick={onConfirm} 
            variant="danger" 
            className="flex-1"
            disabled={deletingAll}
          >
            {deletingAll ? (
              <div className="flex items-center justify-center">
                <svg className="animate-spin -ml-1 mr-3 h-4 w-4 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                </svg>
                Deleting...
              </div>
            ) : (
              "Delete All"
            )}
          </Button>
        </div>
      </div>
    </Modal>
  );
};
