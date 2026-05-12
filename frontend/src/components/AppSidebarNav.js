import React, { useState } from 'react'
import { NavLink } from 'react-router-dom'
import PropTypes from 'prop-types'
import SimpleBar from 'simplebar-react'
import 'simplebar-react/dist/simplebar.min.css'

const SidebarItemLabel = ({ name, icon, badge, indent = false }) => {
  return (
    <div className="sidebar-item-content">
      <div className="sidebar-item-left">
        {icon ? (
          <span className="sidebar-item-icon">{icon}</span>
        ) : (
          indent && <span className="sidebar-item-dot">•</span>
        )}

        <span className="sidebar-item-text">{name}</span>
      </div>

      {badge && <span className={`badge bg-${badge.color || 'primary'} ms-2`}>{badge.text}</span>}
    </div>
  )
}

SidebarItemLabel.propTypes = {
  name: PropTypes.string,
  icon: PropTypes.node,
  badge: PropTypes.shape({
    color: PropTypes.string,
    text: PropTypes.string,
  }),
  indent: PropTypes.bool,
}

const SidebarNavItem = ({ item, indent = false }) => {
  const { name, badge, icon, to, href } = item

  const content = <SidebarItemLabel name={name} icon={icon} badge={badge} indent={indent} />

  if (to) {
    return (
      <li className="sidebar-nav-item">
        <NavLink
          to={to}
          className={({ isActive }) => `sidebar-nav-link ${isActive ? 'active' : ''}`}
        >
          {content}
        </NavLink>
      </li>
    )
  }

  if (href) {
    return (
      <li className="sidebar-nav-item">
        <a href={href} target="_blank" rel="noopener noreferrer" className="sidebar-nav-link">
          {content}
        </a>
      </li>
    )
  }

  return (
    <li className="sidebar-nav-item">
      <span className="sidebar-nav-link">{content}</span>
    </li>
  )
}

SidebarNavItem.propTypes = {
  item: PropTypes.object.isRequired,
  indent: PropTypes.bool,
}

const SidebarNavGroup = ({ item }) => {
  const { name, icon, badge, items = [] } = item
  const [open, setOpen] = useState(false)

  return (
    <li className={`sidebar-nav-item sidebar-nav-group ${open ? 'open' : ''}`}>
      <button
        type="button"
        className="sidebar-nav-link sidebar-nav-group-toggle"
        onClick={() => setOpen(!open)}
      >
        <SidebarItemLabel name={name} icon={icon} badge={badge} />
        <span className="sidebar-group-arrow">
          <i className={`bi ${open ? 'bi-chevron-down' : 'bi-chevron-right'}`}></i>
        </span>
      </button>

      <div className={`sidebar-group-collapse ${open ? 'show' : ''}`}>
        <ul className="sidebar-group-list">
          {items.map((child, index) =>
            child.items ? (
              <SidebarNavGroup key={index} item={child} />
            ) : (
              <SidebarNavItem key={index} item={child} indent />
            ),
          )}
        </ul>
      </div>
    </li>
  )
}

SidebarNavGroup.propTypes = {
  item: PropTypes.object.isRequired,
}

export const AppSidebarNav = ({ items }) => {
  return (
    <div className="sidebar-nav-wrap">
      <SimpleBar className="sidebar-simplebar">
        <ul className="sidebar-nav">
          {items?.map((item, index) =>
            item.items ? (
              <SidebarNavGroup key={index} item={item} />
            ) : (
              <SidebarNavItem key={index} item={item} />
            ),
          )}
        </ul>
      </SimpleBar>
    </div>
  )
}

AppSidebarNav.propTypes = {
  items: PropTypes.arrayOf(PropTypes.any).isRequired,
}
