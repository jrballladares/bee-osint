/**
 * Redux Store Configuration
 *
 * Simple Redux store managing global application state.
 * Handles sidebar visibility and theme preferences.
 *
 * @module store
 */

import { legacy_createStore as createStore } from 'redux'

const SIDEBAR_SHOW_STORAGE_KEY = 'bee.sidebarShow'

const getStoredSidebarShow = () => {
  if (typeof window === 'undefined') {
    return true
  }

  try {
    const storedSidebarShow = window.localStorage.getItem(SIDEBAR_SHOW_STORAGE_KEY)

    if (storedSidebarShow === null) {
      return true
    }

    return storedSidebarShow === 'true'
  } catch {
    return true
  }
}

/**
 * Initial state for the Redux store
 * @type {Object}
 * @property {boolean} sidebarShow - Controls sidebar visibility (true = visible, false = hidden)
 * @property {string} theme - Current theme mode ('light', 'dark', or 'auto')
 */
const initialState = {
  sidebarShow: getStoredSidebarShow(),
  theme: 'light',
}

/**
 * Root reducer function that handles all state changes
 *
 * @param {Object} state - Current state (defaults to initialState)
 * @param {Object} action - Action object with type and payload
 * @param {string} action.type - Action type ('set' to update state)
 * @param {...*} rest - Additional properties to merge into state
 * @returns {Object} New state object
 *
 * @example
 * // Update sidebar visibility
 * dispatch({ type: 'set', sidebarShow: false })
 *
 * @example
 * // Update theme
 * dispatch({ type: 'set', theme: 'dark' })
 *
 * @example
 * // Update multiple properties
 * dispatch({ type: 'set', sidebarShow: true, theme: 'light' })
 */
const changeState = (state = initialState, { type, ...rest }) => {
  switch (type) {
    case 'set':
      return { ...state, ...rest }
    default:
      return state
  }
}

/**
 * Redux store instance
 * @type {import('redux').Store}
 */
const store = createStore(changeState)

store.subscribe(() => {
  if (typeof window === 'undefined') {
    return
  }

  try {
    window.localStorage.setItem(SIDEBAR_SHOW_STORAGE_KEY, String(store.getState().sidebarShow))
  } catch {
    // Ignore storage failures so sidebar toggling still works in private/restricted contexts.
  }
})

export default store
