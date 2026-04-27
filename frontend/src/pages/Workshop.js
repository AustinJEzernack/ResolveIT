import { jsx as _jsx, jsxs as _jsxs, Fragment as _Fragment } from "react/jsx-runtime";
import { useEffect, useRef, useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { ArrowLeft, Plus, Send, Ticket, UserPlus } from 'lucide-react';
import CreateWorkshopModal from '../components/CreateWorkshopModal';
import apiClient from '@services/api';
import { connectWebSocket, createChannel, fetchChannels, fetchMessages, fetchTickets, fetchWorkbenches, joinChannel, leaveChannel, postMessage, } from '@services/messagingService';
import '../styles/Workshop.css';
function unwrapListPayload(payload) {
    if (Array.isArray(payload))
        return payload;
    if (payload && typeof payload === 'object') {
        const data = payload;
        if (Array.isArray(data.data))
            return data.data;
        if (Array.isArray(data.results))
            return data.results;
    }
    return [];
}
const Workshop = () => {
    const navigate = useNavigate();
    const token = localStorage.getItem('access_token') ?? '';
    const [workshop, setWorkshop] = useState(null);
    const [currentRole, setCurrentRole] = useState('');
    const [workbenches, setWorkbenches] = useState([]);
    const [channels, setChannels] = useState([]);
    const [tickets, setTickets] = useState([]);
    const [selectedTicket, setSelectedTicket] = useState(null);
    const [messages, setMessages] = useState([]);
    const [availableMembers, setAvailableMembers] = useState([]);
    const [activeWorkbenchId, setActiveWorkbenchId] = useState(null);
    const [activeChannelId, setActiveChannelId] = useState(null);
    const [currentUserId, setCurrentUserId] = useState('');
    const [creatingChannel, setCreatingChannel] = useState(false);
    const [input, setInput] = useState('');
    const [memberSearch, setMemberSearch] = useState('');
    const [loading, setLoading] = useState(true);
    const [sending, setSending] = useState(false);
    const [inviteLoading, setInviteLoading] = useState(false);
    const [isCreateOpen, setIsCreateOpen] = useState(false);
    const [isCreateWorkbenchOpen, setIsCreateWorkbenchOpen] = useState(false);
    const [isInviteOpen, setIsInviteOpen] = useState(false);
    const [inviteError, setInviteError] = useState('');
    const [inviteSuccess, setInviteSuccess] = useState('');
    const [addingMemberId, setAddingMemberId] = useState(null);
    const [workbenchForm, setWorkbenchForm] = useState({
        name: '',
        description: '',
        color: '#e03131',
    });
    const [creatingWorkbench, setCreatingWorkbench] = useState(false);
    const [createWorkbenchError, setCreateWorkbenchError] = useState('');
    const [isCreateTicketOpen, setIsCreateTicketOpen] = useState(false);
    const [creatingTicket, setCreatingTicket] = useState(false);
    const [createTicketError, setCreateTicketError] = useState('');
    const [workshopMembers, setWorkshopMembers] = useState([]);
    const [workshopMembersLoading, setWorkshopMembersLoading] = useState(false);
    const [createTicketForm, setCreateTicketForm] = useState({
        title: '',
        description: '',
        urgency: 'MEDIUM',
        category: '',
        asset_id: '',
        assignee_id: '',
    });
    const [savingTicket, setSavingTicket] = useState(false);
    const [editTicketError, setEditTicketError] = useState('');
    const [editTicketForm, setEditTicketForm] = useState({
        title: '',
        description: '',
        status: 'OPEN',
        urgency: 'MEDIUM',
        category: '',
        asset_id: '',
        resolution: '',
        assignee_id: '',
    });
    const wsRef = useRef(null);
    const prevChannelRef = useRef(null);
    const activeChannelIdRef = useRef(null);
    const messagesEndRef = useRef(null);
    const loadWorkbenchState = async () => {
        try {
            const [nextWorkbenches, nextChannels] = await Promise.all([
                fetchWorkbenches(),
                fetchChannels(),
            ]);
            setWorkbenches(nextWorkbenches);
            setChannels(nextChannels);
            setActiveWorkbenchId((currentId) => {
                if (currentId && nextWorkbenches.some((workbench) => workbench.id === currentId)) {
                    return currentId;
                }
                return nextWorkbenches[0]?.id ?? null;
            });
        }
        catch {
            setWorkbenches([]);
            setChannels([]);
            setActiveWorkbenchId(null);
        }
    };
    const loadWorkshopMeta = async () => {
        const [workshopResult, meResult] = await Promise.allSettled([
            apiClient.get('/workshops/me/'),
            apiClient.get('/auth/me/'),
        ]);
        if (workshopResult.status === 'fulfilled') {
            setWorkshop(workshopResult.value.data);
        }
        else {
            setWorkshop(null);
        }
        if (meResult.status === 'fulfilled') {
            const me = meResult.value.data;
            setCurrentRole(me?.role ?? '');
            setCurrentUserId(me?.id ?? '');
        }
        else {
            setCurrentRole('');
            setCurrentUserId('');
        }
    };
    const refreshWorkshopPage = async () => {
        await Promise.all([loadWorkbenchState(), loadWorkshopMeta()]);
    };
    useEffect(() => {
        if (!token) {
            navigate('/login');
            return;
        }
        void refreshWorkshopPage().finally(() => setLoading(false));
        const ws = connectWebSocket(token, (event) => {
            if (event.type === 'message.new') {
                const newMsg = event.data;
                if (newMsg.channel_id === activeChannelIdRef.current) {
                    setMessages((prev) => prev.some((m) => m.id === newMsg.id) ? prev : [...prev, newMsg]);
                }
            }
        });
        wsRef.current = ws;
        return () => {
            ws.close();
        };
    }, []); // eslint-disable-line react-hooks/exhaustive-deps
    useEffect(() => {
        if (!activeWorkbenchId) {
            setTickets([]);
            setActiveChannelId(null);
            return;
        }
        fetchTickets(activeWorkbenchId).then(setTickets).catch(() => {
            setTickets([]);
        });
        const workbench = workbenches.find((item) => item.id === activeWorkbenchId);
        const match = channels.find((channel) => channel.name === workbench?.name);
        if (match) {
            setActiveChannelId(match.id);
        }
        else if (workbench && !creatingChannel) {
            // Auto-create a channel for this workbench (owner: via API; others wait for owner to create it)
            setCreatingChannel(true);
            const fetchAndCreate = async () => {
                try {
                    const res = await apiClient.get('/workshops/me/members/');
                    const allMembers = unwrapListPayload(res.data);
                    const otherMemberIds = allMembers
                        .filter((m) => m.id !== currentUserId)
                        .map((m) => m.id);
                    const newChannel = await createChannel(workbench.name, otherMemberIds);
                    if (newChannel) {
                        const updatedChannels = await fetchChannels();
                        setChannels(updatedChannels);
                        setActiveChannelId(newChannel.id);
                    }
                }
                catch {
                    setActiveChannelId(null);
                    setMessages([]);
                }
                finally {
                    setCreatingChannel(false);
                }
            };
            void fetchAndCreate();
        }
        else if (!workbench) {
            setActiveChannelId(null);
            setMessages([]);
        }
    }, [activeWorkbenchId, workbenches, channels]); // eslint-disable-line react-hooks/exhaustive-deps
    useEffect(() => {
        activeChannelIdRef.current = activeChannelId;
    }, [activeChannelId]);
    useEffect(() => {
        messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    }, [messages]);
    useEffect(() => {
        if (!activeChannelId) {
            setMessages([]);
            return;
        }
        const ws = wsRef.current;
        if (ws && prevChannelRef.current) {
            leaveChannel(ws, prevChannelRef.current);
        }
        fetchMessages(activeChannelId).then(setMessages).catch(() => setMessages([]));
        if (ws) {
            const doJoin = () => joinChannel(ws, activeChannelId);
            if (ws.readyState === WebSocket.OPEN) {
                doJoin();
            }
            else {
                ws.addEventListener('open', doJoin, { once: true });
            }
        }
        prevChannelRef.current = activeChannelId;
    }, [activeChannelId]);
    const handleSend = async () => {
        const text = input.trim();
        if (!text || !activeChannelId || sending)
            return;
        setInput('');
        setSending(true);
        try {
            const msg = await postMessage(activeChannelId, text);
            setMessages((prev) => [...prev, msg]);
        }
        catch {
            // failed silently
        }
        finally {
            setSending(false);
        }
    };
    const handleKeyDown = (event) => {
        if (event.key === 'Enter')
            handleSend();
    };
    const handleOpenInviteModal = async () => {
        setIsInviteOpen(true);
        setInviteError('');
        setInviteSuccess('');
        setMemberSearch('');
        setInviteLoading(true);
        try {
            const response = await apiClient.get('/workshops/available-members/');
            setAvailableMembers(unwrapListPayload(response.data));
        }
        catch (error) {
            const message = error.response?.data?.detail ||
                error.response?.data?.message ||
                'Failed to load available members';
            setInviteError(message);
            setAvailableMembers([]);
        }
        finally {
            setInviteLoading(false);
        }
    };
    const handleAddMember = async (member) => {
        if (addingMemberId)
            return;
        setInviteError('');
        setInviteSuccess('');
        setAddingMemberId(member.id);
        try {
            await apiClient.post(`/workshops/me/members/${member.id}/assign/`);
            setAvailableMembers((prev) => prev.filter((item) => item.id !== member.id));
            setInviteSuccess(`${member.full_name || member.email} added to ${workshop?.name ?? 'your workshop'}.`);
        }
        catch (error) {
            const message = error.response?.data?.detail ||
                error.response?.data?.message ||
                'Failed to add member to workshop';
            setInviteError(message);
        }
        finally {
            setAddingMemberId(null);
        }
    };
    const handleCreateWorkbench = async (event) => {
        event.preventDefault();
        const trimmedName = workbenchForm.name.trim();
        if (!trimmedName || creatingWorkbench)
            return;
        setCreateWorkbenchError('');
        setCreatingWorkbench(true);
        try {
            await apiClient.post('/workbenches/', {
                name: trimmedName,
                description: workbenchForm.description.trim(),
                color: workbenchForm.color || '',
            });
            setWorkbenchForm({ name: '', description: '', color: '#e03131' });
            setIsCreateWorkbenchOpen(false);
            await loadWorkbenchState();
        }
        catch (error) {
            const message = error.response?.data?.detail ||
                error.response?.data?.name?.[0] ||
                error.response?.data?.message ||
                'Failed to create workbench';
            setCreateWorkbenchError(message);
        }
        finally {
            setCreatingWorkbench(false);
        }
    };
    const handleOpenCreateTicket = async () => {
        setCreateTicketError('');
        setCreateTicketForm({ title: '', description: '', urgency: 'MEDIUM', category: '', asset_id: '', assignee_id: '' });
        setIsCreateTicketOpen(true);
        if (workshopMembers.length === 0) {
            setWorkshopMembersLoading(true);
            try {
                const res = await apiClient.get('/workshops/me/members/');
                setWorkshopMembers(unwrapListPayload(res.data));
            }
            catch {
                // leave empty
            }
            finally {
                setWorkshopMembersLoading(false);
            }
        }
    };
    const handleCreateTicket = async (event) => {
        event.preventDefault();
        if (!activeWorkbenchId || creatingTicket)
            return;
        if (!createTicketForm.assignee_id) {
            setCreateTicketError('Assignee is required');
            return;
        }
        setCreatingTicket(true);
        setCreateTicketError('');
        try {
            await apiClient.post('/tickets/', {
                title: createTicketForm.title.trim(),
                description: createTicketForm.description.trim(),
                urgency: createTicketForm.urgency,
                category: createTicketForm.category.trim(),
                asset_id: createTicketForm.asset_id.trim(),
                workbench_id: activeWorkbenchId,
                assignee_id: createTicketForm.assignee_id,
            });
            setIsCreateTicketOpen(false);
            fetchTickets(activeWorkbenchId).then(setTickets).catch(() => { });
        }
        catch (err) {
            const data = err.response?.data;
            setCreateTicketError(data?.detail ||
                data?.workbench_id?.[0] ||
                data?.assignee_id?.[0] ||
                data?.title?.[0] ||
                'Failed to create ticket');
        }
        finally {
            setCreatingTicket(false);
        }
    };
    const handleOpenTicket = async (ticket) => {
        setEditTicketError('');
        setSelectedTicket(ticket);
        setEditTicketForm({
            title: ticket.title || '',
            description: ticket.description || '',
            status: ticket.status || 'OPEN',
            urgency: ticket.urgency || 'MEDIUM',
            category: ticket.category || '',
            asset_id: ticket.asset_id || '',
            resolution: ticket.resolution || '',
            assignee_id: ticket.assignee?.id || '',
        });
        if (workshopMembers.length === 0) {
            setWorkshopMembersLoading(true);
            try {
                const res = await apiClient.get('/workshops/me/members/');
                setWorkshopMembers(unwrapListPayload(res.data));
            }
            catch {
                // leave empty
            }
            finally {
                setWorkshopMembersLoading(false);
            }
        }
    };
    const handleSaveTicket = async (event) => {
        event.preventDefault();
        if (!selectedTicket || savingTicket)
            return;
        if ((editTicketForm.status === 'RESOLVED' || editTicketForm.status === 'CLOSED') &&
            !editTicketForm.resolution.trim()) {
            setEditTicketError('Resolution is required when status is RESOLVED or CLOSED');
            return;
        }
        setSavingTicket(true);
        setEditTicketError('');
        try {
            const response = await apiClient.patch(`/tickets/${selectedTicket.id}/`, {
                title: editTicketForm.title.trim(),
                description: editTicketForm.description.trim(),
                status: editTicketForm.status,
                urgency: editTicketForm.urgency,
                category: editTicketForm.category.trim(),
                asset_id: editTicketForm.asset_id.trim(),
                resolution: editTicketForm.resolution.trim(),
                assignee_id: editTicketForm.assignee_id || null,
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
        catch (err) {
            const data = err.response?.data;
            setEditTicketError(data?.detail ||
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
    const activeWorkbench = workbenches.find((workbench) => workbench.id === activeWorkbenchId);
    const canCreateWorkbenches = Boolean(workshop && currentRole === 'OWNER');
    const canInviteMembers = Boolean(workshop && currentRole === 'OWNER');
    const filteredMembers = availableMembers.filter((member) => {
        const query = memberSearch.trim().toLowerCase();
        if (!query)
            return true;
        return [member.username, member.full_name, member.email]
            .filter(Boolean)
            .some((value) => value.toLowerCase().includes(query));
    });
    return (_jsxs(_Fragment, { children: [_jsxs("div", { className: "workshop-page", children: [_jsxs("nav", { className: "workshop-navbar", children: [_jsxs("div", { className: "workshop-navbar-left", children: [_jsx(Link, { to: "/", className: "logo-link", style: { marginRight: '16px' }, children: "ResolveIT" }), _jsxs("button", { className: "workshop-back-btn", onClick: () => navigate('/dashboard'), children: [_jsx(ArrowLeft, { size: 14, strokeWidth: 1.75 }), "Dashboard"] }), _jsx("h1", { className: "workshop-title", children: "My Workshop" })] }), _jsxs("div", { className: "workshop-navbar-right", children: [canCreateWorkbenches ? (_jsxs("button", { className: "workshop-action-btn", onClick: () => {
                                            setCreateWorkbenchError('');
                                            setIsCreateWorkbenchOpen(true);
                                        }, title: "Create a workbench", children: [_jsx(Plus, { size: 14, strokeWidth: 1.75 }), "Create Workbench"] })) : null, _jsxs("button", { className: "workshop-action-btn", onClick: handleOpenInviteModal, disabled: !canInviteMembers, title: canInviteMembers ? 'Invite a member' : 'Only workshop owners can invite members', children: [_jsx(UserPlus, { size: 14, strokeWidth: 1.75 }), "Invite Member"] }), _jsx("span", { className: "logo-link", children: "ResolveIT" })] })] }), loading ? (_jsx("div", { className: "workshop-body", style: { display: 'flex', alignItems: 'center', justifyContent: 'center' }, children: _jsx("p", { style: { color: 'var(--fg-muted)' }, children: "Loading..." }) })) : (_jsxs("div", { className: "workshop-body", children: [_jsxs("aside", { className: "workshop-sidebar", children: [_jsx("div", { className: "workshop-sidebar-header", children: "Workbenches" }), workbenches.length === 0 ? (_jsx("p", { style: { padding: '12px', color: 'var(--fg-muted)', fontSize: '0.8rem' }, children: workshop ? 'No workbenches yet.' : 'Create a workshop to get started.' })) : (workbenches.map((workbench) => (_jsxs("div", { className: `workbench-item ${workbench.id === activeWorkbenchId ? 'active' : ''}`, onClick: () => setActiveWorkbenchId(workbench.id), children: [_jsx("span", { className: "workbench-dot", style: { backgroundColor: workbench.color || '#888' } }), workbench.name] }, workbench.id))))] }), _jsxs("div", { className: "workshop-middle", children: [_jsxs("div", { className: "workshop-middle-header", children: [_jsx(Ticket, { size: 15, strokeWidth: 1.75, style: { color: 'var(--fg-muted)' } }), _jsx("h2", { children: activeWorkbench?.name ?? workshop?.name ?? 'Workbench' }), activeWorkbenchId ? (_jsxs("button", { className: "workshop-action-btn", onClick: handleOpenCreateTicket, title: "Create a ticket in this workbench", children: [_jsx(Plus, { size: 14, strokeWidth: 1.75 }), "Create Ticket"] })) : null] }), _jsx("div", { className: "workshop-tickets", children: tickets.length === 0 ? (_jsx("p", { style: { color: 'var(--fg-muted)', padding: '8px 0', fontSize: '0.85rem' }, children: "No tickets in this workbench." })) : (tickets.map((ticket) => {
                                            const assigneeLabel = ticket.assignee?.full_name || ticket.assignee?.email || 'Unassigned';
                                            return (_jsx("div", { className: "ticket-card-inline", children: _jsxs("button", { type: "button", className: "ticket-row", onClick: () => void handleOpenTicket(ticket), children: [_jsx("span", { className: "ticket-id", children: String(ticket.id).slice(0, 8) }), _jsx("span", { className: "ticket-title", children: ticket.title }), _jsx("span", { className: "ticket-assignee", children: assigneeLabel }), _jsx("span", { className: `ticket-status ${ticket.status.toLowerCase().replace('_', '-')}`, children: ticket.status.replace('_', ' ').toLowerCase() })] }) }, ticket.id));
                                        })) }), _jsx("div", { className: "workshop-chat", children: activeChannelId ? (_jsxs(_Fragment, { children: [_jsx("div", { className: "chat-messages", children: messages.map((message) => {
                                                        const initials = `${message.sender.first_name?.[0] ?? ''}${message.sender.last_name?.[0] ?? ''}`.toUpperCase();
                                                        return (_jsxs("div", { className: "chat-message", children: [_jsx("div", { className: "chat-avatar", children: initials || '?' }), _jsxs("div", { className: "chat-bubble", children: [_jsxs("div", { className: "chat-sender", children: [message.sender.full_name, _jsx("span", { className: "chat-timestamp", children: new Date(message.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) })] }), _jsx("div", { className: "chat-text", children: message.content })] })] }, message.id));
                                                    }) }), _jsxs("div", { className: "chat-input-row", children: [_jsx("input", { className: "chat-input", placeholder: `Message ${activeWorkbench?.name ?? 'workbench'}...`, value: input, onChange: (event) => setInput(event.target.value), onKeyDown: handleKeyDown, disabled: sending }), _jsx("button", { className: "chat-send-btn", onClick: handleSend, disabled: sending, children: _jsx(Send, { size: 14, strokeWidth: 1.75 }) })] }), _jsx("div", { ref: messagesEndRef })] })) : (_jsx("div", { style: { padding: '16px', color: 'var(--fg-muted)', fontSize: '0.85rem' }, children: creatingChannel ? 'Setting up channel…' : 'No channel linked to this workbench.' })) })] })] }))] }), _jsx(CreateWorkshopModal, { isOpen: isCreateOpen, onClose: () => setIsCreateOpen(false), onSuccess: () => {
                    void refreshWorkshopPage();
                } }), isCreateWorkbenchOpen ? (_jsx("div", { className: "modal-overlay", onClick: () => setIsCreateWorkbenchOpen(false), children: _jsxs("div", { className: "modal-content workshop-create-workbench-modal", onClick: (event) => event.stopPropagation(), children: [_jsxs("div", { className: "modal-header", children: [_jsx("h2", { children: "Create Workbench" }), _jsx("button", { className: "modal-close-btn", onClick: () => setIsCreateWorkbenchOpen(false), "aria-label": "Close", children: "\u2715" })] }), _jsxs("form", { onSubmit: handleCreateWorkbench, className: "workshop-form", children: [_jsxs("div", { className: "form-group", children: [_jsx("label", { htmlFor: "workbench_name", children: "Name" }), _jsx("input", { id: "workbench_name", name: "workbench_name", type: "text", value: workbenchForm.name, onChange: (event) => setWorkbenchForm((prev) => ({ ...prev, name: event.target.value })), placeholder: "General Support", required: true, disabled: creatingWorkbench })] }), _jsxs("div", { className: "form-group", children: [_jsx("label", { htmlFor: "workbench_description", children: "Description" }), _jsx("textarea", { id: "workbench_description", name: "workbench_description", value: workbenchForm.description, onChange: (event) => setWorkbenchForm((prev) => ({ ...prev, description: event.target.value })), placeholder: "Optional description", rows: 3, disabled: creatingWorkbench })] }), _jsxs("div", { className: "form-group", children: [_jsx("label", { htmlFor: "workbench_color", children: "Color" }), _jsx("input", { id: "workbench_color", name: "workbench_color", type: "text", value: workbenchForm.color, onChange: (event) => setWorkbenchForm((prev) => ({ ...prev, color: event.target.value })), placeholder: "#e03131", disabled: creatingWorkbench })] }), createWorkbenchError ? _jsx("div", { className: "error-message", children: createWorkbenchError }) : null, _jsxs("div", { className: "modal-actions", children: [_jsx("button", { type: "button", className: "btn-cancel", onClick: () => setIsCreateWorkbenchOpen(false), disabled: creatingWorkbench, children: "Cancel" }), _jsx("button", { type: "submit", className: "btn-submit", disabled: creatingWorkbench || !workbenchForm.name.trim(), children: creatingWorkbench ? 'Creating...' : 'Create Workbench' })] })] })] }) })) : null, isCreateTicketOpen ? (_jsx("div", { className: "modal-overlay", onClick: () => setIsCreateTicketOpen(false), children: _jsxs("div", { className: "modal-content", onClick: (event) => event.stopPropagation(), children: [_jsxs("div", { className: "modal-header", children: [_jsxs("h2", { children: ["Create Ticket \u2014 ", activeWorkbench?.name] }), _jsx("button", { className: "modal-close-btn", onClick: () => setIsCreateTicketOpen(false), "aria-label": "Close", children: "\u2715" })] }), _jsxs("form", { onSubmit: handleCreateTicket, className: "workshop-form", children: [_jsxs("div", { className: "form-group", children: [_jsx("label", { htmlFor: "ticket_title", children: "Title" }), _jsx("input", { id: "ticket_title", value: createTicketForm.title, onChange: (event) => setCreateTicketForm((prev) => ({ ...prev, title: event.target.value })), required: true, disabled: creatingTicket })] }), _jsxs("div", { className: "form-group", children: [_jsx("label", { htmlFor: "ticket_description", children: "Description" }), _jsx("textarea", { id: "ticket_description", rows: 3, value: createTicketForm.description, onChange: (event) => setCreateTicketForm((prev) => ({ ...prev, description: event.target.value })), required: true, disabled: creatingTicket })] }), _jsxs("div", { className: "form-group", children: [_jsx("label", { htmlFor: "ticket_category", children: "Category" }), _jsx("input", { id: "ticket_category", value: createTicketForm.category, onChange: (event) => setCreateTicketForm((prev) => ({ ...prev, category: event.target.value })), required: true, disabled: creatingTicket })] }), _jsxs("div", { className: "form-group", children: [_jsx("label", { htmlFor: "ticket_urgency", children: "Urgency" }), _jsxs("select", { id: "ticket_urgency", value: createTicketForm.urgency, onChange: (event) => setCreateTicketForm((prev) => ({ ...prev, urgency: event.target.value })), disabled: creatingTicket, children: [_jsx("option", { value: "LOW", children: "LOW" }), _jsx("option", { value: "MEDIUM", children: "MEDIUM" }), _jsx("option", { value: "HIGH", children: "HIGH" }), _jsx("option", { value: "CRITICAL", children: "CRITICAL" })] })] }), _jsxs("div", { className: "form-group", children: [_jsx("label", { htmlFor: "ticket_asset_id", children: "Asset ID" }), _jsx("input", { id: "ticket_asset_id", value: createTicketForm.asset_id, onChange: (event) => setCreateTicketForm((prev) => ({ ...prev, asset_id: event.target.value })), disabled: creatingTicket })] }), _jsxs("div", { className: "form-group", children: [_jsx("label", { htmlFor: "ticket_assignee", children: "Assignee" }), _jsxs("select", { id: "ticket_assignee", value: createTicketForm.assignee_id, onChange: (event) => setCreateTicketForm((prev) => ({ ...prev, assignee_id: event.target.value })), required: true, disabled: creatingTicket || workshopMembersLoading, children: [_jsx("option", { value: "", children: workshopMembersLoading ? 'Loading...' : 'Select a member' }), workshopMembers.map((member) => (_jsx("option", { value: member.id, children: member.full_name || member.username }, member.id)))] })] }), createTicketError ? _jsx("div", { className: "error-message", children: createTicketError }) : null, _jsxs("div", { className: "modal-actions", children: [_jsx("button", { type: "button", className: "btn-cancel", onClick: () => setIsCreateTicketOpen(false), disabled: creatingTicket, children: "Cancel" }), _jsx("button", { type: "submit", className: "btn-submit", disabled: creatingTicket, children: creatingTicket ? 'Creating...' : 'Create Ticket' })] })] })] }) })) : null, selectedTicket ? (_jsx("div", { className: "modal-overlay", onClick: () => setSelectedTicket(null), children: _jsxs("div", { className: "modal-content", onClick: (event) => event.stopPropagation(), children: [_jsxs("div", { className: "modal-header", children: [_jsx("h2", { children: "Edit Ticket" }), _jsx("button", { className: "modal-close-btn", onClick: () => setSelectedTicket(null), "aria-label": "Close", children: "\u2715" })] }), _jsxs("form", { onSubmit: handleSaveTicket, className: "workshop-form", children: [_jsxs("div", { className: "form-group", children: [_jsx("label", { htmlFor: "workshop_edit_ticket_title", children: "Title" }), _jsx("input", { id: "workshop_edit_ticket_title", value: editTicketForm.title, onChange: (event) => setEditTicketForm((prev) => ({ ...prev, title: event.target.value })), required: true, disabled: savingTicket })] }), _jsxs("div", { className: "form-group", children: [_jsx("label", { htmlFor: "workshop_edit_ticket_description", children: "Description" }), _jsx("textarea", { id: "workshop_edit_ticket_description", rows: 3, value: editTicketForm.description, onChange: (event) => setEditTicketForm((prev) => ({ ...prev, description: event.target.value })), required: true, disabled: savingTicket })] }), _jsxs("div", { className: "form-group", children: [_jsx("label", { htmlFor: "workshop_edit_ticket_status", children: "Status" }), _jsxs("select", { id: "workshop_edit_ticket_status", value: editTicketForm.status, onChange: (event) => setEditTicketForm((prev) => ({ ...prev, status: event.target.value })), disabled: savingTicket, children: [_jsx("option", { value: "OPEN", children: "OPEN" }), _jsx("option", { value: "ASSIGNED", children: "ASSIGNED" }), _jsx("option", { value: "IN_PROGRESS", children: "IN_PROGRESS" }), _jsx("option", { value: "RESOLVED", children: "RESOLVED" }), _jsx("option", { value: "CLOSED", children: "CLOSED" })] }), _jsx("div", { style: { marginTop: '6px', fontSize: '0.8rem', color: 'var(--fg-muted)' }, children: editTicketForm.status === 'CLOSED'
                                                ? 'Status: CLOSED (ticket is retained; it is not deleted).'
                                                : `Status: ${editTicketForm.status}` })] }), _jsxs("div", { className: "form-group", children: [_jsx("label", { htmlFor: "workshop_edit_ticket_urgency", children: "Urgency" }), _jsxs("select", { id: "workshop_edit_ticket_urgency", value: editTicketForm.urgency, onChange: (event) => setEditTicketForm((prev) => ({ ...prev, urgency: event.target.value })), disabled: savingTicket, children: [_jsx("option", { value: "LOW", children: "LOW" }), _jsx("option", { value: "MEDIUM", children: "MEDIUM" }), _jsx("option", { value: "HIGH", children: "HIGH" }), _jsx("option", { value: "CRITICAL", children: "CRITICAL" })] })] }), _jsxs("div", { className: "form-group", children: [_jsx("label", { htmlFor: "workshop_edit_ticket_category", children: "Category" }), _jsx("input", { id: "workshop_edit_ticket_category", value: editTicketForm.category, onChange: (event) => setEditTicketForm((prev) => ({ ...prev, category: event.target.value })), required: true, disabled: savingTicket })] }), _jsxs("div", { className: "form-group", children: [_jsx("label", { htmlFor: "workshop_edit_ticket_asset_id", children: "Asset ID" }), _jsx("input", { id: "workshop_edit_ticket_asset_id", value: editTicketForm.asset_id, onChange: (event) => setEditTicketForm((prev) => ({ ...prev, asset_id: event.target.value })), disabled: savingTicket })] }), _jsxs("div", { className: "form-group", children: [_jsx("label", { htmlFor: "workshop_edit_ticket_assignee", children: "Assignee" }), _jsxs("select", { id: "workshop_edit_ticket_assignee", value: editTicketForm.assignee_id, onChange: (event) => setEditTicketForm((prev) => ({ ...prev, assignee_id: event.target.value })), disabled: savingTicket || workshopMembersLoading, children: [_jsx("option", { value: "", children: "Unassigned" }), workshopMembers.map((member) => (_jsx("option", { value: member.id, children: member.full_name || member.username }, member.id)))] })] }), _jsxs("div", { className: "form-group", children: [_jsx("label", { htmlFor: "workshop_edit_ticket_resolution", children: "Resolution" }), _jsx("textarea", { id: "workshop_edit_ticket_resolution", rows: 3, value: editTicketForm.resolution, onChange: (event) => setEditTicketForm((prev) => ({ ...prev, resolution: event.target.value })), disabled: savingTicket })] }), _jsxs("div", { className: "form-group", children: [_jsx("label", { children: "Created" }), _jsx("input", { value: new Date(selectedTicket.created_at).toLocaleString(), disabled: true })] }), _jsxs("div", { className: "form-group", children: [_jsx("label", { children: "Updated" }), _jsx("input", { value: new Date(selectedTicket.updated_at).toLocaleString(), disabled: true })] }), editTicketError ? _jsx("div", { className: "error-message", children: editTicketError }) : null, _jsxs("div", { className: "modal-actions", children: [_jsx("button", { type: "button", className: "btn-cancel", onClick: () => setSelectedTicket(null), disabled: savingTicket, children: "Cancel" }), _jsx("button", { type: "submit", className: "btn-submit", disabled: savingTicket, children: savingTicket ? 'Saving...' : 'Save Changes' })] })] })] }) })) : null, isInviteOpen ? (_jsx("div", { className: "modal-overlay", onClick: () => setIsInviteOpen(false), children: _jsxs("div", { className: "modal-content workshop-invite-modal", onClick: (event) => event.stopPropagation(), children: [_jsxs("div", { className: "modal-header", children: [_jsx("h2", { children: "Invite Members" }), _jsx("button", { className: "modal-close-btn", onClick: () => setIsInviteOpen(false), "aria-label": "Close", children: "\u2715" })] }), _jsxs("div", { className: "workshop-form", children: [_jsx("div", { className: "workshop-member-search", children: _jsx("input", { type: "text", value: memberSearch, onChange: (event) => setMemberSearch(event.target.value), placeholder: "Search by username, name, or email", disabled: inviteLoading }) }), inviteError ? _jsx("div", { className: "error-message", children: inviteError }) : null, inviteSuccess ? _jsx("div", { className: "workshop-success-message", children: inviteSuccess }) : null, _jsx("div", { className: "workshop-member-list", children: inviteLoading ? (_jsx("p", { className: "workshop-member-empty", children: "Loading members..." })) : filteredMembers.length === 0 ? (_jsx("p", { className: "workshop-member-empty", children: availableMembers.length === 0 ? 'No available members to add.' : 'No members match your search.' })) : (filteredMembers.map((member) => (_jsxs("button", { type: "button", className: "workshop-member-item", onClick: () => handleAddMember(member), disabled: addingMemberId === member.id, children: [_jsxs("div", { className: "workshop-member-copy", children: [_jsx("span", { className: "workshop-member-name", children: member.full_name || member.username }), _jsxs("span", { className: "workshop-member-username", children: ["@", member.username] }), _jsx("span", { className: "workshop-member-email", children: member.email })] }), _jsx("span", { className: "workshop-member-action", children: addingMemberId === member.id ? 'Adding...' : 'Add' })] }, member.id)))) })] })] }) })) : null] }));
};
export default Workshop;
