"use client";

/** @jsxRuntime automatic */
/** @jsxImportSource preact */

import { ENLARGE_DIALOG_STYLE } from "@takazudo/zudo-doc/island-types";
import { AFTER_NAVIGATE_EVENT } from "@takazudo/zudo-doc/transitions";
import { useModalDialog } from "@takazudo/zudo-doc/use-modal-dialog";

export type PreviewEnlargeDialogProps = {
  readonly children: React.ReactNode;
  readonly isOpen: boolean;
  readonly labelId: string;
  readonly onClose: () => void;
  readonly returnFocusRef: React.RefObject<HTMLElement | null>;
  readonly title: string;
  readonly variant: "footprint" | "model";
};

/** Shared native-dialog chrome for the controlled component preview adapters. */
export function PreviewEnlargeDialog({
  children,
  isOpen,
  labelId,
  onClose,
  returnFocusRef,
  title,
  variant,
}: PreviewEnlargeDialogProps) {
  const { dialogRef, handleBackdropClick } = useModalDialog({
    isOpen,
    onClose,
    navigateEvent: AFTER_NAVIGATE_EVENT,
    backdropClickClose: true,
    manageFocus: true,
    returnFocusRef,
  });

  return (
    <dialog
      ref={dialogRef}
      className={`zld-preview-dialog zld-preview-dialog--${variant} z-modal`}
      style={ENLARGE_DIALOG_STYLE}
      aria-labelledby={labelId}
      data-component-preview-dialog={variant}
      onClick={handleBackdropClick}
      onKeyDown={(event) => {
        if (event.key !== "Tab") return;
        const dialog = event.currentTarget;
        const focusable = [...dialog.querySelectorAll<HTMLElement>(
          'button:not([disabled]),a[href],[tabindex]:not([tabindex="-1"]),input:not([disabled]),select:not([disabled]),textarea:not([disabled])',
        )].filter((element) => element.getClientRects().length > 0);
        const first = focusable.at(0);
        const last = focusable.at(-1);
        if (first === undefined || last === undefined) {
          event.preventDefault();
          dialog.focus();
        } else if (event.shiftKey && document.activeElement === first) {
          event.preventDefault();
          last.focus();
        } else if (!event.shiftKey && document.activeElement === last) {
          event.preventDefault();
          first.focus();
        }
      }}
    >
      <button
        type="button"
        className="zld-preview-dialog__close"
        aria-label={`Close enlarged ${variant} preview`}
        onClick={() => dialogRef.current?.close()}
      >
        <svg
          className="zld-preview-dialog__close-icon"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
          aria-hidden="true"
          focusable="false"
        >
          <path d="M5 5l14 14M19 5L5 19" />
        </svg>
      </button>
      <h2 id={labelId} className="zld-preview-dialog__title">{title}</h2>
      <div className="zld-preview-dialog__content">
        {children}
      </div>
    </dialog>
  );
}
