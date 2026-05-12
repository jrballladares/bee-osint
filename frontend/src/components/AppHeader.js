import React from 'react'
import { useDispatch, useSelector } from 'react-redux'
import { AppBreadcrumb } from './index'
import { AppHeaderDropdown, AppHeaderNotifications } from './header/index'
import AppOpenTabs from './AppOpenTabs'

const AppHeader = () => {
  const dispatch = useDispatch()
  const sidebarShow = useSelector((state) => state.sidebarShow)

  const toggleSidebar = () => {
    dispatch({ type: 'set', sidebarShow: !sidebarShow })
  }

  return (
    <header className="sticky-top bg-body app-header">
      <div className="container-fluid px-0">
        <div className="app-header-main d-flex align-items-center justify-content-between">
          <div className="d-flex align-items-center min-w-0">
            <div className="sidebar-collapse-cell">
              <button
                type="button"
                className="sidebar-collapse-toggle"
                aria-label={sidebarShow ? 'Replegar sidebar' : 'Expandir sidebar'}
                title={sidebarShow ? 'Replegar sidebar' : 'Expandir sidebar'}
                onClick={toggleSidebar}
              >
                <i className="bi bi-list"></i>
              </button>
            </div>

            <div className="app-header-breadcrumb">
              <AppBreadcrumb />
            </div>
          </div>

          <ul className="nav align-items-center ms-auto app-header-actions">
            <li className="nav-item">
              <AppHeaderNotifications />
            </li>
            <li className="nav-item">
              <AppHeaderDropdown />
            </li>
          </ul>
        </div>
      </div>
      <AppOpenTabs />
    </header>
  )
}

export default AppHeader
