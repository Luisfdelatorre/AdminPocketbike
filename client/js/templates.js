
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
            <button id="loanBtn" class="btn btn-secondary" >Activar</button>
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
            <h2 class="app-title">Pago a {{COMPANY_NAME}}</h2>
            <p class="loading-message" id="loadingMessage">{{VEHICLE_PLATE}}</p>
            <div class="loading-meta" id="loadingMeta" style="font-size: 13px; color: #4b5563; margin-top: -4px; margin-bottom: 12px; font-weight: 500; display: flex; flex-wrap: wrap; justify-content: center; gap: 8px; align-items: center;">
                <span id="loadingDate"></span>
                <span id="loadingMetaSeparator" style="display:none; opacity: 0.5;">•</span>
                <span id="loadingCuota"></span>
            </div>
            <div id="loadingTimerBadge" style="margin-bottom: 12px; text-align: center;">
                <span style="background: #fef2f2; color: #dc2626; border: 1px solid #fca5a5; padding: 4px 14px; border-radius: 16px; font-size: 13px; font-weight: 600; letter-spacing: -0.2px; display: inline-flex; align-items: center; gap: 6px;">
                    ⏱️ Tiempo restante: <span id="loadingTimerVal">15:00</span>
                </span>
            </div>
            <p class="text-center" id="companyLogoContainer">
                <img alt="Logo" src="{{COMPANY_LOGO}}" class="img-lg">
            </p>
            <div class="qr-guide hidden" id="qrGuide" style="text-align: center; margin: 20px auto 0; max-width: 300px;">
                <div style="background: #ffffff; padding: 20px; border-radius: 16px; display: inline-block; box-shadow: 0 8px 24px rgba(0,0,0,0.15); border: 2px solid #e5e7eb;">
                    <img id="qrImageDisplay" src="" alt="Código QR Bancolombia" style="max-width: 260px; width: 100%; height: auto; display: block; margin: 0 auto;" />
                </div>
                <p style="margin-top: 12px; font-size: 14px; color: #374151; font-weight: 600; letter-spacing: 0.01em;">
                    📱 Escanea con Bancolombia o Nequi
                </p>
            </div>
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

            <div class="nequi-guide" id="nequiGuide">
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
                <img alt="Logo" src="{{COMPANY_LOGO}}" class="receipt-logo">
                <h3 class="receipt-title">{{COMPANY_NAME}}</h3>
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
