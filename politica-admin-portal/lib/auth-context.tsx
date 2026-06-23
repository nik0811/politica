"use client"

import React, { createContext, useContext, useState, useEffect } from "react"
import { getToken, clearToken, isAuthenticated as checkToken } from "@/lib/api-client"

interface AuthContextType {
  isAuthenticated: boolean
  isLoading: boolean
  username: string | null
  logout: () => void
  refreshAuth: () => void
}

const AuthContext = createContext<AuthContextType>({
  isAuthenticated: false,
  isLoading: true,
  username: null,
  logout: () => {},
  refreshAuth: () => {},
})

function parseTokenUsername(token: string): string | null {
  try {
    const payload = JSON.parse(atob(token.split(".")[1]))
    return payload.sub || payload.username || null
  } catch {
    return null
  }
}

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [isAuthenticated, setIsAuthenticated] = useState(false)
  const [isLoading, setIsLoading] = useState(true)
  const [username, setUsername] = useState<string | null>(null)

  const checkAuthStatus = () => {
    const token = getToken()
    const hasToken = !!token
    setIsAuthenticated(hasToken)
    if (hasToken && token) {
      setUsername(parseTokenUsername(token) || "Admin")
    } else {
      setUsername(null)
    }
    setIsLoading(false)
  }

  useEffect(() => {
    checkAuthStatus()
  }, [])

  const logout = () => {
    clearToken()
    setIsAuthenticated(false)
    setUsername(null)
    if (typeof window !== "undefined") {
      window.location.href = "/login"
    }
  }

  const refreshAuth = () => {
    checkAuthStatus()
  }

  return (
    <AuthContext.Provider value={{ isAuthenticated, isLoading, username, logout, refreshAuth }}>
      {children}
    </AuthContext.Provider>
  )
}

export function useAuth() {
  return useContext(AuthContext)
}
