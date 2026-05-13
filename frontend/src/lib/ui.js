import React from 'react'

const join = (...classes) => classes.filter(Boolean).join(' ')

const colorClass = (prefix, color) => (color ? `${prefix}-${color}` : '')

const colClass = ({ xs, sm, md, lg, xl, xxl }) =>
  [
    xs === true ? 'col' : xs ? `col-${xs}` : '',
    sm ? `col-sm-${sm}` : '',
    md ? `col-md-${md}` : '',
    lg ? `col-lg-${lg}` : '',
    xl ? `col-xl-${xl}` : '',
    xxl ? `col-xxl-${xxl}` : '',
  ]
    .filter(Boolean)
    .join(' ') || 'col'

export const useColorModes = () => ({
  isColorModeSet: () => Boolean(document.documentElement.dataset.theme),
  setColorMode: (theme) => {
    if (theme) {
      document.documentElement.dataset.theme = theme
    }
  },
})

export const CButton = ({
  as: Component = 'button',
  color = 'primary',
  variant,
  size,
  className,
  children,
  ...props
}) => {
  const buttonClass =
    variant === 'outline' ? colorClass('btn-outline', color) : colorClass('btn', color)

  return (
    <Component
      className={join('btn', buttonClass, size ? `btn-${size}` : '', className)}
      {...props}
    >
      {children}
    </Component>
  )
}

export const CCard = ({ className, children, ...props }) => (
  <div className={join('card', className)} {...props}>
    {children}
  </div>
)

export const CCardBody = ({ className, children, ...props }) => (
  <div className={join('card-body', className)} {...props}>
    {children}
  </div>
)

export const CCardHeader = ({ className, children, ...props }) => (
  <div className={join('card-header', className)} {...props}>
    {children}
  </div>
)

export const CCardGroup = ({ className, children, ...props }) => (
  <div className={join('card-group', className)} {...props}>
    {children}
  </div>
)

export const CContainer = ({ fluid, className, children, ...props }) => (
  <div className={join(fluid ? 'container-fluid' : 'container', className)} {...props}>
    {children}
  </div>
)

export const CRow = ({ className, children, ...props }) => (
  <div className={join('row', className)} {...props}>
    {children}
  </div>
)

export const CCol = ({ className, children, xs, sm, md, lg, xl, xxl, ...props }) => (
  <div className={join(colClass({ xs, sm, md, lg, xl, xxl }), className)} {...props}>
    {children}
  </div>
)

export const CForm = ({ className, children, ...props }) => (
  <form className={className} {...props}>
    {children}
  </form>
)

export const CFormLabel = ({ className, children, ...props }) => (
  <label className={join('form-label', className)} {...props}>
    {children}
  </label>
)

export const CFormInput = React.forwardRef(({ className, invalid, valid, ...props }, ref) => (
  <input
    ref={ref}
    className={join(
      'form-control',
      invalid ? 'is-invalid' : '',
      valid ? 'is-valid' : '',
      className,
    )}
    {...props}
  />
))

CFormInput.displayName = 'CFormInput'

export const CFormTextarea = React.forwardRef(({ className, invalid, valid, ...props }, ref) => (
  <textarea
    ref={ref}
    className={join(
      'form-control',
      invalid ? 'is-invalid' : '',
      valid ? 'is-valid' : '',
      className,
    )}
    {...props}
  />
))

CFormTextarea.displayName = 'CFormTextarea'

export const CFormSelect = React.forwardRef(
  ({ className, children, invalid, valid, ...props }, ref) => (
    <select
      ref={ref}
      className={join(
        'form-select',
        invalid ? 'is-invalid' : '',
        valid ? 'is-valid' : '',
        className,
      )}
      {...props}
    >
      {children}
    </select>
  ),
)

CFormSelect.displayName = 'CFormSelect'

export const CFormSwitch = ({ className, label, id, ...props }) => {
  const input = (
    <input id={id} className={join('form-check-input', className)} type="checkbox" {...props} />
  )

  if (!label) {
    return <div className="form-check form-switch mb-0">{input}</div>
  }

  return (
    <div className="form-check form-switch">
      {input}
      <label className="form-check-label" htmlFor={id}>
        {label}
      </label>
    </div>
  )
}

export const CInputGroup = ({ className, children, ...props }) => (
  <div className={join('input-group', className)} {...props}>
    {children}
  </div>
)

