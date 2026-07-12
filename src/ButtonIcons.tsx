import type { ReactNode } from "react";

interface ButtonIconProps {
  size?: number;
}

function ButtonIconSvg({
  size = 14,
  children,
}: ButtonIconProps & { children: ReactNode }) {
  return (
    <svg
      className="import-btn-icon"
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      {children}
    </svg>
  );
}

export function PencilIcon(props: ButtonIconProps) {
  return (
    <ButtonIconSvg {...props}>
      <path d="M12 20h9" />
      <path d="M16.5 3.5a2.121 2.121 0 0 1 3 3L7 19l-4 1 1-4L16.5 3.5z" />
    </ButtonIconSvg>
  );
}

export function UploadIcon(props: ButtonIconProps) {
  return (
    <ButtonIconSvg {...props}>
      <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
      <polyline points="7 10 12 15 17 10" />
      <line x1="12" y1="15" x2="12" y2="3" />
    </ButtonIconSvg>
  );
}

export function RefreshIcon(props: ButtonIconProps) {
  return (
    <ButtonIconSvg {...props}>
      <polyline points="23 4 23 10 17 10" />
      <polyline points="1 20 1 14 7 14" />
      <path d="M3.51 9a9 9 0 0 1 14.85-3.36L23 10M1 14l4.64 4.36A9 9 0 0 0 20.49 15" />
    </ButtonIconSvg>
  );
}

export function SaveFileIcon(props: ButtonIconProps) {
  return (
    <ButtonIconSvg {...props}>
      <path d="M19 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11l5 5v11a2 2 0 0 1-2 2z" />
      <polyline points="17 21 17 13 7 13 7 21" />
      <polyline points="7 3 7 8 15 8" />
    </ButtonIconSvg>
  );
}
