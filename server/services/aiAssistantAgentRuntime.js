// Shim for WebSocket server – re‑export the runtime utilities needed by the WS layer.
// The actual implementation lives in the project's runtime module (may be renamed).
// Here we simply import the real module and expose the required function.

import { resetTenantSession } from './aiAssistantService.js'; // <-- adjust if the actual file differs

export { resetTenantSession };
