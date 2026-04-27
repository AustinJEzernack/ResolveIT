// Mock Authentication Service
// This simulates a backend until the real one is ready
// Mock users database
const mockUsers = {
    'demo@example.com': {
        password: 'Password123',
        user: {
            id: '1',
            email: 'demo@example.com',
            first_name: 'Demo',
            last_name: 'User',
        },
    },
};
export const mockAuth = {
    login: async (email, password) => {
        // Simulate network delay
        await new Promise(resolve => setTimeout(resolve, 500));
        const user = mockUsers[email];
        if (!user || user.password !== password) {
            throw {
                response: {
                    data: { detail: 'Invalid email or password' },
                },
            };
        }
        // Generate mock JWT token
        const token = btoa(JSON.stringify({ email, iat: Date.now() }));
        return {
            access: token,
            refresh: token + '_refresh',
            user: user.user,
        };
    },
    register: async (email, first_name, last_name, password, password_confirm) => {
        // Simulate network delay
        await new Promise(resolve => setTimeout(resolve, 500));
        // Validation
        if (password !== password_confirm) {
            throw {
                response: {
                    data: { detail: 'Passwords do not match' },
                },
            };
        }
        if (password.length < 8) {
            throw {
                response: {
                    data: { detail: 'Password must be at least 8 characters' },
                },
            };
        }
        // Check if user already exists
        if (mockUsers[email]) {
            throw {
                response: {
                    data: { email: ['User with this email already exists'] },
                },
            };
        }
        // Create new user
        const newUser = {
            id: Math.random().toString(),
            email,
            first_name,
            last_name,
        };
        mockUsers[email] = {
            password,
            user: newUser,
        };
        // Generate mock JWT token
        const token = btoa(JSON.stringify({ email, iat: Date.now() }));
        return {
            access: token,
            refresh: token + '_refresh',
            user: newUser,
        };
    },
    getCurrentUser: () => {
        const token = localStorage.getItem('access_token');
        if (!token)
            return null;
        try {
            const decoded = JSON.parse(atob(token));
            const user = mockUsers[decoded.email];
            return user ? user.user : null;
        }
        catch {
            return null;
        }
    },
    logout: () => {
        localStorage.removeItem('access_token');
        localStorage.removeItem('refresh_token');
    },
    isAuthenticated: () => {
        return !!localStorage.getItem('access_token');
    },
};
export default mockAuth;
