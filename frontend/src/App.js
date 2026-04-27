import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
import { Routes, Route } from 'react-router-dom';
import Home from '@pages/Home';
import Login from '@pages/Login';
import SignUp from '@pages/SignUp';
import About from '@pages/About';
import Dashboard from '@pages/Dashboard';
import Tickets from '@pages/Tickets';
import Workshop from '@pages/Workshop';
import ProtectedRoute from '@components/ProtectedRoute';
import './App.css';
function App() {
    return (_jsxs(Routes, { children: [_jsx(Route, { path: "/", element: _jsx(Home, {}) }), _jsx(Route, { path: "/login", element: _jsx(Login, {}) }), _jsx(Route, { path: "/register", element: _jsx(SignUp, {}) }), _jsx(Route, { path: "/about", element: _jsx(About, {}) }), _jsx(Route, { path: "/tickets", element: _jsx(ProtectedRoute, { children: _jsx(Tickets, {}) }) }), _jsx(Route, { path: "/dashboard", element: _jsx(ProtectedRoute, { children: _jsx(Dashboard, {}) }) }), _jsx(Route, { path: "/workshop", element: _jsx(ProtectedRoute, { children: _jsx(Workshop, {}) }) })] }));
}
export default App;
