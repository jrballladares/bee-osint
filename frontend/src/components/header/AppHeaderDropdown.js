import React from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '../../contexts/AuthContext'

import avatar from './../../assets/images/avatars/user1.svg'

const AppHeaderDropdown = () => {
  const { logout } = useAuth()
  const navigate = useNavigate()

  const handleLogout = () => {
    logout()
    navigate('/login')
  }

  return (
    <div className="dropdown user-menu">
      <button
        className="btn user-menu-toggle d-flex align-items-center p-0 border-0"
        type="button"
        data-bs-toggle="dropdown"
        aria-expanded="false"
      >
        <img src={avatar} alt="User" className="rounded-circle" width="36" height="36" />
      </button>

      <ul className="dropdown-menu dropdown-menu-end user-menu-dropdown">
        <li>
          <button className="dropdown-item user-menu-item" type="button">
            <i className="bi bi-person"></i>
            Profile
          </button>
        </li>

        <li>
          <button className="dropdown-item user-menu-item" type="button">
            <i className="bi bi-gear"></i>
            Settings
          </button>
        </li>

        <li>
          <hr className="dropdown-divider" />
        </li>

        <li>
          <button
            className="dropdown-item user-menu-item user-menu-item-danger"
            type="button"
            onClick={handleLogout}
          >
            <i className="bi bi-box-arrow-right"></i>
            Log out
          </button>
        </li>
      </ul>
    </div>
  )
}

export default AppHeaderDropdown
