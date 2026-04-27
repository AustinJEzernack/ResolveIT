import { jsx as _jsx, jsxs as _jsxs, Fragment as _Fragment } from "react/jsx-runtime";
import { useEffect, useMemo, useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { ArrowLeft, CheckCircle2, Plus } from 'lucide-react';
import apiClient from '@services/api';
import { getAccessToken } from '@services/auth';
import '../styles/Tickets.css';
function parseJwtPayload(token) {
    try {
        const payload = token.split('.')[1];
        if (!payload)
            return null;
        const base64 = payload.replace(/-/g, '+').replace(/_/g, '/');
        const padded = base64 + '='.repeat((4 - (base64.length % 4)) % 4);
        return JSON.parse(atob(padded));
    }
    catch {
        return null;
    }
}
function unwrapListPayload(payload) {
    if (Array.isArray(payload))
        return payload;
    if (payload && typeof payload === 'object') {
        const data = payload;
        if (Array.isArray(data.data))
            return data.data;
        if (Array.isArray(data.results))
            return data.results;
        if (data.data && typeof data.data === 'object') {
            const nested = data.data;
            if (Array.isArray(nested.results))
                return nested.results;
        }
    }
    return [];
}
const Tickets = () => {
    const navigate = useNavigate();
    const token = getAccessToken();
    const [user, setUser] = useState(null);
    const [tickets, setTickets] = useState([]);
    const [workbenches, setWorkbenches] = useState([]);
    const [members, setMembers] = useState([]);
    const [selectedTicket, setSelectedTicket] = useState(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState('');
    const [isCreateOpen, setIsCreateOpen] = useState(false);
    const [creating, setCreating] = useState(false);
    const [createError, setCreateError] = useState('');
    const [completingId, setCompletingId] = useState(null);
    const [savingTicket, setSavingTicket] = useState(false);
    const [editError, setEditError] = useState('');
    const [createForm, setCreateForm] = useState({
        title: '',
        description: '',
        urgency: 'MEDIUM',
        category: '',
        asset_id: '',
        workbench_id: '',
        assignee_id: '',
    });
    const [editForm, setEditForm] = useState({
        title: '',
        description: '',
        status: 'OPEN',
        urgency: 'MEDIUM',
        category: '',
        asset_id: '',
        resolution: '',
        assignee_id: '',
    });
    const hasWorkshop = useMemo(() => {
        const payload = parseJwtPayload(token);
        return Boolean(payload?.workshop_id);
    }, [token]);
    const canCreateTicket = Boolean(user?.role === 'OWNER' && hasWorkshop);
    const loadTickets = async (authUser, withWorkshop) => {
        const url = authUser.role === 'OWNER' && withWorkshop
            ? '/tickets/'
            : `/tickets/?assignee=${authUser.id}`;
        const response = await apiClient.get(url);
        setTickets(unwrapListPayload(response.data));
    };
    useEffect(() => {
        if (!token) {
            navigate('/login');
            return;
        }
        const boot = async () => {
            setLoading(true);
            setError('');
            try {
                const meResponse = await apiClient.get('/auth/me/');
                const authUser = meResponse.data;
                setUser(authUser);
                await loadTickets(authUser, hasWorkshop);
                if (authUser.role === 'OWNER' && hasWorkshop) {
                    const [workbenchResponse, membersResponse] = await Promise.all([
                        apiClient.get('/workbenches/'),
                        apiClient.get('/workshops/me/members/'),
                    ]);
                    setWorkbenches(unwrapListPayload(workbenchResponse.data));
                    setMembers(unwrapListPayload(membersResponse.data));
                }
            }
            catch {
                setError('Failed to load tickets');
            }
            finally {
                setLoading(false);
            }
        };
        void boot();
    }, [navigate, token, hasWorkshop]);
    const handleCreateTicket = async (event) => {
        event.preventDefault();
        if (!canCreateTicket || creating)
            return;
        if (!createForm.workbench_id || !createForm.assignee_id) {
            setCreateError('Workbench and assignee are required');
            return;
        }
        setCreating(true);
        setCreateError('');
        try {
            const response = await apiClient.post('/tickets/', {
                title: createForm.title.trim(),
                description: createForm.description.trim(),
                urgency: createForm.urgency,
                category: createForm.category.trim(),
                asset_id: createForm.asset_id.trim(),
                workbench_id: createForm.workbench_id,
                assignee_id: createForm.assignee_id,
            });
            const nextTicket = response.data?.data?.ticket;
            if (nextTicket) {
                setTickets((prev) => [nextTicket, ...prev]);
            }
            setCreateForm({
                title: '',
                description: '',
                urgency: 'MEDIUM',
                category: '',
                asset_id: '',
                workbench_id: '',
                assignee_id: '',
            });
            setIsCreateOpen(false);
        }
        catch (createErr) {
            const data = createErr.response?.data;
            setCreateError(data?.detail ||
                data?.workbench_id?.[0] ||
                data?.assignee_id?.[0] ||
                data?.title?.[0] ||
                'Failed to create ticket');
        }
        finally {
            setCreating(false);
        }
    };
    const handleOpenTicket = (ticket) => {
        setEditError('');
        setSelectedTicket(ticket);
        setEditForm({
            title: ticket.title || '',
            description: ticket.description || '',
            status: ticket.status || 'OPEN',
            urgency: ticket.urgency || 'MEDIUM',
            category: ticket.category || '',
            asset_id: ticket.asset_id || '',
            resolution: ticket.resolution || '',
            assignee_id: ticket.assignee?.id || '',
        });
    };
    const handleSaveTicket = async (event) => {
        event.preventDefault();
        if (!selectedTicket || savingTicket)
            return;
        if ((editForm.status === 'RESOLVED' || editForm.status === 'CLOSED') &&
            !editForm.resolution.trim()) {
            setEditError('Resolution is required when status is RESOLVED or CLOSED');
            return;
        }
        setSavingTicket(true);
        setEditError('');
        try {
            const response = await apiClient.patch(`/tickets/${selectedTicket.id}/`, {
                title: editForm.title.trim(),
                description: editForm.description.trim(),
                status: editForm.status,
                urgency: editForm.urgency,
                category: editForm.category.trim(),
                asset_id: editForm.asset_id.trim(),
                resolution: editForm.resolution.trim(),
                assignee_id: editForm.assignee_id || null,
            });
            const patchedTicket = (response.data?.data?.ticket || response.data?.ticket || response.data);
            const ticketId = patchedTicket?.id || selectedTicket.id;
            const detailResponse = await apiClient.get(`/tickets/${ticketId}/`);
            const persistedTicket = detailResponse.data;
            if (persistedTicket?.id) {
                setTickets((prev) => prev.map((ticket) => (ticket.id === persistedTicket.id ? persistedTicket : ticket)));
                setSelectedTicket(null);
            }
        }
        catch (saveErr) {
            const data = saveErr.response?.data;
            setEditError(data?.detail ||
                data?.message ||
                data?.title?.[0] ||
                data?.description?.[0] ||
                data?.status?.[0] ||
                data?.urgency?.[0] ||
                data?.category?.[0] ||
                data?.asset_id?.[0] ||
                data?.assignee_id?.[0] ||
                data?.resolution?.[0] ||
                'Failed to update ticket');
        }
        finally {
            setSavingTicket(false);
        }
    };
    const handleCompleteTicket = async (ticketId) => {
        if (completingId)
            return;
        setCompletingId(ticketId);
        try {
            const response = await apiClient.patch(`/tickets/${ticketId}/`, { status: 'CLOSED' });
            const patchedTicket = (response.data?.data?.ticket || response.data?.ticket || response.data);
            const persistedId = patchedTicket?.id || ticketId;
            const detailResponse = await apiClient.get(`/tickets/${persistedId}/`);
            const persistedTicket = detailResponse.data;
            if (persistedTicket?.id) {
                setTickets((prev) => prev.map((ticket) => (ticket.id === persistedTicket.id ? persistedTicket : ticket)));
                if (selectedTicket?.id === ticketId) {
                    setSelectedTicket(persistedTicket);
                    setEditForm((prev) => ({ ...prev, status: persistedTicket.status }));
                }
            }
        }
        catch {
            // silent fail to avoid noisy UX
        }
        finally {
            setCompletingId(null);
        }
    };
    return (_jsxs(_Fragment, { children: [_jsxs("div", { className: "tickets-page", children: [_jsxs("nav", { className: "tickets-navbar", children: [_jsxs("div", { className: "tickets-navbar-left", children: [_jsx(Link, { to: "/", className: "logo-link", style: { marginRight: '16px' }, children: "ResolveIT" }), _jsxs("button", { className: "tickets-back-btn", onClick: () => navigate('/dashboard'), children: [_jsx(ArrowLeft, { size: 14, strokeWidth: 1.75 }), "Dashboard"] }), _jsx("h1", { className: "tickets-title", children: "Tickets" })] }), _jsxs("div", { className: "tickets-navbar-right", children: [canCreateTicket ? (_jsxs("button", { className: "tickets-create-btn", onClick: () => { setCreateError(''); setIsCreateOpen(true); }, children: [_jsx(Plus, { size: 14, strokeWidth: 1.75 }), "Create Ticket"] })) : null, _jsx(Link, { to: "/", className: "logo-link", children: "ResolveIT" })] })] }), _jsxs("div", { className: "tickets-body", children: [!canCreateTicket ? (_jsx("div", { className: "tickets-scope-note", children: "Showing tickets assigned to you." })) : null, loading ? (_jsx("p", { className: "tickets-message", children: "Loading tickets..." })) : error ? (_jsx("p", { className: "tickets-message", children: error })) : tickets.length === 0 ? (_jsx("p", { className: "tickets-message", children: "No tickets found." })) : (_jsx("div", { className: "tickets-list", children: tickets.map((ticket) => {
                                    return (_jsx("div", { className: "ticket-card", children: _jsxs("button", { type: "button", className: "ticket-summary", onClick: () => handleOpenTicket(ticket), children: [_jsxs("div", { className: "ticket-summary-main", children: [_jsx("span", { className: "ticket-summary-title", children: ticket.title }), _jsx("span", { className: "ticket-summary-meta", children: ticket.workbench?.name || 'No workbench' })] }), _jsx("div", { className: "ticket-summary-right", children: _jsx("span", { className: `ticket-chip ${ticket.status.toLowerCase().replace('_', '-')}`, children: ticket.status.replace('_', ' ') }) })] }) }, ticket.id));
                                }) }))] })] }), selectedTicket ? (_jsx("div", { className: "modal-overlay", onClick: () => setSelectedTicket(null), children: _jsxs("div", { className: "modal-content", onClick: (event) => event.stopPropagation(), children: [_jsxs("div", { className: "modal-header", children: [_jsx("h2", { children: "Edit Ticket" }), _jsx("button", { className: "modal-close-btn", onClick: () => setSelectedTicket(null), "aria-label": "Close", children: "\u2715" })] }), _jsxs("form", { onSubmit: handleSaveTicket, className: "workshop-form", children: [_jsxs("div", { className: "form-group", children: [_jsx("label", { htmlFor: "edit_ticket_title", children: "Title" }), _jsx("input", { id: "edit_ticket_title", value: editForm.title, onChange: (event) => setEditForm((prev) => ({ ...prev, title: event.target.value })), required: true, disabled: savingTicket })] }), _jsxs("div", { className: "form-group", children: [_jsx("label", { htmlFor: "edit_ticket_description", children: "Description" }), _jsx("textarea", { id: "edit_ticket_description", rows: 3, value: editForm.description, onChange: (event) => setEditForm((prev) => ({ ...prev, description: event.target.value })), required: true, disabled: savingTicket })] }), _jsxs("div", { className: "form-group", children: [_jsx("label", { htmlFor: "edit_ticket_status", children: "Status" }), _jsxs("select", { id: "edit_ticket_status", value: editForm.status, onChange: (event) => setEditForm((prev) => ({ ...prev, status: event.target.value })), disabled: savingTicket, children: [_jsx("option", { value: "OPEN", children: "OPEN" }), _jsx("option", { value: "ASSIGNED", children: "ASSIGNED" }), _jsx("option", { value: "IN_PROGRESS", children: "IN_PROGRESS" }), _jsx("option", { value: "RESOLVED", children: "RESOLVED" }), _jsx("option", { value: "CLOSED", children: "CLOSED" })] }), _jsx("div", { style: { marginTop: '6px', fontSize: '0.8rem', color: 'var(--fg-muted)' }, children: editForm.status === 'CLOSED'
                                                ? 'Status: CLOSED (ticket is retained; it is not deleted).'
                                                : `Status: ${editForm.status}` })] }), _jsxs("div", { className: "form-group", children: [_jsx("label", { htmlFor: "edit_ticket_urgency", children: "Urgency" }), _jsxs("select", { id: "edit_ticket_urgency", value: editForm.urgency, onChange: (event) => setEditForm((prev) => ({ ...prev, urgency: event.target.value })), disabled: savingTicket, children: [_jsx("option", { value: "LOW", children: "LOW" }), _jsx("option", { value: "MEDIUM", children: "MEDIUM" }), _jsx("option", { value: "HIGH", children: "HIGH" }), _jsx("option", { value: "CRITICAL", children: "CRITICAL" })] })] }), _jsxs("div", { className: "form-group", children: [_jsx("label", { htmlFor: "edit_ticket_category", children: "Category" }), _jsx("input", { id: "edit_ticket_category", value: editForm.category, onChange: (event) => setEditForm((prev) => ({ ...prev, category: event.target.value })), required: true, disabled: savingTicket })] }), _jsxs("div", { className: "form-group", children: [_jsx("label", { htmlFor: "edit_ticket_asset_id", children: "Asset ID" }), _jsx("input", { id: "edit_ticket_asset_id", value: editForm.asset_id, onChange: (event) => setEditForm((prev) => ({ ...prev, asset_id: event.target.value })), disabled: savingTicket })] }), _jsxs("div", { className: "form-group", children: [_jsx("label", { htmlFor: "edit_ticket_assignee", children: "Assignee" }), _jsxs("select", { id: "edit_ticket_assignee", value: editForm.assignee_id, onChange: (event) => setEditForm((prev) => ({ ...prev, assignee_id: event.target.value })), disabled: savingTicket, children: [_jsx("option", { value: "", children: "Unassigned" }), members.map((member) => (_jsx("option", { value: member.id, children: member.full_name || member.username }, member.id)))] })] }), _jsxs("div", { className: "form-group", children: [_jsx("label", { htmlFor: "edit_ticket_resolution", children: "Resolution" }), _jsx("textarea", { id: "edit_ticket_resolution", rows: 3, value: editForm.resolution, onChange: (event) => setEditForm((prev) => ({ ...prev, resolution: event.target.value })), disabled: savingTicket })] }), _jsxs("div", { className: "form-group", children: [_jsx("label", { children: "Created" }), _jsx("input", { value: new Date(selectedTicket.created_at).toLocaleString(), disabled: true })] }), _jsxs("div", { className: "form-group", children: [_jsx("label", { children: "Updated" }), _jsx("input", { value: new Date(selectedTicket.updated_at).toLocaleString(), disabled: true })] }), editError ? _jsx("div", { className: "error-message", children: editError }) : null, _jsxs("div", { className: "modal-actions", children: [_jsxs("button", { type: "button", className: "ticket-complete-btn", onClick: () => handleCompleteTicket(selectedTicket.id), disabled: completingId === selectedTicket.id || savingTicket, children: [_jsx(CheckCircle2, { size: 14, strokeWidth: 1.75 }), completingId === selectedTicket.id ? 'Closing...' : 'Mark Closed'] }), _jsx("button", { type: "button", className: "btn-cancel", onClick: () => setSelectedTicket(null), disabled: savingTicket, children: "Cancel" }), _jsx("button", { type: "submit", className: "btn-submit", disabled: savingTicket, children: savingTicket ? 'Saving...' : 'Save Changes' })] })] })] }) })) : null, isCreateOpen ? (_jsx("div", { className: "modal-overlay", onClick: () => setIsCreateOpen(false), children: _jsxs("div", { className: "modal-content", onClick: (event) => event.stopPropagation(), children: [_jsxs("div", { className: "modal-header", children: [_jsx("h2", { children: "Create Ticket" }), _jsx("button", { className: "modal-close-btn", onClick: () => setIsCreateOpen(false), "aria-label": "Close", children: "\u2715" })] }), _jsxs("form", { onSubmit: handleCreateTicket, className: "workshop-form", children: [_jsxs("div", { className: "form-group", children: [_jsx("label", { htmlFor: "ticket_title", children: "Title" }), _jsx("input", { id: "ticket_title", value: createForm.title, onChange: (event) => setCreateForm((prev) => ({ ...prev, title: event.target.value })), required: true, disabled: creating })] }), _jsxs("div", { className: "form-group", children: [_jsx("label", { htmlFor: "ticket_description", children: "Description" }), _jsx("textarea", { id: "ticket_description", rows: 3, value: createForm.description, onChange: (event) => setCreateForm((prev) => ({ ...prev, description: event.target.value })), required: true, disabled: creating })] }), _jsxs("div", { className: "form-group", children: [_jsx("label", { htmlFor: "ticket_category", children: "Category" }), _jsx("input", { id: "ticket_category", value: createForm.category, onChange: (event) => setCreateForm((prev) => ({ ...prev, category: event.target.value })), required: true, disabled: creating })] }), _jsxs("div", { className: "form-group", children: [_jsx("label", { htmlFor: "ticket_urgency", children: "Urgency" }), _jsxs("select", { id: "ticket_urgency", value: createForm.urgency, onChange: (event) => setCreateForm((prev) => ({ ...prev, urgency: event.target.value })), disabled: creating, children: [_jsx("option", { value: "LOW", children: "LOW" }), _jsx("option", { value: "MEDIUM", children: "MEDIUM" }), _jsx("option", { value: "HIGH", children: "HIGH" }), _jsx("option", { value: "CRITICAL", children: "CRITICAL" })] })] }), _jsxs("div", { className: "form-group", children: [_jsx("label", { htmlFor: "ticket_asset_id", children: "Asset ID" }), _jsx("input", { id: "ticket_asset_id", value: createForm.asset_id, onChange: (event) => setCreateForm((prev) => ({ ...prev, asset_id: event.target.value })), disabled: creating })] }), _jsxs("div", { className: "form-group", children: [_jsx("label", { htmlFor: "ticket_workbench", children: "Workbench" }), _jsxs("select", { id: "ticket_workbench", value: createForm.workbench_id, onChange: (event) => setCreateForm((prev) => ({ ...prev, workbench_id: event.target.value })), required: true, disabled: creating, children: [_jsx("option", { value: "", children: "Select a workbench" }), workbenches.map((workbench) => (_jsx("option", { value: workbench.id, children: workbench.name }, workbench.id)))] })] }), _jsxs("div", { className: "form-group", children: [_jsx("label", { htmlFor: "ticket_assignee", children: "Assignee" }), _jsxs("select", { id: "ticket_assignee", value: createForm.assignee_id, onChange: (event) => setCreateForm((prev) => ({ ...prev, assignee_id: event.target.value })), required: true, disabled: creating, children: [_jsx("option", { value: "", children: "Select a member" }), members.map((member) => (_jsx("option", { value: member.id, children: member.full_name || member.username }, member.id)))] })] }), createError ? _jsx("div", { className: "error-message", children: createError }) : null, _jsxs("div", { className: "modal-actions", children: [_jsx("button", { type: "button", className: "btn-cancel", onClick: () => setIsCreateOpen(false), disabled: creating, children: "Cancel" }), _jsx("button", { type: "submit", className: "btn-submit", disabled: creating, children: creating ? 'Creating...' : 'Create Ticket' })] })] })] }) })) : null] }));
};
export default Tickets;
