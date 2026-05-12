import React from 'react'
import { useLocation } from 'react-router-dom'
import { AppContent, AppSidebar, AppHeader } from '../components/index'

const DefaultLayout = () => {
  const location = useLocation()

  const isGraphFullscreen =
    location.pathname === '/graph' || location.pathname.startsWith('/graph/')

  if (isGraphFullscreen) {
    return (
      <div className="min-vh-100">
        <AppContent />
      </div>
    )
  }

  return (
    <div className="app-layout min-vh-100">
      <AppSidebar />

      <div className="wrapper d-flex flex-column min-vh-100">
        <AppHeader />

        <div className="body flex-grow-1">
          <AppContent />
        </div>
      </div>
    </div>
  )
}

export default DefaultLayout