// src/utils/frontend/permissions.js

/**
 * Check if database editing is currently enabled
 * @returns {boolean} True if editing is allowed
 */
export const canEditDatabase = () => {
  return localStorage.getItem('databaseEditingPerms') === 'true'
}

/**
 * Wrapper function for database write operations
 * Only executes if editing permissions are enabled
 * @param {Function} operation - The database operation to perform
 * @param {string} errorMessage - Custom error message if permissions denied
 * @returns {Promise} The result of the operation or rejection
 */
export const executeWithPermission = async (operation, errorMessage = 'Database editing is disabled. Enable it in Settings.') => {
  if (!canEditDatabase()) {
    alert(errorMessage)
    throw new Error(errorMessage)
  }
  return await operation()
}
