import {
  createContext,
  useContext,
  useState,
  useEffect,
  useCallback,
} from 'react'
import api from '../lib/axios'

const AuthContext = createContext(undefined)

export const AuthProvider = ({ children }) => {
  const [user, setUser] = useState(null)
  const [loading, setLoading] = useState(true)

  const fetchUser = useCallback(async () => {
    try {
      const { data } = await api.get('/auth/me')
      setUser(data)
      return data
    } catch (error) {
      setUser(null)
      localStorage.removeItem('access_token')
      return null
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    const token = localStorage.getItem('access_token')

    if (token) {
      fetchUser()
    } else {
      setLoading(false)
    }
  }, [fetchUser])

  const login = async (token) => {
    localStorage.setItem('access_token', token)
    setLoading(true)
    return await fetchUser()
  }

  const logout = useCallback(() => {
    localStorage.removeItem('access_token')
    setUser(null)
    setLoading(false)
  }, [])

  const isAuthenticated = Boolean(user)

  return (
    <AuthContext.Provider
      value={{
        user,
        loading,
        login,
        logout,
        isAuthenticated,
      }}
    >
      {children}
    </AuthContext.Provider>
  )
}

export const useAuth = () => {
  const context = useContext(AuthContext)

  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider')
  }

  return context
}
