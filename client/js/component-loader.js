/**
 * Component Loader
 * Dynamically loads HTML components into the payment app
 */

class ComponentLoader {
    /**
     * Load a single component from the components directory
     * @param {string} componentName - Name of the component file (without .html extension)
     * @param {string} targetId - ID of the target container element
     * @returns {Promise<void>}
     */
    static async loadComponent(componentName, targetId) {
        try {
            const response = await fetch(`/pay/components/${componentName}.html`);

            if (!response.ok) {
                throw new Error(`Failed to load component: ${componentName} (${response.status})`);
            }

            const html = await response.text();
            const targetElement = document.getElementById(targetId);

            if (!targetElement) {
                throw new Error(`Target element not found: ${targetId}`);
            }

            targetElement.innerHTML = html;
            console.log(`✓ Loaded component: ${componentName}`);
        } catch (error) {
            console.error(`✗ Error loading component ${componentName}:`, error);
            throw error;
        }
    }

    /**
     * Load only the initial login screen (optimized for fast page load)
     * @returns {Promise<void>}
     */
    static async loadAllScreens() {
        console.log('Loading initial components...');

        try {
            // Load only login screen and messages initially
            const messagesPromise = this.loadMessages();
            const loginPromise = this.loadComponent('login-screen', 'loginScreen');

            await Promise.all([messagesPromise, loginPromise]);

            console.log('✓ Initial components loaded (login screen ready)');
        } catch (error) {
            console.error('✗ Failed to load initial components:', error);
            // Show user-friendly error message
            document.body.innerHTML = `
                <div style="display: flex; align-items: center; justify-content: center; height: 100vh; font-family: sans-serif;">
                    <div style="text-align: center; padding: 20px;">
                        <h2 style="color: #dc2626;">Error al cargar la aplicación</h2>
                        <p>No se pudieron cargar los componentes. Por favor, recarga la página.</p>
                        <button onclick="location.reload()" style="margin-top: 20px; padding: 10px 20px; background: #10b981; color: white; border: none; border-radius: 8px; cursor: pointer;">
                            Recargar
                        </button>
                    </div>
                </div>
            `;
            throw error;
        }
    }

    /**
     * Load a screen component on demand (lazy loading)
     * @param {string} screenName - Name of the screen component (e.g., 'payment-screen')
     * @param {string} targetId - Target DOM element ID
     * @returns {Promise<void>}
     */
    static async loadScreenOnDemand(screenName, targetId) {
        const target = document.getElementById(targetId);

        // Check if already loaded
        if (target && target.innerHTML.trim() !== '') {
            console.log(`✓ Component ${screenName} already loaded`);
            return;
        }

        console.log(`⏳ Loading ${screenName} on demand...`);
        await this.loadComponent(screenName, targetId);
    }

    /**
     * Preload remaining screen components in background (after payment screen loads)
     * @returns {Promise<void>}
     */
    static async preloadRemainingScreens() {
        console.log('⏳ Preloading remaining screens in background...');

        try {
            await Promise.all([
                this.loadScreenOnDemand('loading-screen', 'loadingScreen'),
                this.loadScreenOnDemand('success-screen', 'successScreen'),
            ]);

            console.log('✓ All remaining screens preloaded');
        } catch (error) {
            console.warn('⚠ Failed to preload some screens:', error);
            // Non-fatal - screens will load on demand if preload fails
        }
    }

    /**
     * Load messages from API
     * @returns {Promise<void>}
     */
    static async loadMessages() {
        console.log('Loading messages & config...');
        try {
            const response = await fetch('/apinode/messages/ui');
            if (response.ok) {
                const data = await response.json();

                // Store messages and config globally
                window.APP_MESSAGES = data.messages || data; // Fallback for old format
                window.APP_CONFIG = data.config || {};

                console.log('✓ Loaded messages and configuration');
            } else {
                console.warn('⚠ Failed to load messages, will use fallback');
            }
        } catch (error) {
            console.warn('⚠ Error loading messages, will use fallback:', error);
        }
    }

    /**
     * Preload a component without inserting it into the DOM
     * Useful for performance optimization
     * @param {string} componentName - Name of the component to preload
     * @returns {Promise<string>} The HTML content
     */
    static async preloadComponent(componentName) {
        const response = await fetch(`/components/${componentName}.html`);
        return await response.text();
    }
}

// Export for use in other modules
export default ComponentLoader;
