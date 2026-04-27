import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
import { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import apiClient from '@services/api';
import '../styles/Login.css';
const Login = () => {
    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');
    const [error, setError] = useState('');
    const [loading, setLoading] = useState(false);
    const navigate = useNavigate();
    const handleSubmit = async (e) => {
        e.preventDefault();
        setError('');
        setLoading(true);
        try {
            const response = await apiClient.post('/auth/token/', { email, password });
            // Store tokens
            localStorage.setItem('access_token', response.data.access);
            localStorage.setItem('refresh_token', response.data.refresh);
            // Redirect to dashboard
            navigate('/dashboard');
        }
        catch (err) {
            setError(err.response?.data?.detail || 'Login failed. Please try again.');
        }
        finally {
            setLoading(false);
        }
    };
    return (_jsx("div", { className: "login-container", children: _jsxs("div", { className: "login-card", children: [_jsxs("div", { className: "login-header", children: [_jsx(Link, { to: "/", className: "logo", children: "ResolveIT" }), _jsx("p", { className: "subtitle", children: "Welcome back" })] }), error && _jsx("div", { className: "error-message", children: error }), _jsxs("form", { onSubmit: handleSubmit, className: "login-form", children: [_jsxs("div", { className: "form-group", children: [_jsx("label", { htmlFor: "email", children: "Email" }), _jsx("input", { id: "email", type: "email", value: email, onChange: (e) => setEmail(e.target.value), placeholder: "your@email.com", required: true })] }), _jsxs("div", { className: "form-group", children: [_jsx("label", { htmlFor: "password", children: "Password" }), _jsx("input", { id: "password", type: "password", value: password, onChange: (e) => setPassword(e.target.value), placeholder: "\u2022\u2022\u2022\u2022\u2022\u2022\u2022\u2022", required: true })] }), _jsx("button", { type: "submit", className: "btn-login", disabled: loading, children: loading ? 'Logging in...' : 'Login' })] }), _jsxs("div", { className: "login-footer", children: [_jsxs("p", { children: ["Don't have an account? ", _jsx(Link, { to: "/register", children: "Sign up" })] }), _jsx("p", { children: _jsx("a", { href: "/forgot-password", children: "Forgot password?" }) })] })] }) }));
};
export default Login;
