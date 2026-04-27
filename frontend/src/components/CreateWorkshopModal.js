import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
import { useState } from 'react';
import apiClient from '@services/api';
import '../styles/CreateWorkshopModal.css';
const CreateWorkshopModal = ({ isOpen, onClose, onSuccess, }) => {
    const [formData, setFormData] = useState({
        name: '',
        description: '',
        logo_url: '',
    });
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState('');
    const handleInputChange = (e) => {
        const { name, value } = e.target;
        setFormData((prev) => ({
            ...prev,
            [name]: value,
        }));
    };
    const handleSubmit = async (e) => {
        e.preventDefault();
        setError('');
        setLoading(true);
        try {
            await apiClient.post('/workshops/create/', {
                name: formData.name,
                description: formData.description,
                logo_url: formData.logo_url || null,
            });
            setFormData({ name: '', description: '', logo_url: '' });
            onSuccess();
            onClose();
        }
        catch (err) {
            const errorMessage = err.response?.data?.detail ||
                err.response?.data?.message ||
                'Failed to create workshop';
            setError(errorMessage);
        }
        finally {
            setLoading(false);
        }
    };
    if (!isOpen)
        return null;
    return (_jsx("div", { className: "modal-overlay", onClick: onClose, children: _jsxs("div", { className: "modal-content", onClick: (e) => e.stopPropagation(), children: [_jsxs("div", { className: "modal-header", children: [_jsx("h2", { children: "Create New Workshop" }), _jsx("button", { className: "modal-close-btn", onClick: onClose, "aria-label": "Close", children: "\u2715" })] }), _jsxs("form", { onSubmit: handleSubmit, className: "workshop-form", children: [_jsxs("div", { className: "form-group", children: [_jsx("label", { htmlFor: "name", children: "Workshop Name *" }), _jsx("input", { type: "text", id: "name", name: "name", value: formData.name, onChange: handleInputChange, placeholder: "Enter workshop name", required: true, disabled: loading })] }), _jsxs("div", { className: "form-group", children: [_jsx("label", { htmlFor: "description", children: "Description" }), _jsx("textarea", { id: "description", name: "description", value: formData.description, onChange: handleInputChange, placeholder: "Enter workshop description (optional)", rows: 4, disabled: loading })] }), _jsxs("div", { className: "form-group", children: [_jsx("label", { htmlFor: "logo_url", children: "Logo URL" }), _jsx("input", { type: "url", id: "logo_url", name: "logo_url", value: formData.logo_url, onChange: handleInputChange, placeholder: "https://example.com/logo.png (optional)", disabled: loading })] }), error && _jsx("div", { className: "error-message", children: error }), _jsxs("div", { className: "modal-actions", children: [_jsx("button", { type: "button", className: "btn-cancel", onClick: onClose, disabled: loading, children: "Cancel" }), _jsx("button", { type: "submit", className: "btn-submit", disabled: loading, children: loading ? 'Creating...' : 'Create Workshop' })] })] })] }) }));
};
export default CreateWorkshopModal;
