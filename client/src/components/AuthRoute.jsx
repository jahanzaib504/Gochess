import { useContext } from "react"
import AuthContext from "./AuthContext"
import { Navigate } from "react-router-dom"

const AuthRoute = ({ children }) => {
  const { auth, loading } = useContext(AuthContext)
  
  // If loading, show loading message
  if (loading) {
    return <div>Loading...</div>
  }

  // If not authenticated, redirect to login
  if (!auth) {
    return <Navigate to='/log-in' />
  }

  // If authenticated, render the children components
  return children
}
export default AuthRoute