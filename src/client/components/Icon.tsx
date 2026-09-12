type IconName =
  | "phone"
  | "phoneOff"
  | "briefcase"
  | "building"
  | "message"
  | "flag"
  | "check"
  | "copy"
  | "userOff"
  | "row";

function Glyph({ name }: { name: IconName }) {
  if (name === "phone") {
    return (
      <path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07 19.5 19.5 0 0 1-6-6 19.79 19.79 0 0 1-3.07-8.67A2 2 0 0 1 4.11 2h3a2 2 0 0 1 2 1.72c.127.96.361 1.903.7 2.81a2 2 0 0 1-.45 2.11L8.09 9.91a16 16 0 0 0 6 6l1.27-1.27a2 2 0 0 1 2.11-.45c.907.339 1.85.573 2.81.7A2 2 0 0 1 22 16.92z" />
    );
  }
  if (name === "phoneOff") {
    return (
      <>
        <path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07 19.5 19.5 0 0 1-6-6 19.79 19.79 0 0 1-3.07-8.67A2 2 0 0 1 4.11 2h3a2 2 0 0 1 2 1.72c.127.96.361 1.903.7 2.81a2 2 0 0 1-.45 2.11L8.09 9.91a16 16 0 0 0 6 6l1.27-1.27a2 2 0 0 1 2.11-.45c.907.339 1.85.573 2.81.7A2 2 0 0 1 22 16.92z" />
        <path d="M2 2l20 20" />
      </>
    );
  }
  if (name === "briefcase") {
    return (
      <>
        <rect x="2" y="7" width="20" height="14" rx="2" />
        <path d="M16 21V5a2 2 0 0 0-2-2h-4a2 2 0 0 0-2 2v16" />
      </>
    );
  }
  if (name === "building") {
    return (
      <>
        <path d="M6 22V4a2 2 0 0 1 2-2h8a2 2 0 0 1 2 2v18" />
        <path d="M6 12H4a2 2 0 0 0-2 2v6a2 2 0 0 0 2 2h2" />
        <path d="M18 9h2a2 2 0 0 1 2 2v9a2 2 0 0 1-2 2h-2" />
        <path d="M10 6h4M10 10h4M10 14h4M10 18h4" />
      </>
    );
  }
  if (name === "message") {
    return <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" />;
  }
  if (name === "flag") {
    return <path d="M4 15s1-1 4-1 5 2 8 2 4-1 4-1V3s-1 1-4 1-5-2-8-2-4 1-4 1zM4 22v-7" />;
  }
  if (name === "check") {
    return <path d="M20 6 9 17l-5-5" />;
  }
  if (name === "copy") {
    return (
      <>
        <rect x="9" y="9" width="13" height="13" rx="2" />
        <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1" />
      </>
    );
  }
  if (name === "userOff") {
    return (
      <>
        <path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2" />
        <circle cx="9" cy="7" r="4" />
        <line x1="17" x2="22" y1="8" y2="13" />
        <line x1="22" x2="17" y1="8" y2="13" />
      </>
    );
  }
  return (
    <>
      <path d="M3 6h18M3 12h18M3 18h18" />
    </>
  );
}

export function Icon({
  name,
  className = "text-muted",
  size = 16,
  title
}: {
  name: IconName;
  className?: string;
  size?: number;
  title?: string;
}) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={1.75}
      strokeLinecap="round"
      strokeLinejoin="round"
      className={`shrink-0 ${className}`}
      aria-hidden={title ? undefined : true}
      role={title ? "img" : undefined}
      aria-label={title}
    >
      {title ? <title>{title}</title> : null}
      <Glyph name={name} />
    </svg>
  );
}

export function QuoteMark({ className = "text-accent/40" }: { className?: string }) {
  return (
    <svg
      width={28}
      height={22}
      viewBox="0 0 24 18"
      fill="currentColor"
      className={`shrink-0 ${className}`}
      aria-hidden="true"
    >
      <path d="M0 18V8.2C0 3.6 2.8.8 7.4 0L8.6 3.2C5.8 4 4.2 5.6 4.2 8.2H9V18H0zm13.4 0V8.2C13.4 3.6 16.2.8 20.8 0L22 3.2C19.2 4 17.6 5.6 17.6 8.2H22.4V18h-9z" />
    </svg>
  );
}
