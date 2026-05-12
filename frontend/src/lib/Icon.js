import React from 'react'

const CIcon = ({ icon, className = '', size, ...props }) => {
  const iconClass = typeof icon === 'string' ? icon : ''
  const sizeClass = size === 'sm' ? 'fs-6' : size === 'lg' ? 'fs-4' : ''

  return <i className={['bi', iconClass, sizeClass, className].filter(Boolean).join(' ')} {...props} />
}

export default CIcon
