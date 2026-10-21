import { useEffect, useRef, type ReactNode } from "react";
import { X } from "lucide-react";

let lockedModalCount = 0;
let modalScrollY = 0;
let previousBodyPosition = "";
let previousBodyTop = "";
let previousBodyLeft = "";
let previousBodyRight = "";
let previousBodyWidth = "";
let previousBodyOverflow = "";
let previousHtmlOverflow = "";
let previousHtmlScrollBehavior = "";

function lockDocumentScroll() {
  if (lockedModalCount === 0) {
    modalScrollY = window.scrollY;
    previousBodyPosition = document.body.style.position;
    previousBodyTop = document.body.style.top;
    previousBodyLeft = document.body.style.left;
    previousBodyRight = document.body.style.right;
    previousBodyWidth = document.body.style.width;
    previousBodyOverflow = document.body.style.overflow;
    previousHtmlOverflow = document.documentElement.style.overflow;
    previousHtmlScrollBehavior = document.documentElement.style.scrollBehavior;

    document.documentElement.style.overflow = "hidden";
    document.body.style.position = "fixed";
    document.body.style.top = `-${modalScrollY}px`;
    document.body.style.left = "0";
    document.body.style.right = "0";
    document.body.style.width = "100%";
    document.body.style.overflow = "hidden";
  }
  lockedModalCount += 1;
}

function unlockDocumentScroll() {
  lockedModalCount = Math.max(0, lockedModalCount - 1);
  if (lockedModalCount !== 0) return;

  document.body.style.position = previousBodyPosition;
  document.body.style.top = previousBodyTop;
  document.body.style.left = previousBodyLeft;
  document.body.style.right = previousBodyRight;
  document.body.style.width = previousBodyWidth;
  document.body.style.overflow = previousBodyOverflow;
  document.documentElement.style.overflow = previousHtmlOverflow;
  document.documentElement.style.scrollBehavior = "auto";
  window.scrollTo({ top: modalScrollY, left: 0, behavior: "auto" });
  document.documentElement.style.scrollBehavior = previousHtmlScrollBehavior;
}

export function ProgressBar({
  value,
  color = "var(--accent)",
  className = "",
}: {
  value: number;
  color?: string;
  className?: string;
}) {
  return (
    <div className={`progress-track ${className}`} aria-hidden="true">
      <span style={{ width: `${Math.max(0, Math.min(100, value))}%`, background: color }} />
    </div>
  );
}

export function Modal({
  children,
  onClose,
  className = "",
  labelledBy,
}: {
  children: ReactNode;
  onClose: () => void;
  className?: string;
  labelledBy?: string;
}) {
  const onCloseRef = useRef(onClose);
  onCloseRef.current = onClose;

  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") onCloseRef.current();
    };
    window.addEventListener("keydown", handleKeyDown);
    lockDocumentScroll();
    return () => {
      window.removeEventListener("keydown", handleKeyDown);
      unlockDocumentScroll();
    };
  }, []);

  return (
    <div className="modal-backdrop" role="presentation" onMouseDown={onClose}>
      <section
        className={`modal ${className}`}
        role="dialog"
        aria-modal="true"
        aria-labelledby={labelledBy}
        onMouseDown={(event) => event.stopPropagation()}
      >
        {children}
      </section>
    </div>
  );
}

export function CloseButton({ onClick }: { onClick: () => void }) {
  return (
    <button className="icon-button" type="button" onClick={onClick} aria-label="Close dialog">
      <X size={20} />
    </button>
  );
}

export function EmptyState({
  icon,
  title,
  children,
  action,
}: {
  icon: ReactNode;
  title: string;
  children: ReactNode;
  action?: ReactNode;
}) {
  return (
    <div className="empty-state">
      <div className="empty-icon">{icon}</div>
      <h3>{title}</h3>
      <p>{children}</p>
      {action}
    </div>
  );
}

export function CardImage({
  src,
  alt,
  className = "",
}: {
  src?: string;
  alt: string;
  className?: string;
}) {
  if (!src) {
    return (
      <div className={`card-image-placeholder ${className}`} aria-hidden="true">
        <span className="pokeball-mark" aria-hidden="true" />
        <span>Image unavailable</span>
      </div>
    );
  }
  return (
    <img
      className={className}
      src={src}
      alt={alt}
      loading="lazy"
      decoding="async"
      onError={(event) => {
        event.currentTarget.src = `${import.meta.env.BASE_URL}card-placeholder.svg`;
        event.currentTarget.onerror = null;
      }}
    />
  );
}
