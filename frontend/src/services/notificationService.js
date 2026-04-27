// Mock Notifications Service
class NotificationService {
    constructor() {
        Object.defineProperty(this, "notifications", {
            enumerable: true,
            configurable: true,
            writable: true,
            value: [
                {
                    id: '1',
                    message: 'Welcome to ResolveIT! Your account has been created successfully.',
                    type: 'success',
                    timestamp: new Date(Date.now() - 5 * 60000), // 5 minutes ago
                    read: false,
                },
                {
                    id: '2',
                    message: 'You have been added to the "IT Support" workshop.',
                    type: 'info',
                    timestamp: new Date(Date.now() - 30 * 60000), // 30 minutes ago
                    read: false,
                },
                {
                    id: '3',
                    message: 'New ticket #1001 has been assigned to you.',
                    type: 'info',
                    timestamp: new Date(Date.now() - 2 * 60 * 60 * 1000), // 2 hours ago
                    read: true,
                },
                {
                    id: '4',
                    message: 'Your password was successfully changed.',
                    type: 'success',
                    timestamp: new Date(Date.now() - 24 * 60 * 60 * 1000), // 1 day ago
                    read: true,
                },
                {
                    id: '5',
                    message: 'Workshop "Project X" reached 50 open tickets.',
                    type: 'warning',
                    timestamp: new Date(Date.now() - 48 * 60 * 60 * 1000), // 2 days ago
                    read: true,
                },
            ]
        });
    }
    getNotifications() {
        return this.notifications;
    }
    getUnreadCount() {
        return this.notifications.filter(n => !n.read).length;
    }
    markAsRead(id) {
        const notification = this.notifications.find(n => n.id === id);
        if (notification) {
            notification.read = true;
        }
    }
    markAllAsRead() {
        this.notifications.forEach(n => {
            n.read = true;
        });
    }
    addNotification(message, type = 'info') {
        const notification = {
            id: Math.random().toString(),
            message,
            type,
            timestamp: new Date(),
            read: false,
        };
        this.notifications.unshift(notification);
    }
    formatTime(date) {
        const now = new Date();
        const diff = now.getTime() - date.getTime();
        const minutes = Math.floor(diff / 60000);
        const hours = Math.floor(diff / 3600000);
        const days = Math.floor(diff / 86400000);
        if (minutes < 1)
            return 'Just now';
        if (minutes < 60)
            return `${minutes}m ago`;
        if (hours < 24)
            return `${hours}h ago`;
        if (days < 7)
            return `${days}d ago`;
        return date.toLocaleDateString();
    }
}
export const notificationService = new NotificationService();
export default notificationService;
