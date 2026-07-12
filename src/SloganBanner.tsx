import { useCallback, useEffect, useRef, useState } from "react";

const LAST_DISMISSED_DATE_KEY = "freediving-log-explorer:lastDismissedDate";

function todayDateString(): string {
  return new Date().toLocaleDateString("en-CA");
}

function wasDismissedToday(): boolean {
  return localStorage.getItem(LAST_DISMISSED_DATE_KEY) === todayDateString();
}

export default function SloganBanner() {
  const bannerRef = useRef<HTMLDivElement>(null);
  const [visible, setVisible] = useState(() => !wasDismissedToday());
  const [spacerHeight, setSpacerHeight] = useState(0);

  useEffect(() => {
    if (!visible || !bannerRef.current) return;

    const updateSpacerHeight = () => {
      setSpacerHeight(bannerRef.current?.offsetHeight ?? 0);
    };

    updateSpacerHeight();

    const observer = new ResizeObserver(updateSpacerHeight);
    observer.observe(bannerRef.current);

    return () => observer.disconnect();
  }, [visible]);

  const dismiss = useCallback(() => {
    localStorage.setItem(LAST_DISMISSED_DATE_KEY, todayDateString());
    setVisible(false);
    setSpacerHeight(0);
  }, []);

  if (!visible) return null;

  return (
    <>
      <div ref={bannerRef} className="motivational-banner" role="status">
        <p className="motivational-banner-text">
          Don't dive for numbers... but once you have them, explore them!
        </p>
        <button
          type="button"
          className="motivational-banner-dismiss"
          aria-label="Dismiss banner"
          onClick={dismiss}
        >
          ×
        </button>
      </div>
      <div
        className="motivational-banner-spacer"
        style={{ height: spacerHeight }}
        aria-hidden="true"
      />
    </>
  );
}
