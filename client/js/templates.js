
export const Templates = {
    confirmationModal: `
    <div id="confirmationModal" class="modal hidden">
        <div class="modal-content">
            <div class="modal-handle"></div>
            <span class="close-modal">&times;</span>
            <p>¿Desea usar un día libre para pagar su factura pendiente?</p>
            <div class="modal-actions">
                <button id="confirmPaymentBtn" class="btn btn-primary">Sí, usar día libre</button>
                <button id="cancelPaymentBtn" class="btn btn-secondary">Cancelar</button>
            </div>
        </div>
    </div>`,

    pendingPaymentReminder: `
    <div class="important-reminder hidden" id="pendingPaymentReminder">
        <div class="reminder-icon">⏳</div>
        <div class="reminder-content">
            <div class="reminder-title">Pago pendiente detectado</div>
            <div class="reminder-text">
                <div><strong>Referencia:</strong> <span id="pendingPaymentRef">-</span></div>
                <div><strong>Monto:</strong> $<span id="pendingPaymentAmount">-</span> COP</div>
                <div><strong>Iniciado:</strong> <span id="pendingPaymentTime">-</span></div>
                <div class="progress-container">
                    <div class="progress-bar-animated"></div>
                </div>
                <div class="reminder-note" id="paymentStatusLabelReminder">Reanudando verificación automáticamente...</div>
            </div>
        </div>
    </div>`,

    moreOptionsSection: `
    <div id="moreOptionsSection" class="more-options-section">
        <div class="action-buttons">
            <div class="btn-wrapper">
                <span id="freeDaysCount" class="badge-circle">1</span>
                <button id="useFreeDayBtn" class="btn btn-success">
                    <span class="btn-text">Usar día libre</span>
                </button>
            </div>
            <button id="loanBtn" class="btn btn-secondary">Préstamo</button>
        </div>
        <div class="payment-history payment-history-scroll">
            <table>
                <thead>
                    <tr>
                        <th>Día</th>
                        <th>Cantidad</th>
                        <th>Nequi</th>
                        <th>Estado</th>
                    </tr>
                </thead>
                <tbody id="historyTableBody"></tbody>
            </table>
        </div>
    </div>`,

    loadingScreen: `
<div id="loadingScreen" class="screen">
    <div class="container">
        <div class="loading-content">
            <h2 class="app-title">Pago a PocketBike</h2>
            <p class="loading-message" id="loadingMessage">MTJ17H - Mensajería</p>
            <p class="text-center">
                <img alt="PocketBike Logo" src="/pocketbike_60x60.jpg" class="img-lg">
            </p>
            <div class="amount-display">
                <div class="amount-value" id="loadingAmount"><span class="text-black">COP</span></div>
            </div>

            <div class="progress-container">
                <div class="progress-bar-animated"></div>
            </div>

            <div class="important-reminder">
                <div class="reminder-icon">🔔</div>
                <div class="reminder-content">
                    <div class="reminder-title" id="paymentStatusLabelLoading">Solicitando pago por Wompi...</div>
                    <div class="reminder-text">Recuerda completar tu transacción en el centro de notificaciones de Nequi.
                    </div>
                </div>
            </div>

            <div class="nequi-guide">
                <div class="screenshots-container">
                    <div class="screenshot-card">
                        <div class="screenshot-number">1</div>
                        <img src="/notification1.jpg" alt="Notificación 1" class="img-full">
                    </div>
                    <div class="screenshot-card">
                        <div class="screenshot-number">2</div>
                        <img src="/notification2.jpg" alt="Notificación 2" class="img-full">
                    </div>
                </div>
            </div>

            <button class="finish-btn" id="finishBtn">Finalizar proceso</button>
        </div>
    </div>
</div>`,

    successScreen: `
<div id="successScreen" class="screen">
    <div class="container">
        <div class="success-card">
            <div class="receipt-header">
                <img alt="PocketBike Logo" src="/pocketbike_60x60.jpg" class="receipt-logo">
                <h3 class="receipt-title">POCKETBIKE</h3>
                <p class="text-muted receipt-subtitle">Comprobante de Pago</p>
            </div>

            <div class="status-badge-wrapper">
                <div class="status-badge">
                    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#2e7d32" stroke-width="3">
                        <polyline points="20 6 9 17 4 12"></polyline>
                    </svg>
                    <span class="status-badge-text">PAGO EXITOSO</span>
                </div>
            </div>

            <div class="transaction-details">
                <div class="detail-row detail-row-spaced">
                    <span class="detail-label">Vehículo</span>
                    <span class="detail-value-device" id="successDeviceId">--</span>
                </div>
                <div class="detail-row detail-row-spaced">
                    <span class="detail-label">Fecha y hora</span>
                    <span class="detail-value-date" id="paymentDate">--</span>
                </div>
                <div class="detail-row detail-row-spaced">
                    <span class="detail-label">Referencia</span>
                    <span class="detail-value-ref" id="successReference">--</span>
                </div>
                <div class="detail-row detail-row-spaced">
                    <span class="detail-label">Factura</span>
                    <span class="detail-value-ref" id="successInvoice">--</span>
                </div>

                <div class="total-box">
                    <div class="detail-row">
                        <span class="total-label">TOTAL PAGADO</span>
                        <span class="total-value" id="successAmount">$30,000 COP</span>
                    </div>
                </div>
            </div>

            <div class="receipt-footer">
                <p class="thank-you-message">¡Gracias por su pago!</p>
                <p class="text-muted security-note">Procesado de forma segura por <strong>Wompi</strong></p>
                <button class="finish-btn" id="doneBtn">Finalizar</button>
            </div>
        </div>
    </div>
</div>`
};
