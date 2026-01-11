import React, { useState, useEffect } from 'react';
import { useParams } from 'react-router-dom';
import { formatCurrency } from '../utils/helpers';

const ContractStats = ({ deviceId }) => {
    const [contract, setContract] = useState(null);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        if (deviceId) {
            loadContractStats();
        }
    }, [deviceId]);

    const loadContractStats = async () => {
        try {
            const response = await fetch(`/api/contracts/${deviceId}/stats`);
            const result = await response.json();

            if (result.success) {
                setContract(result.data);
            }
        } catch (error) {
            console.error('Error loading contract:', error);
        } finally {
            setLoading(false);
        }
    };

    if (loading) {
        return (
            <div className="contract-stats">
                <div className="spinner"></div>
            </div>
        );
    }

    if (!contract) {
        return (
            <div className="contract-stats">
                <p style={{ textAlign: 'center', color: '#6B7280' }}>
                    No active contract found
                </p>
            </div>
        );
    }

    return (
        <div className="contract-stats">
            <div className="card-header">
                <h3 className="card-title">📋 Contract Progress</h3>
                <span className={`status-badge ${contract.status.toLowerCase()}`}>
                    {contract.status}
                </span>
            </div>

            {/* Progress Bar */}
            <div className="progress-section">
                <div className="progress-bar-container">
                    <div
                        className="progress-bar-fill"
                        style={{ width: `${contract.completionPercentage}%` }}
                    >
                        <span className="progress-text">{contract.completionPercentage}%</span>
                    </div>
                </div>
                <div className="progress-info">
                    <span>{contract.paidDays} / {contract.totalDays} days paid</span>
                    <span>{contract.remainingDays} days remaining</span>
                </div>
            </div>

            {/* Financial Summary */}
            <div className="contract-summary">
                <div className="summary-row">
                    <span className="summary-label">Daily Rate:</span>
                    <span className="summary-value">
                        {formatCurrency(contract.dailyRate)} COP
                    </span>
                </div>
                <div className="summary-row">
                    <span className="summary-label">Total Contract:</span>
                    <span className="summary-value">
                        {formatCurrency(contract.totalAmount)} COP
                    </span>
                </div>
                <div className="summary-row">
                    <span className="summary-label">Paid Amount:</span>
                    <span className="summary-value success">
                        {formatCurrency(contract.paidAmount)} COP
                    </span>
                </div>
                <div className="summary-row">
                    <span className="summary-label">Remaining:</span>
                    <span className="summary-value warning">
                        {formatCurrency(contract.remainingAmount)} COP
                    </span>
                </div>
            </div>

            {/* Contract Dates */}
            <div className="contract-dates">
                <div className="date-item">
                    <span className="date-label">Start Date</span>
                    <span className="date-value">📅 {contract.startDate}</span>
                </div>
                <div className="date-item">
                    <span className="date-label">End Date</span>
                    <span className="date-value">🏁 {contract.endDate}</span>
                </div>
            </div>

            {/* Contract ID */}
            <div className="contract-id">
                <small>
                    Contract ID: {contract.contractId}
                </small>
            </div>
        </div>
    );
};

export default ContractStats;
