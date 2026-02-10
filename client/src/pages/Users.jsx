import React, { useState, useEffect } from 'react';
import { getAllUsers, createUser, updateUser, deleteUser, getAllCompanies } from '../services/api';
import { Users as UsersIcon, UserPlus, Trash2, Search, X, Pencil } from 'lucide-react';
import './Users.css'; // We'll create this CSS next

const Users = () => {
    const [users, setUsers] = useState([]);
    const [companies, setCompanies] = useState([]);
    const [loading, setLoading] = useState(true);
    const [showUserModal, setShowUserModal] = useState(false);
    const [searchTerm, setSearchTerm] = useState('');
    const [isEditing, setIsEditing] = useState(false);
    const [editUserId, setEditUserId] = useState(null);

    const [userForm, setUserForm] = useState({
        name: '',
        email: '',
        password: '',
        role: 'viewer',
        companyId: ''
    });

    useEffect(() => {
        loadData();
    }, []);

    const loadData = async () => {
        setLoading(true);
        try {
            const [usersRes, companiesRes] = await Promise.all([
                getAllUsers(),
                getAllCompanies()
            ]);

            if (usersRes.success) setUsers(usersRes.data);
            if (companiesRes.success) setCompanies(companiesRes.data);
        } catch (error) {
            console.error('Error loading data:', error);
            alert('Error loading data');
        } finally {
            setLoading(false);
        }
    };

    const resetForm = () => {
        setUserForm({ name: '', email: '', password: '', role: 'viewer', companyId: '' });
        setIsEditing(false);
        setEditUserId(null);
        setShowUserModal(false);
    };

    const handleEditUser = (user) => {
        setUserForm({
            name: user.name,
            email: user.email,
            password: '', // Password optional on edit
            role: user.role,
            companyId: user.companyId || (companies.find(c => c.name === user.companyName)?._id) || ''
        });
        setIsEditing(true);
        setEditUserId(user._id);
        setShowUserModal(true);
    };

    const handleSubmit = async (e) => {
        e.preventDefault();
        try {
            let res;
            if (isEditing) {
                // If password is empty, remove it so it doesn't get updated to empty string
                const dataToUpdate = { ...userForm };
                if (!dataToUpdate.password) delete dataToUpdate.password;

                res = await updateUser(editUserId, dataToUpdate);
            } else {
                res = await createUser(userForm);
            }

            if (res.success) {
                alert(`User ${isEditing ? 'updated' : 'created'} successfully`);
                resetForm();
                loadData();
            } else {
                alert(res.error || `Failed to ${isEditing ? 'update' : 'create'} user`);
            }
        } catch (error) {
            console.error(error);
            alert(`Error ${isEditing ? 'updating' : 'creating'} user`);
        }
    };

    const handleDeleteUser = async (id) => {
        if (!confirm('Are you sure you want to delete this user?')) return;
        try {
            const res = await deleteUser(id);
            if (res.success) {
                loadData();
            } else {
                alert('Failed to delete user');
            }
        } catch (error) {
            console.error(error);
            alert('Error deleting user');
        }
    };

    const filteredUsers = users.filter(user =>
        user.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
        user.email.toLowerCase().includes(searchTerm.toLowerCase()) ||
        (user.companyName && user.companyName.toLowerCase().includes(searchTerm.toLowerCase()))
    );

    return (
        <div className="users-page">
            <div className="page-header">
                <div>
                    <h1><UsersIcon className="inline-icon" /> Users Management</h1>
                    <p>Manage system users</p>
                </div>
                <div className="header-actions">
                    <button className="btn-primary" onClick={() => {
                        setUserForm({ name: '', email: '', password: '', role: 'viewer', companyId: '' });
                        setIsEditing(false);
                        setEditUserId(null);
                        setShowUserModal(true);
                    }}>
                        <UserPlus size={16} /> Add User
                    </button>
                </div>
            </div>

            {/* Search */}
            <div className="users-search">
                <div className="search-box">
                    <Search className="search-icon" />
                    <input
                        type="text"
                        placeholder="Search users..."
                        value={searchTerm}
                        onChange={(e) => setSearchTerm(e.target.value)}
                    />
                </div>
            </div>

            {/* Users Table */}
            <div className="users-list">
                {loading ? (
                    <div className="loading-state">Loading...</div>
                ) : (
                    <table className="data-table">
                        <thead>
                            <tr>
                                <th>Name</th>
                                <th>Email</th>
                                <th>Role</th>
                                <th>Company</th>
                                <th>Actions</th>
                            </tr>
                        </thead>
                        <tbody>
                            {filteredUsers.map(user => (
                                <tr key={user._id}>
                                    <td>
                                        <div className="user-name">{user.name}</div>
                                    </td>
                                    <td>{user.email}</td>
                                    <td>
                                        <span className={`role-badge ${user.role}`}>{user.role}</span>
                                    </td>
                                    <td>{user.companyName || '-'}</td>
                                    <td>
                                        <div className="flex gap-2">
                                            <button
                                                className="btn-icon"
                                                onClick={() => handleEditUser(user)}
                                                title="Edit User"
                                            >
                                                <Pencil size={16} />
                                            </button>
                                            <button
                                                className="btn-icon danger"
                                                onClick={() => handleDeleteUser(user._id)}
                                                title="Delete User"
                                            >
                                                <Trash2 size={16} />
                                            </button>
                                        </div>
                                    </td>
                                </tr>
                            ))}
                            {filteredUsers.length === 0 && (
                                <tr>
                                    <td colSpan="5" className="text-center">No users found</td>
                                </tr>
                            )}
                        </tbody>
                    </table>
                )}
            </div>

            {/* Add User Modal */}
            {showUserModal && (
                <div className="modal-overlay">
                    <div className="modal-content">
                        <div className="modal-header">
                            <h2>{isEditing ? 'Edit User' : 'Add New User'}</h2>
                            <button className="modal-close" onClick={resetForm}><X /></button>
                        </div>
                        <form onSubmit={handleSubmit}>
                            <div className="form-group">
                                <label>Full Name</label>
                                <input
                                    type="text"
                                    required
                                    value={userForm.name}
                                    onChange={e => setUserForm({ ...userForm, name: e.target.value })}
                                />
                            </div>
                            <div className="form-group">
                                <label>Email</label>
                                <input
                                    type="email"
                                    required
                                    value={userForm.email}
                                    onChange={e => setUserForm({ ...userForm, email: e.target.value })}
                                />
                            </div>
                            <div className="form-group">
                                <label>Password {isEditing && '(Leave blank to keep current)'}</label>
                                <input
                                    type="password"
                                    required={!isEditing}
                                    value={userForm.password}
                                    onChange={e => setUserForm({ ...userForm, password: e.target.value })}
                                />
                            </div>
                            <div className="form-group">
                                <label>Role</label>
                                <select
                                    value={userForm.role}
                                    onChange={e => setUserForm({ ...userForm, role: e.target.value })}
                                >
                                    <option value="viewer">Viewer</option>
                                    <option value="manager">Manager</option>
                                    <option value="admin">Admin</option>
                                </select>
                            </div>
                            <div className="form-group">
                                <label>Company</label>
                                <select
                                    required
                                    value={userForm.companyId}
                                    onChange={e => setUserForm({ ...userForm, companyId: e.target.value })}
                                >
                                    <option value="">Select Company...</option>
                                    {companies.map(c => (
                                        <option key={c._id} value={c._id}>{c.name}</option>
                                    ))}
                                </select>
                            </div>
                            <div className="form-actions">
                                <button type="button" className="btn-secondary" onClick={resetForm}>Cancel</button>
                                <button type="submit" className="btn-primary">{isEditing ? 'Update User' : 'Create User'}</button>
                            </div>
                        </form>
                    </div>
                </div>
            )}

        </div>
    );
};

export default Users;
