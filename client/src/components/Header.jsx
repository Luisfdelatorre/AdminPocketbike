import React from 'react';

const Header = ({ sseStatus }) => {
    return (
        <header className="app-header">
            <div className="container">
                <div className="header-content">
                    <div className="logo-section">
                        <div className="logo-icon">💳</div>
                        <h1 className="logo-text">
                            <span className="logo-primary">Wompi</span>
                            <span className="logo-secondary">Payments</span>
                        </h1>
                    </div>

                    <div className="connection-status">
                        <div className={`status-indicator ${sseStatus === 'connected' ? 'connected' : ''}`}></div>
                        <span className="status-text">
                            {sseStatus === 'connected' ? 'Connected' : sseStatus === 'connecting' ? 'Connecting...' : 'Disconnected'}
                        </span>
                    </div>
                </div>
            </div>
        </header>
    );
};

export default Header;
