import React from 'react'

const AppFooter = () => {
  return (
    <footer className="border-top px-4 py-3 bg-body">
      <div className="d-flex flex-wrap align-items-center">
        <div>
          <span>&copy; 2026 Bee Dashboard.</span>
        </div>
      </div>
    </footer>
  )
}

export default React.memo(AppFooter)
