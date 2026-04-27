import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
import { useMemo, useState, useEffect } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { Check, Info, AlertTriangle, X, MessageSquare, Settings, ChevronLeft, ChevronRight } from 'lucide-react';
import apiClient from '@services/api';
import { clearAuthTokens, getAccessToken, getRefreshToken } from '@services/auth';
import notificationService from '@services/notificationService';
import '../styles/Dashboard.css';
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
const Dashboard = () => {
    const navigate = useNavigate();
    const [user, setUser] = useState(null);
    const [notifications, setNotifications] = useState(notificationService.getNotifications());
    const [sidebarOpen, setSidebarOpen] = useState(true);
    const [menuOpen, setMenuOpen] = useState(false);
    const [workshops, setWorkshops] = useState([]);
    const [workshopsLoading, setWorkshopsLoading] = useState(true);
    const [tickets, setTickets] = useState([]);
    const [ticketsLoading, setTicketsLoading] = useState(true);
    const [selectedTicket, setSelectedTicket] = useState(null);
    const [showWorkshopModal, setShowWorkshopModal] = useState(false);
    const [showWorkshopSettingsModal, setShowWorkshopSettingsModal] = useState(false);
    const [selectedWorkshop, setSelectedWorkshop] = useState(null);
    const [workshopMembers, setWorkshopMembers] = useState([]);
    const [workshopMembersLoading, setWorkshopMembersLoading] = useState(false);
    const [workshopFormData, setWorkshopFormData] = useState({ name: '', description: '' });
    const [creatingWorkshop, setCreatingWorkshop] = useState(false);
    const ownerMember = useMemo(() => workshopMembers.find((member) => String(member.role).toUpperCase() === 'OWNER') ?? null, [workshopMembers]);
    const technicianMembers = useMemo(() => workshopMembers.filter((member) => String(member.role).toUpperCase() === 'TECHNICIAN'), [workshopMembers]);
    const publicIntakeUrl = useMemo(() => {
        const slug = selectedWorkshop?.slug;
        if (!slug)
            return '';
        return `${window.location.origin}/api/workshops/${slug}/intake/`;
    }, [selectedWorkshop]);
    useEffect(() => {
        if (!getAccessToken()) {
            navigate('/login');
            return;
        }
        apiClient.get('/auth/me/')
            .then((response) => setUser(response.data))
            .catch(() => {
            clearAuthTokens();
            navigate('/login');
        });
    }, [navigate]);
    useEffect(() => {
        if (user) {
            apiClient.get('/workshops/me/')
                .then((response) => {
                setWorkshops(response.data ? [response.data] : []);
                setWorkshopsLoading(false);
            })
                .catch((error) => {
                // 404 means the user has no workshop yet — that's a normal state
                if (error.response?.status !== 404) {
                    console.error('Failed to load workshops:', error);
                }
                setWorkshops([]);
                setWorkshopsLoading(false);
            });
        }
    }, [user]);
    useEffect(() => {
        if (user) {
            setTicketsLoading(true);
            apiClient.get(`/tickets/?assignee=${user.id}&limit=100`)
                .then((response) => {
                setTickets(unwrapListPayload(response.data));
                setTicketsLoading(false);
            })
                .catch((error) => {
                console.error('Failed to load tickets:', error);
                setTickets([]);
                setTicketsLoading(false);
            });
        }
    }, [user]);
    const handleLogout = () => {
        const refreshToken = getRefreshToken();
        if (refreshToken) {
            apiClient.post('/auth/logout/', { refresh_token: refreshToken }).catch(() => { });
        }
        clearAuthTokens();
        navigate('/login');
    };
    const handleMarkAsRead = (id) => {
        notificationService.markAsRead(id);
        setNotifications([...notifications]);
    };
    const handleMarkAllAsRead = () => {
        notificationService.markAllAsRead();
        setNotifications([...notifications]);
    };
    const unreadCount = notifications.filter(n => !n.read).length;
    const handleCreateWorkshop = async (e) => {
        e.preventDefault();
        if (!workshopFormData.name.trim()) {
            alert('Workshop name is required');
            return;
        }
        setCreatingWorkshop(true);
        try {
            const response = await apiClient.post('/workshops/create/', {
                name: workshopFormData.name,
                description: workshopFormData.description,
            });
            // Add new workshop to the list
            setWorkshops([...workshops, response.data]);
            setShowWorkshopModal(false);
            setWorkshopFormData({ name: '', description: '' });
            // Do not navigate — just add to "Your Workshops" list
        }
        catch (error) {
            console.error('Failed to create workshop:', error);
            alert('Failed to create workshop');
        }
        finally {
            setCreatingWorkshop(false);
        }
    };
    const handleOpenWorkshopSettings = async (workshop) => {
        setSelectedWorkshop(workshop);
        setShowWorkshopSettingsModal(true);
        setWorkshopMembers([]);
        setWorkshopMembersLoading(true);
        try {
            const response = await apiClient.get('/workshops/me/members/');
            setWorkshopMembers(unwrapListPayload(response.data));
        }
        catch {
            setWorkshopMembers([]);
        }
        finally {
            setWorkshopMembersLoading(false);
        }
    };
    // Close modal when clicking outside
    useEffect(() => {
        const handleClickOutside = (event) => {
            const modal = document.querySelector('.workshop-modal-content');
            const btn = document.querySelector('.create-workshop-btn');
            if (modal && !modal.contains(event.target) && !btn?.contains(event.target)) {
                setShowWorkshopModal(false);
            }
        };
        if (showWorkshopModal) {
            document.addEventListener('mousedown', handleClickOutside);
            return () => document.removeEventListener('mousedown', handleClickOutside);
        }
    }, [showWorkshopModal]);
    return (_jsxs("div", { className: "dashboard-container", children: [_jsx("nav", { className: "dashboard-navbar", children: _jsxs("div", { className: "navbar-content", children: [_jsx(Link, { to: "/", className: "logo-link", children: "ResolveIT" }), _jsxs("div", { className: "navbar-user", children: [_jsxs("span", { className: "user-name", children: [user?.first_name, " ", user?.last_name] }), _jsxs("div", { className: "navbar-menu", children: [_jsx("button", { onClick: () => setMenuOpen(!menuOpen), className: "menu-btn", children: "\u2630" }), menuOpen && (_jsxs("div", { className: "dropdown-menu", children: [_jsxs("button", { className: "dropdown-item", onClick: () => { setMenuOpen(false); }, children: [_jsx(MessageSquare, { size: 16, strokeWidth: 1.75 }), _jsx("span", { children: "Messages" })] }), _jsxs("button", { className: "dropdown-item", onClick: () => { setMenuOpen(false); }, children: [_jsx(Settings, { size: 16, strokeWidth: 1.75 }), _jsx("span", { children: "Settings" })] }), _jsx("div", { className: "dropdown-divider" }), _jsxs("button", { className: "dropdown-item danger", onClick: handleLogout, children: [_jsx(X, { size: 16, strokeWidth: 1.75 }), _jsx("span", { children: "Logout" })] })] }))] })] })] }) }), _jsxs("div", { className: "dashboard-wrapper", children: [_jsxs("aside", { className: `activity-sidebar ${sidebarOpen ? 'open' : 'closed'}`, children: [_jsx("div", { className: "sidebar-toggle", children: _jsx("button", { onClick: () => setSidebarOpen(!sidebarOpen), className: "toggle-btn", title: sidebarOpen ? 'Close activity log' : 'Open activity log', children: sidebarOpen ? _jsx(ChevronLeft, { size: 18 }) : _jsx(ChevronRight, { size: 18 }) }) }), _jsxs("div", { className: "sidebar-header", children: [_jsx("h2", { children: "Activity Log" }), unreadCount > 0 && (_jsx("button", { onClick: handleMarkAllAsRead, className: "mark-all-btn", children: "Mark all as read" }))] }), _jsx("div", { className: "notifications-list", children: notifications.length === 0 ? (_jsx("div", { className: "empty-state", children: _jsx("p", { children: "No notifications yet" }) })) : (notifications.map((notification) => (_jsxs("div", { className: `notification-item ${notification.type} ${notification.read ? 'read' : 'unread'}`, onClick: () => handleMarkAsRead(notification.id), children: [_jsxs("div", { className: "notification-icon", children: [notification.type === 'success' && _jsx(Check, { size: 16, strokeWidth: 1.75 }), notification.type === 'info' && _jsx(Info, { size: 16, strokeWidth: 1.75 }), notification.type === 'warning' && _jsx(AlertTriangle, { size: 16, strokeWidth: 1.75 }), notification.type === 'error' && _jsx(X, { size: 16, strokeWidth: 1.75 })] }), _jsxs("div", { className: "notification-content", children: [_jsx("p", { className: "notification-message", children: notification.message }), _jsx("span", { className: "notification-time", children: notificationService.formatTime(notification.timestamp) })] }), !notification.read && _jsx("div", { className: "unread-indicator" })] }, notification.id)))) })] }), _jsxs("main", { className: "dashboard-main", children: [_jsxs("div", { className: "welcome-section", children: [_jsxs("h1", { children: ["Welcome, ", user?.first_name, "!"] }), _jsx("p", { children: "You are successfully logged in to ResolveIT" })] }), _jsx("div", { className: "dashboard-grid" }), _jsxs("section", { className: "workshops-section", children: [_jsxs("div", { className: "workshops-header", children: [_jsx("h2", { children: "Your Workshops" }), user?.role?.toLowerCase() === 'owner' && (_jsx("button", { className: "create-workshop-btn", onClick: () => setShowWorkshopModal(true), children: "Create Workshop" }))] }), workshopsLoading ? (_jsx("p", { children: "Loading workshops..." })) : workshops.length === 0 ? (_jsx("p", { className: "empty-workshops", children: "You are not in any workshops yet." })) : (_jsx("div", { className: "workshops-list", children: workshops.map((workshop) => (_jsxs("div", { className: "workshop-item", children: [_jsx("div", { className: "workshop-info", children: _jsx("h3", { children: workshop.name }) }), _jsxs("div", { className: "workshop-actions", children: [_jsx("button", { className: "workshop-btn workshop-settings-btn", onClick: () => handleOpenWorkshopSettings(workshop), children: "Settings" }), _jsx("button", { className: "workshop-btn", onClick: () => navigate('/workshop'), children: "Enter Workshop" })] })] }, workshop.id))) }))] }), _jsxs("section", { className: "tickets-section", children: [_jsx("h2", { children: "Your Tickets" }), ticketsLoading ? (_jsx("p", { children: "Loading tickets..." })) : tickets.length === 0 ? (_jsx("p", { className: "empty-tickets", children: "No tickets assigned to you." })) : (_jsx("div", { className: "tickets-list", children: tickets.map((ticket) => (_jsxs("div", { className: "ticket-item", children: [_jsxs("div", { className: "ticket-info", children: [_jsx("h3", { children: ticket.title }), _jsxs("p", { className: "ticket-user", children: ["Workshop: ", workshops[0]?.name || '—'] }), _jsxs("p", { className: "ticket-user", children: ["Last Updated: ", new Date(ticket.updated_at).toLocaleDateString()] }), _jsxs("p", { className: "ticket-user", children: ["Status: ", ticket.status] })] }), _jsx("button", { className: "ticket-details-btn", onClick: () => setSelectedTicket(ticket), children: "View Details" })] }, ticket.id))) }))] }), selectedTicket && (_jsx("div", { className: "modal-overlay", onClick: () => setSelectedTicket(null), children: _jsxs("div", { className: "modal-content", onClick: (e) => e.stopPropagation(), children: [_jsxs("div", { className: "modal-header", children: [_jsx("h2", { children: "Ticket Details" }), _jsx("button", { className: "modal-close", onClick: () => setSelectedTicket(null), children: _jsx(X, { size: 20 }) })] }), _jsxs("div", { className: "modal-body", children: [_jsxs("div", { className: "detail-row", children: [_jsx("strong", { children: "Title:" }), _jsx("p", { children: selectedTicket.title })] }), _jsxs("div", { className: "detail-row", children: [_jsx("strong", { children: "Description:" }), _jsx("p", { children: selectedTicket.description })] }), _jsxs("div", { className: "detail-row", children: [_jsx("strong", { children: "Status:" }), _jsx("p", { className: `status-badge status-${selectedTicket.status?.toLowerCase()}`, children: selectedTicket.status })] }), _jsxs("div", { className: "detail-row", children: [_jsx("strong", { children: "Urgency:" }), _jsx("p", { children: selectedTicket.urgency })] }), _jsxs("div", { className: "detail-row", children: [_jsx("strong", { children: "Requested By:" }), _jsxs("p", { children: [selectedTicket.requestor?.first_name, " ", selectedTicket.requestor?.last_name, " (", selectedTicket.requestor?.email, ")"] })] }), _jsxs("div", { className: "detail-row", children: [_jsx("strong", { children: "Assigned To:" }), _jsxs("p", { children: [selectedTicket.assignee?.first_name, " ", selectedTicket.assignee?.last_name] })] }), _jsxs("div", { className: "detail-row", children: [_jsx("strong", { children: "Created:" }), _jsx("p", { children: new Date(selectedTicket.created_at).toLocaleDateString() })] })] }), _jsxs("div", { className: "modal-footer", children: [_jsx("button", { className: "modal-btn", onClick: () => navigate(`/tickets`), children: "Go to Tickets" }), _jsx("button", { className: "modal-btn modal-btn-close", onClick: () => setSelectedTicket(null), children: "Close" })] })] }) })), showWorkshopModal && (_jsx("div", { className: "workshop-modal-overlay", onClick: () => setShowWorkshopModal(false), children: _jsxs("div", { className: "workshop-modal-content", onClick: (e) => e.stopPropagation(), children: [_jsxs("div", { className: "workshop-modal-header", children: [_jsx("h2", { children: "Create Workshop" }), _jsx("button", { className: "workshop-modal-close", onClick: () => setShowWorkshopModal(false), children: _jsx(X, { size: 20 }) })] }), _jsxs("form", { onSubmit: handleCreateWorkshop, children: [_jsxs("div", { className: "form-group", children: [_jsx("label", { htmlFor: "workshop-name", children: "Workshop Name" }), _jsx("input", { id: "workshop-name", type: "text", placeholder: "Enter workshop name", value: workshopFormData.name, onChange: (e) => setWorkshopFormData({ ...workshopFormData, name: e.target.value }), disabled: creatingWorkshop, required: true })] }), _jsxs("div", { className: "form-group", children: [_jsx("label", { htmlFor: "workshop-desc", children: "Description (Optional)" }), _jsx("textarea", { id: "workshop-desc", placeholder: "Enter workshop description", value: workshopFormData.description, onChange: (e) => setWorkshopFormData({ ...workshopFormData, description: e.target.value }), disabled: creatingWorkshop, rows: 4 })] }), _jsxs("div", { className: "workshop-modal-footer", children: [_jsx("button", { type: "button", className: "modal-btn-cancel", onClick: () => setShowWorkshopModal(false), disabled: creatingWorkshop, children: "Cancel" }), _jsx("button", { type: "submit", className: "modal-btn-create", disabled: creatingWorkshop, children: creatingWorkshop ? 'Creating...' : 'Create Workshop' })] })] })] }) })), showWorkshopSettingsModal && selectedWorkshop && (_jsx("div", { className: "modal-overlay", onClick: () => setShowWorkshopSettingsModal(false), children: _jsxs("div", { className: "modal-content", onClick: (e) => e.stopPropagation(), children: [_jsxs("div", { className: "modal-header", children: [_jsx("h2", { children: "Workshop Settings" }), _jsx("button", { className: "modal-close", onClick: () => setShowWorkshopSettingsModal(false), children: _jsx(X, { size: 20 }) })] }), _jsxs("div", { className: "modal-body", children: [_jsxs("div", { className: "detail-row", children: [_jsx("strong", { children: "Name" }), _jsx("p", { children: selectedWorkshop.name })] }), _jsxs("div", { className: "detail-row", children: [_jsx("strong", { children: "Owner" }), _jsx("p", { children: ownerMember
                                                                ? `${ownerMember.first_name} ${ownerMember.last_name} (${ownerMember.email})`
                                                                : 'Not available' })] }), _jsxs("div", { className: "detail-row", children: [_jsx("strong", { children: "Technicians" }), workshopMembersLoading ? (_jsx("p", { children: "Loading technicians..." })) : technicianMembers.length === 0 ? (_jsx("p", { children: "No technicians found." })) : (_jsx("ul", { className: "settings-member-list", children: technicianMembers.map((member) => (_jsxs("li", { children: [member.first_name, " ", member.last_name, " (", member.email, ")"] }, member.id))) }))] }), _jsxs("div", { className: "detail-row", children: [_jsx("strong", { children: "Public Ticket Submission URL" }), _jsxs("div", { className: "settings-url-row", children: [_jsx("p", { children: publicIntakeUrl }), _jsx("button", { className: "modal-btn", type: "button", onClick: () => {
                                                                        if (!publicIntakeUrl)
                                                                            return;
                                                                        void navigator.clipboard.writeText(publicIntakeUrl);
                                                                    }, children: "Copy URL" })] })] })] }), _jsx("div", { className: "modal-footer", children: _jsx("button", { className: "modal-btn modal-btn-close", onClick: () => setShowWorkshopSettingsModal(false), children: "Close" }) })] }) }))] })] })] }));
};
export default Dashboard;
