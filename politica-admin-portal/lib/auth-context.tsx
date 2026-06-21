"use client"

import React, { createContext, useContext, useState, useEffect } from "react"
import { ADMIN_USER } from "@/lib/mock-data"

interface AuthContextType {
  isAuthenticated: boolean
  username: string | null
  login: (username: string, password: string) => boolean
  logout: () => void
}

const AuthContext = createContext<AuthContextType>({
  isAuthenticated: false,
  username: null,
  login: () => false,
  logout: () => {},
})

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [isAuthenticated, setIsAuthenticated] = useState(false)
  const [username, setUsername] = useState<string | null>(null)

  useEffect(() => {
    const stored = sessionStorage.getItem("politica_auth")
    if (stored) {
      const { user } = JSON.parse(stored)
      setIsAuthenticated(true)
      setUsername(user)
    }
  }, [])

  const login = (user: string, pass: string): boolean => {
    if (user === ADMIN_USER.username && pass === ADMIN_USER.password) {
      setIsAuthenticated(true)
      setUsername(user)
      sessionStorage.setItem("politica_auth", JSON.stringify({ user }))
      return true
    }
    return false
  }

  const logout = () => {
    setIsAuthenticated(false)
    setUsername(null)
    sessionStorage.removeItem("politica_auth")
  }

  return (
    <AuthContext.Provider value={{ isAuthenticated, username, login, logout }}>
      {children}
    </AuthContext.Provider>
  )
}

export function useAuth() {
  return useContext(AuthContext)
}
