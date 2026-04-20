import React, { useEffect } from "react";
import { useLocation } from "react-router-dom";

export function ThemeConfig() {
  const location = useLocation();

  useEffect(() => {
    fetch("/api/settings")
      .then((res) => res.json())
      .then((data) => {
        if (data.themeAccentColor) {
           // Provide a slight fallback for the "hover" effect of the accent color
           // Since tailwind automatically generates colors, but we use hardcoded #cc0029 for hover in some places.
           // Setting the main variable
           document.documentElement.style.setProperty('--color-mpl-accent', data.themeAccentColor);
        }
      })
      .catch(console.error);
  }, [location.pathname]); // Re-fetch on navigation across admin/public

  return null;
}
