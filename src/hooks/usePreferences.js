import { useState, useEffect } from 'react'

/**
 * Custom hook for managing localStorage with React state
 * @param {string} key - localStorage key
 * @param {any} defaultValue - Default value if no stored value exists
 * @param {Function} parser - Function to parse stored value (default: JSON.parse)
 * @param {Function} serializer - Function to serialize value (default: JSON.stringify)
 * @returns {[any, Function]} - [value, setValue] tuple
 */
export const useLocalStorage = (key, defaultValue, parser = JSON.parse, serializer = JSON.stringify) => {
  const [value, setValue] = useState(() => {
    try {
      const stored = localStorage.getItem(key)
      return stored ? parser(stored) : defaultValue
    } catch (e) {
      console.warn(`Error parsing localStorage key "${key}":`, e)
      return defaultValue
    }
  })

  useEffect(() => {
    try {
      if (value !== undefined && value !== null) {
        localStorage.setItem(key, serializer(value))
      }
    } catch (e) {
      console.warn(`Error setting localStorage key "${key}":`, e)
    }
  }, [key, value, serializer])

  return [value, setValue]
}

/**
 * Hook specifically for managing selected teams in localStorage
 * @param {string} key - localStorage key for teams
 * @param {string[]} defaultValue - Default team selection
 * @returns {[string[], Function]} - [selectedTeams, setSelectedTeams] tuple
 */
export const useSelectedTeams = (key, defaultValue = []) => {
  return useLocalStorage(key, defaultValue)
}