export const CInputGroupText = ({ className, children, ...props }) => (
  <span className={join('input-group-text', className)} {...props}>
    {children}
  </span>
)

export const CAlert = ({ color = 'primary', className, children, ...props }) => (
  <div className={join('alert', colorClass('alert', color), className)} role="alert" {...props}>
    {children}
  </div>
)

export const CBadge = ({ color = 'primary', className, children, ...props }) => (
  <span className={join('badge', colorClass('bg', color), className)} {...props}>
    {children}
  </span>
)

export const CSpinner = ({ color = 'primary', size, className, variant, ...props }) => (
  <span
    className={join(
      variant === 'grow' ? 'spinner-grow' : 'spinner-border',
      color ? `text-${color}` : '',
      size === 'sm' ? (variant === 'grow' ? 'spinner-grow-sm' : 'spinner-border-sm') : '',
      className,
    )}
    role="status"
    aria-hidden="true"
    {...props}
  />
)

export const CPagination = ({ className, children, ...props }) => (
  <ul className={join('pagination', className)} {...props}>
    {children}
  </ul>
)

export const CPaginationItem = ({ active, disabled, className, children, onClick, ...props }) => (
  <li className={join('page-item', active ? 'active' : '', disabled ? 'disabled' : '', className)}>
    <button
      type="button"
      className="page-link"
      disabled={disabled}
      onClick={disabled ? undefined : onClick}
      {...props}
    >
      {children}
    </button>
  </li>
)

export const CModal = ({
  visible,
  onClose,
  size,
  alignment,
  scrollable,
  backdrop = true,
  className,
  children,
  ...props
}) => {
  React.useEffect(() => {
    if (!visible || typeof document === 'undefined') return undefined

    const previousOverflow = document.body.style.overflow
    document.body.classList.add('modal-open')
    document.body.style.overflow = 'hidden'

    return () => {
      document.body.classList.remove('modal-open')
      document.body.style.overflow = previousOverflow
    }
  }, [visible])

  if (!visible) return null

  return (
    <>
      <div
        className={join('modal fade show d-block', className)}
        tabIndex="-1"
        role="dialog"
        aria-modal="true"
        {...props}
      >
        <div
          className={join(
            'modal-dialog',
            size ? `modal-${size}` : '',
            alignment === 'center' ? 'modal-dialog-centered' : '',
            scrollable ? 'modal-dialog-scrollable' : '',
          )}
        >
          <div className="modal-content">{children}</div>
        </div>
      </div>
      {backdrop !== false && (
        <div
          className="modal-backdrop fade show"
          onClick={backdrop === 'static' ? undefined : onClose}
        />
      )}
    </>
  )
}

export const CModalHeader = ({ closeButton = false, onClose, className, children, ...props }) => (
  <div className={join('modal-header', className)} {...props}>
    {children}
    {closeButton && (
      <button type="button" className="btn-close" aria-label="Close" onClick={onClose}></button>
    )}
  </div>
)

export const CModalTitle = ({ className, children, ...props }) => (
  <h5 className={join('modal-title', className)} {...props}>
    {children}
  </h5>
)

export const CModalBody = ({ className, children, ...props }) => (
  <div className={join('modal-body', className)} {...props}>
    {children}
  </div>
)

export const CModalFooter = ({ className, children, ...props }) => (
  <div className={join('modal-footer', className)} {...props}>
    {children}
  </div>
)

export const COffcanvas = ({
  visible,
  placement = 'end',
  onHide,
  className,
  children,
  ...props
}) => {
  React.useEffect(() => {
    if (!visible || !onHide) return undefined

    const onKeyDown = (event) => {
      if (event.key === 'Escape') {
        onHide()
      }
    }

    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  }, [visible, onHide])

  if (!visible) return null

  return (
    <div
      className={join('offcanvas show', `offcanvas-${placement}`, className)}
      tabIndex="-1"
      {...props}
    >
      {children}
    </div>
  )
}

export const COffcanvasHeader = ({ className, children, ...props }) => (
  <div className={join('offcanvas-header', className)} {...props}>
    {children}
  </div>
)

export const COffcanvasTitle = ({ className, children, ...props }) => (
  <h5 className={join('offcanvas-title', className)} {...props}>
    {children}
  </h5>
)

export const COffcanvasBody = ({ className, children, ...props }) => (
  <div className={join('offcanvas-body', className)} {...props}>
    {children}
  </div>
)
