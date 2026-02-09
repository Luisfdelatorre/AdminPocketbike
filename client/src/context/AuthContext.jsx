import React, { createContext, useContext, useState, useEffect } from 'react';
import { login, verifyDevicePin } from '../services/api';

const AuthContext = createContext(null);

export const useAuth = () => {
    const context = useContext(AuthContext);
    if (!context) {
        throw new Error('useAuth must be used within AuthProvider');
    }
    return context;
};

export const AuthProvider = ({ children }) => {
    const [user, setUser] = useState(null);
    const [token, setToken] = useState(null);
    const [loading, setLoading] = useState(true);
    const [authType, setAuthType] = useState(null); // 'admin' or 'device'

    // Load token from storage on mount
    useEffect(() => {
        const storedToken = localStorage.getItem('auth_token') || sessionStorage.getItem('auth_token');
        const storedType = localStorage.getItem('auth_type') || sessionStorage.getItem('auth_type');
        const storedUser = localStorage.getItem('auth_user') || sessionStorage.getItem('auth_user');

        if (storedToken) {
            setToken(storedToken);
            setAuthType(storedType);
            if (storedUser) {
                setUser(JSON.parse(storedUser));
            }
        }
        setLoading(false);
    }, []);

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

    // Logout
    const logout = () => {
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
