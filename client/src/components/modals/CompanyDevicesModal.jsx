import React, { useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { Search, Info, Check } from 'lucide-react';

// Simplified modal to manage devices for a company
const CompanyDevicesModal = ({
    isOpen,
    onClose,
    company,
    allDevices,
    onSave
}) => {
    const { t } = useTranslation();
    const [searchTerm, setSearchTerm] = useState('');
    const [selectedDeviceIds, setSelectedDeviceIds] = useState(new Set());

    // Reset selection when modal opens
    useEffect(() => {
        if (isOpen && company && allDevices) {
            // Pre-select devices that belong to this company
            const companyDeviceIds = allDevices
                .filter(d => d.companyId === company._id)
                .map(d => d._id);
            setSelectedDeviceIds(new Set(companyDeviceIds));
            setSearchTerm('');
        }
    }, [isOpen, company, allDevices]);

    if (!isOpen || !company) return null;

    const handleToggleDevice = (deviceId) => {
        const newSelected = new Set(selectedDeviceIds);
        if (newSelected.has(deviceId)) {
            newSelected.delete(deviceId);
        } else {
            newSelected.add(deviceId);
        }
        setSelectedDeviceIds(newSelected);
    };

    const handleSelectAll = (filtered) => {
        const newSelected = new Set(selectedDeviceIds);
        const allFilteredSelected = filtered.every(d => newSelected.has(d._id));

        if (allFilteredSelected) {
            // Deselect all visible
            filtered.forEach(d => newSelected.delete(d._id));
        } else {
            // Select all visible
            filtered.forEach(d => newSelected.add(d._id));
        }
        setSelectedDeviceIds(newSelected);
    };

    const handleSave = () => {
        onSave(company._id, Array.from(selectedDeviceIds));
    };

    // Filter devices
    const filteredDevices = allDevices.filter(device =>
        device.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
        (device.simCardNumber && device.simCardNumber.includes(searchTerm)) ||
        (device.nequiNumber && device.nequiNumber.includes(searchTerm))
    );

    // Stats
    const selectedCount = selectedDeviceIds.size;
    const totalCount = allDevices.length;

    return (
        <div className="modal-overlay" onClick={onClose}>
            <div className="modal-content large" onClick={e => e.stopPropagation()}>
                <div className="modal-header">
                    <div>
                        <h2>Manage Devices - {company.name}</h2>
                        <p className="text-sm text-gray-500">Assign devices to this company</p>
                    </div>
                    <button className="modal-close" onClick={onClose}>&times;</button>
                </div>

                <div className="p-4 border-b border-gray-100 bg-gray-50">
                    <div className="search-box mb-4">
                        <Search className="search-icon" size={18} />
                        <input
                            type="text"
                            placeholder="Search devices by name, SIM, or phone..."
                            value={searchTerm}
                            onChange={(e) => setSearchTerm(e.target.value)}
                            className="w-full"
                        />
                    </div>

                    <div className="flex justify-between items-center text-sm">
                        <div className="flex gap-4">
                            <span className="font-medium text-indigo-600">
                                {selectedCount} Selected
                            </span>
                            <span className="text-gray-500">
                                {totalCount} Total
                            </span>
                        </div>
                        <button
                            type="button"
                            className="text-indigo-600 hover:text-indigo-800 font-medium"
                            onClick={() => handleSelectAll(filteredDevices)}
                        >
                            {filteredDevices.every(d => selectedDeviceIds.has(d._id)) ? 'Deselect All' : 'Select All Visible'}
                        </button>
                    </div>
                </div>

                <div className="overflow-y-auto" style={{ maxHeight: '60vh' }}>
                    {filteredDevices.length > 0 ? (
                        <div className="divide-y divide-gray-100">
                            {filteredDevices.map(device => {
                                const isSelected = selectedDeviceIds.has(device._id);
                                const isAssignedToOther = device.companyId && device.companyId !== company._id;

                                return (
                                    <label
                                        key={device._id}
                                        className={`flex items-center p-3 hover:bg-gray-50 cursor-pointer transition-colors ${isSelected ? 'bg-indigo-50/50' : ''}`}
                                    >
                                        <div className="relative flex items-center justify-center p-1">
                                            <input
                                                type="checkbox"
                                                className="w-5 h-5 rounded border-gray-300 text-indigo-600 focus:ring-indigo-500"
                                                checked={isSelected}
                                                onChange={() => handleToggleDevice(device._id)}
                                            />
                                        </div>
                                        <div className="ml-3 flex-1">
                                            <div className="flex justify-between">
                                                <span className={`font-medium ${isSelected ? 'text-indigo-900' : 'text-gray-900'}`}>
                                                    {device.name}
                                                </span>
                                                {isAssignedToOther && (
                                                    <span className="text-xs text-orange-600 bg-orange-50 px-2 py-0.5 rounded-full">
                                                        {device.companyName || 'Other Company'}
                                                    </span>
                                                )}
                                                {device.companyId === company._id && (
                                                    <span className="text-xs text-green-600 bg-green-50 px-2 py-0.5 rounded-full flex items-center gap-1">
                                                        <Check size={10} /> Current
                                                    </span>
                                                )}
                                            </div>
                                            <div className="text-xs text-gray-500 mt-0.5 flex gap-3">
                                                <span>SIM: {device.simCardNumber || '-'}</span>
                                                <span>Phone: {device.nequiNumber || '-'}</span>
                                            </div>
                                        </div>
                                    </label>
                                );
                            })}
                        </div>
                    ) : (
                        <div className="p-8 text-center text-gray-500">
                            No devices found matching your search.
                        </div>
                    )}
                </div>

                <div className="modal-actions p-4 border-t border-gray-100 bg-white sticky bottom-0">
                    <button className="btn-secondary" onClick={onClose}>Cancel</button>
                    <button className="btn-primary" onClick={handleSave}>
                        Save Changes ({selectedCount})
                    </button>
                </div>
            </div>
        </div>
    );
};

export default CompanyDevicesModal;
