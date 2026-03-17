export type ThemePreference = "light" | "dark" | "system";

const THEME_STORAGE_KEY = "promin_theme";
const SETTINGS_STORAGE_KEY = "promin_settings";

function getSystemTheme(): "light" | "dark" {
  if (typeof window === "undefined") return "dark";
  return window.matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light";
}

export function resolveTheme(preference: ThemePreference): "light" | "dark" {
  return preference === "system" ? getSystemTheme() : preference;
}

export function readStoredTheme(): ThemePreference {
  if (typeof window === "undefined") return "system";

  const storedTheme = localStorage.getItem(THEME_STORAGE_KEY);
  if (storedTheme === "light" || storedTheme === "dark" || storedTheme === "system") {
    return storedTheme;
  }

  try {
    const rawSettings = localStorage.getItem(SETTINGS_STORAGE_KEY);
    if (!rawSettings) return "system";
    const parsed = JSON.parse(rawSettings);
    const legacyTheme = parsed?.general?.theme;

    if (legacyTheme === "light" || legacyTheme === "dark") return legacyTheme;
    if (legacyTheme === "auto") return "system";
  } catch {
    // Ignore malformed settings, fallback to system
  }

  return "system";
}

export function applyTheme(preference: ThemePreference): void {
  if (typeof document === "undefined") return;
  const root = document.documentElement;
  root.setAttribute("data-theme", resolveTheme(preference));
}

export function persistTheme(preference: ThemePreference): void {
  if (typeof window === "undefined") return;
  localStorage.setItem(THEME_STORAGE_KEY, preference);

  // Keep compatibility with existing settings payload.
  try {
    const rawSettings = localStorage.getItem(SETTINGS_STORAGE_KEY);
    const parsed = rawSettings ? JSON.parse(rawSettings) : {};
    const mappedTheme = preference === "system" ? "auto" : preference;
    const merged = {
      ...parsed,
      general: {
        ...(parsed?.general ?? {}),
        theme: mappedTheme,
      },
    };
    localStorage.setItem(SETTINGS_STORAGE_KEY, JSON.stringify(merged));
  } catch {
    // Ignore storage serialization failures
  }
}

export function watchSystemTheme(onChange: () => void): () => void {
  if (typeof window === "undefined") return () => {};
  const media = window.matchMedia("(prefers-color-scheme: dark)");
  const handler = () => onChange();
  media.addEventListener("change", handler);
  return () => media.removeEventListener("change", handler);
}
