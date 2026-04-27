import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
import { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import apiClient from '@services/api';
import '../styles/SignUp.css';
function slugifyWorkshopName(value) {
    return value
        .trim()
        .toLowerCase()
        .replace(/[^a-z0-9\s-]/g, '')
        .replace(/\s+/g, '-')
        .replace(/-+/g, '-');
}
const SignUp = () => {
    const [accountType, setAccountType] = useState('manager');
    const [formData, setFormData] = useState({
        workshop_name: '',
        email: '',
        first_name: '',
        last_name: '',
        password: '',
        password_confirm: '',
    });
    const [error, setError] = useState('');
    const [loading, setLoading] = useState(false);
    const navigate = useNavigate();
    const handleChange = (e) => {
        const { name, value } = e.target;
        setFormData(prev => ({
            ...prev,
            [name]: value
        }));
    };
    const handleSubmit = async (e) => {
        e.preventDefault();
        setError('');
        const workshopSlug = slugifyWorkshopName(formData.workshop_name);
        if (formData.password !== formData.password_confirm) {
            setError('Passwords do not match');
            return;
        }
        if (formData.password.length < 8) {
            setError('Password must be at least 8 characters');
            return;
        }
        setLoading(true);
        try {
            const response = accountType === 'manager'
                ? await apiClient.post('/auth/register/', {
                    workshop_name: formData.workshop_name || null,
                    workshop_slug: workshopSlug || null,
                    email: formData.email,
                    password: formData.password,
                    first_name: formData.first_name,
                    last_name: formData.last_name,
                })
                : await apiClient.post('/auth/register-technician/', {
                    email: formData.email,
                    password: formData.password,
                    first_name: formData.first_name,
                    last_name: formData.last_name,
                });
            const payload = response.data?.data;
            // Store tokens
            localStorage.setItem('access_token', payload?.access_token ?? '');
            localStorage.setItem('refresh_token', payload?.refresh_token ?? '');
            // Redirect to dashboard
            navigate('/dashboard');
        }
        catch (err) {
            const data = err.response?.data;
            setError(data?.detail ||
                data?.workshop_slug?.[0] ||
                data?.workshop_name?.[0] ||
                data?.email?.[0] ||
                'Registration failed. Please try again.');
        }
        finally {
            setLoading(false);
        }
    };
    return (_jsx("div", { className: "signup-container", children: _jsxs("div", { className: "signup-card", children: [_jsxs("div", { className: "signup-header", children: [_jsx(Link, { to: "/", className: "logo-link", children: "ResolveIT" }), _jsx("p", { className: "subtitle", children: "Create your account" })] }), error && _jsx("div", { className: "error-message", children: error }), _jsxs("form", { onSubmit: handleSubmit, className: "signup-form", children: [_jsxs("div", { className: "signup-role-group", role: "radiogroup", "aria-label": "Account Type", children: [_jsx("span", { className: "signup-role-label", children: "I am signing up as" }), _jsxs("div", { className: "signup-role-options", children: [_jsxs("label", { className: `signup-role-option ${accountType === 'manager' ? 'active' : ''}`, children: [_jsx("input", { type: "radio", name: "account_type", value: "manager", checked: accountType === 'manager', onChange: () => setAccountType('manager') }), "Manager"] }), _jsxs("label", { className: `signup-role-option ${accountType === 'technician' ? 'active' : ''}`, children: [_jsx("input", { type: "radio", name: "account_type", value: "technician", checked: accountType === 'technician', onChange: () => setAccountType('technician') }), "Technician"] })] })] }), accountType === 'manager' ? (_jsxs("div", { className: "form-group", children: [_jsx("label", { htmlFor: "workshop_name", children: "Workshop Name (Optional)" }), _jsx("input", { id: "workshop_name", name: "workshop_name", type: "text", value: formData.workshop_name, onChange: handleChange, placeholder: "Acme IT" })] })) : null, _jsxs("div", { className: "form-row", children: [_jsxs("div", { className: "form-group", children: [_jsx("label", { htmlFor: "first_name", children: "First Name" }), _jsx("input", { id: "first_name", name: "first_name", type: "text", value: formData.first_name, onChange: handleChange, placeholder: "John", required: true })] }), _jsxs("div", { className: "form-group", children: [_jsx("label", { htmlFor: "last_name", children: "Last Name" }), _jsx("input", { id: "last_name", name: "last_name", type: "text", value: formData.last_name, onChange: handleChange, placeholder: "Doe", required: true })] })] }), _jsxs("div", { className: "form-group", children: [_jsx("label", { htmlFor: "email", children: "Email" }), _jsx("input", { id: "email", name: "email", type: "email", value: formData.email, onChange: handleChange, placeholder: "your@email.com", required: true })] }), _jsxs("div", { className: "form-group", children: [_jsx("label", { htmlFor: "password", children: "Password" }), _jsx("input", { id: "password", name: "password", type: "password", value: formData.password, onChange: handleChange, placeholder: "\u2022\u2022\u2022\u2022\u2022\u2022\u2022\u2022", required: true }), _jsx("small", { className: "password-hint", children: "At least 8 characters" })] }), _jsxs("div", { className: "form-group", children: [_jsx("label", { htmlFor: "password_confirm", children: "Confirm Password" }), _jsx("input", { id: "password_confirm", name: "password_confirm", type: "password", value: formData.password_confirm, onChange: handleChange, placeholder: "\u2022\u2022\u2022\u2022\u2022\u2022\u2022\u2022", required: true })] }), _jsx("button", { type: "submit", className: "btn-signup", disabled: loading, children: loading ? 'Creating account...' : 'Sign Up' })] }), _jsx("div", { className: "signup-footer", children: _jsxs("p", { children: ["Already have an account? ", _jsx(Link, { to: "/login", children: "Login here" })] }) })] }) }));
};
export default SignUp;
