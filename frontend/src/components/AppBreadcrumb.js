import React from 'react'
import { useLocation, Link } from 'react-router-dom'
import routes from '../routes'

const AppBreadcrumb = () => {
  const location = useLocation().pathname

  const getRouteName = (pathname, routes) => {
    const currentRoute = routes.find((route) => route.path === pathname)
    return currentRoute ? currentRoute.name : false
  }

  const getBreadcrumbs = (location) => {
    const breadcrumbs = []

    location.split('/').reduce((prev, curr, index, array) => {
      const currentPathname = `${prev}/${curr}`.replace(/\/+/g, '/')
      const routeName = getRouteName(currentPathname, routes)

      if (routeName) {
        breadcrumbs.push({
          pathname: currentPathname,
          name: routeName,
          active: index === array.length - 1,
        })
      }

      return currentPathname
    })

    return breadcrumbs
  }

  const breadcrumbs = getBreadcrumbs(location).filter(
    (breadcrumb) => breadcrumb.pathname !== '/dashboard',
  )

  return (
    <nav className="app-breadcrumb" aria-label="breadcrumb" key={location}>
      <ol className="breadcrumb my-0">
        <li className="breadcrumb-item" style={{ '--breadcrumb-index': 0 }}>
          {location === '/dashboard' || location === '/' ? (
            'Dashboard'
          ) : (
            <Link to="/dashboard">Dashboard</Link>
          )}
        </li>

        {breadcrumbs.map((breadcrumb, index) => (
          <li
            key={index}
            className={`breadcrumb-item ${breadcrumb.active ? 'active' : ''}`}
            style={{ '--breadcrumb-index': index + 1 }}
            {...(breadcrumb.active && { 'aria-current': 'page' })}
          >
            {breadcrumb.active ? (
              breadcrumb.name
            ) : (
              <Link to={breadcrumb.pathname}>{breadcrumb.name}</Link>
            )}
          </li>
        ))}
      </ol>
    </nav>
  )
}

export default React.memo(AppBreadcrumb)
