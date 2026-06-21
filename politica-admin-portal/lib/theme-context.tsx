"use client"

import { createContext, useContext, useEffect, useState, useCallback } from "react"

type Theme = "light" | "dark" | "system"

interface ThemeContextValue {
  theme: Theme
  resolvedTheme: "light" | "dark"
  setTheme: (theme: Theme) => void
}

const ThemeContext = createContext<ThemeContextValue>({
  theme: "system",
  resolvedTheme: "dark",
  setTheme: () => {},
})

export function ThemeProvider({ children }: { children: React.ReactNode }) {
  const [theme, setThemeState] = useState<Theme>("system")
  const [resolvedTheme, setResolvedTheme] = useState<"light" | "dark">("dark")

  const applyTheme = useCallback((t: Theme) => {
    const root = document.documentElement
    let resolved: "light" | "dark"

    if (t === "system") {
      resolved = window.matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light"
    } else {
      resolved = t
    }

    root.classList.remove("light", "dark")
    root.classList.add(resolved)
    root.setAttribute("data-theme", resolved)
    setResolvedTheme(resolved)
  }, [])

  // Init from localStorage
  useEffect(() => {
    const stored = (localStorage.getItem("politica-theme") as Theme) || "system"
    setThemeState(stored)
    applyTheme(stored)
  }, [applyTheme])

  // Listen to system preference changes
  useEffect(() => {
    if (theme !== "system") return
    const mq = window.matchMedia("(prefers-color-scheme: dark)")
    const handler = () => applyTheme("system")
    mq.addEventListener("change", handler)
    return () => mq.removeEventListener("change", handler)
  }, [theme, applyTheme])

  const setTheme = useCallback(
    (t: Theme) => {
      setThemeState(t)
      localStorage.setItem("politica-theme", t)
      applyTheme(t)
    },
    [applyTheme]
  )

  return (
    <ThemeContext.Provider value={{ theme, resolvedTheme, setTheme }}>
      {children}
    </ThemeContext.Provider>
  )
}

export function useTheme() {
  return useContext(ThemeContext)
}
