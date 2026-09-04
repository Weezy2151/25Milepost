"use client";

import { useEffect } from "react";

/**
 * Registers the offline service worker, once the page has settled.
 *
 * Deliberately after load: the worker exists to make a second visit work
 * without a signal, and it must not compete with the first one for bandwidth.
 * Registration failing is not worth troubling anyone about — the site works
 * exactly as before without it.
 */
export function ServiceWorker() {
  useEffect(() => {
    if (!("serviceWorker" in navigator) || process.env.NODE_ENV !== "production") return;

    const register = () => {
      navigator.serviceWorker.register("/sw.js").catch(() => {
        /* offline support is an enhancement, never a requirement */
      });
    };

    if (document.readyState === "complete") register();
    else {
      window.addEventListener("load", register);
      return () => window.removeEventListener("load", register);
    }
  }, []);

  return null;
}
