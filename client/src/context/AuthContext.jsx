import React, { createContext, useContext, useState } from 'react';
import { login, verifyDevicePin, switchCompany as apiSwitchCompany } from '../services/api';
import { queryClient } from '../services/queryClient';

const AuthContext = createContext(null);

export const useAuth = () => {
    const context = useContext(AuthContext);
    if (!context) {
        throw new Error('useAuth must be used within AuthProvider');
    }
    return context;
};

const readStoredSession = () => {
    try {
        const token = localStorage.getItem('auth_token') || sessionStorage.getItem('auth_token');
        if (!token) return { token: null, authType: null, user: null };
        const authType = localStorage.getItem('auth_type') || sessionStorage.getItem('auth_type');
        const storedUser = localStorage.getItem('auth_user') || sessionStorage.getItem('auth_user');
        return { token, authType, user: storedUser ? JSON.parse(storedUser) : null };
    } catch {
        return { token: null, authType: null, user: null };
    }
};

export const AuthProvider = ({ children }) => {
    // Read the stored session synchronously so the very first render is already
    // authenticated. Loading it in an effect made AdminLayout redirect to the login
    // for one frame on every reload (full-screen flash).
    const [initialSession] = useState(readStoredSession);
    const [user, setUser] = useState(initialSession.user);
    const [token, setToken] = useState(initialSession.token);
    const [loading] = useState(false);
    const [authType, setAuthType] = useState(initialSession.authType); // 'admin' or 'device'

    // Admin login
    const loginAdmin = async (email, password, rememberMe = true) => {
        try {
            const result = await login({ email, password });

            if (result.success) {
                setToken(result.data.token);
                setUser(result.data.user);
                setAuthType('admin');

                const storage = rememberMe ? localStorage : sessionStorage;
                storage.setItem('auth_token', result.data.token);
                storage.setItem('auth_type', 'admin');
                storage.setItem('auth_user', JSON.stringify(result.data.user));

                return { success: true };
            } else {
                return { success: false, error: result.error };
            }
        } catch (error) {
            return { success: false, error: error.message };
        }
    };

    // Device PIN login
    const loginDevice = async (deviceId, pin) => {
        try {
            const result = await verifyDevicePin({ deviceId, pin });

            if (result.success) {
                setToken(result.data.token);
                setUser({ deviceId: result.data.deviceId });
                setAuthType('device');

                localStorage.setItem('auth_token', result.data.token);
                localStorage.setItem('auth_type', 'device');
                localStorage.setItem('auth_user', JSON.stringify({ deviceId: result.data.deviceId }));

                return { success: true, deviceId: result.data.deviceId };
            } else {
                return { success: false, error: result.error };
            }
        } catch (error) {
            return { success: false, error: error.message };
        }
    };

    // Switch active company without full page reload
    const switchActiveCompany = async (targetCompanyId) => {
        try {
            const res = await apiSwitchCompany(targetCompanyId);
            if (res.success && res.data.token) {
                const newToken = res.data.token;
                // Cached tab data belongs to the previous company
                queryClient.clear();
                setToken(newToken);

                const storage = localStorage.getItem('auth_user') ? localStorage : sessionStorage;

                setUser(prev => {
                    const updated = {
                        ...prev,
                        companyId: res.data.companyId,
                        companyName: res.data.companyName
                    };
                    storage.setItem('auth_user', JSON.stringify(updated));
                    return updated;
                });

                if (localStorage.getItem('auth_token')) {
                    localStorage.setItem('auth_token', newToken);
                }
                if (sessionStorage.getItem('auth_token')) {
                    sessionStorage.setItem('auth_token', newToken);
                }
                localStorage.setItem('adminToken', newToken);

                return { success: true, data: res.data };
            }
            return { success: false, error: res.error || 'Failed to switch company' };
        } catch (error) {
            return { success: false, error: error.message };
        }
    };

    // Logout
    const logout = () => {
        queryClient.clear();
        setToken(null);
        setUser(null);
        setAuthType(null);

        localStorage.removeItem('auth_token');
        localStorage.removeItem('auth_type');
        localStorage.removeItem('auth_user');

        sessionStorage.removeItem('auth_token');
        sessionStorage.removeItem('auth_type');
        sessionStorage.removeItem('auth_user');
    };

    // Check if user is authenticated
    const isAuthenticated = () => {
        return !!token;
    };

    // Check if user is admin
    const isAdmin = () => {
        return authType === 'admin';
    };

    // Check if user has access to device
    const hasDeviceAccess = (deviceId) => {
        if (authType === 'admin') return true;
        // Use loose equality to handle string/number differences
        if (authType === 'device' && user?.deviceId == deviceId) return true;
        return false;
    };

    const value = {
        user,
        token,
        authType,
        loading,
        loginAdmin,
        loginDevice,
        switchActiveCompany,
        logout,
        isAuthenticated,
        isAdmin,
        hasDeviceAccess,
    };

    return (
        <AuthContext.Provider value={value}>
            {children}
        </AuthContext.Provider>
    );
};
