import React from 'react'
import { useSelector } from 'react-redux'
import { AppSidebarNav } from './AppSidebarNav'
import navigation from '../_nav'

const AppSidebar = () => {
  const sidebarShow = useSelector((state) => state.sidebarShow)

  return (
    <aside className={`app-sidebar ${sidebarShow ? '' : 'collapsed'}`}>
      <div className="d-flex flex-column h-100">
        <div className="flex-grow-1 overflow-hidden">
          <AppSidebarNav items={navigation} />
        </div>
      </div>
    </aside>
  )
}

export default React.memo(AppSidebar)
