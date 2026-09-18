"use client";

import { useCallback, useEffect, useState } from "react";
import { readStored, writeStored } from "@/lib/local";

const STORAGE_KEY = "readlet:reader:desktop-contents-open";
const WIDE_SCREEN = "(min-width: 1280px)";

/** One panel selection, presented beside the page on desktop and over it on mobile. */
export function useReaderPanel<Panel extends string>(initial: Panel) {
  const [panel, setPanel] = useState<Panel>(initial);
  const [desktopOpen, setDesktopOpen] = useState(true);
  const [mobileOpen, setMobileOpen] = useState(false);
  const [wide, setWide] = useState(false);

  useEffect(() => {
    setDesktopOpen(readStored(STORAGE_KEY) !== "closed");
    const query = window.matchMedia(WIDE_SCREEN);
    const update = () => {
      setWide(query.matches);
      if (query.matches) setMobileOpen(false);
    };
    update();
    query.addEventListener("change", update);
    return () => query.removeEventListener("change", update);
  }, []);

  const toggle = useCallback(
    (next: Panel) => {
      if (wide) {
        const open = panel !== next || !desktopOpen;
        setPanel(next);
        setDesktopOpen(open);
        writeStored(STORAGE_KEY, open ? "open" : "closed");
      } else {
        setPanel(next);
        setMobileOpen((open) => (panel === next ? !open : true));
      }
    },
    [desktopOpen, panel, wide],
  );

  const open = useCallback(
    (next: Panel) => {
      setPanel(next);
      if (wide) {
        setDesktopOpen(true);
        writeStored(STORAGE_KEY, "open");
      } else {
        setMobileOpen(true);
      }
    },
    [wide],
  );

  const close = useCallback(() => {
    if (wide) {
      setDesktopOpen(false);
      writeStored(STORAGE_KEY, "closed");
    } else {
      setMobileOpen(false);
    }
  }, [wide]);

  const closeAfterGo = useCallback(() => setMobileOpen(false), []);

  return {
    panel,
    desktopOpen,
    mobileOpen,
    visible: wide ? desktopOpen : mobileOpen,
    toggle,
    open,
    close,
    closeAfterGo,
  };
}
