import React from 'react'
import { Navigate } from 'react-router-dom'
import { hasJwtAccessToken } from '@services/auth'

interface ProtectedRouteProps {
  children: React.ReactNode
}

const ProtectedRoute: React.FC<ProtectedRouteProps> = ({ children }) => {
  if (!hasJwtAccessToken()) {
    return <Navigate to="/login" replace />
  }

  return <>{children}</>
}

export default ProtectedRoute
