import { Routes, Route } from 'react-router-dom'
import Home from '@pages/Home'
import Login from '@pages/Login'
import SignUp from '@pages/SignUp'
import About from '@pages/About'
import Dashboard from '@pages/Dashboard'
import Workshop from '@pages/Workshop'
import ProtectedRoute from '@components/ProtectedRoute'
import './App.css'

function App() {
  return (
    <Routes>
      <Route path="/" element={<Home />} />
      <Route path="/login" element={<Login />} />
      <Route path="/register" element={<SignUp />} />
      <Route path="/about" element={<About />} />
      <Route
        path="/dashboard"
        element={
          <ProtectedRoute>
            <Dashboard />
          </ProtectedRoute>
        }
      />
      <Route
        path="/workshop"
        element={
          <ProtectedRoute>
            <Workshop />
          </ProtectedRoute>
        }
      />
    </Routes>
  )
}

export default App
