# LLMApps SDK

A lightweight, zero-dependency JavaScript SDK for building widgets that run inside LLM Apps hosts — ChatGPT, Claude, and any other compliant client.

It wraps the LLM Apps protocol (JSON-RPC 2.0 over postMessage) into a simple Promise-based API: connect with one call, receive tool data with one await, and interact with the conversation through clear, standard methods that work the same way on every host.

Host-specific capabilities (ChatGPT's widget state, file upload, modals) are auto-detected and isolated under a dedicated namespace — available when present, safely `null` otherwise.

If the spec evolves faster than the SDK, low-level `request()` and `notify()` methods give you a forward-compatible escape hatch to call any protocol method directly.

## Quick Start

```js
import { LLMAppsSDK } from './scripts/llmapps-sdk.js';

const bridge = new LLMAppsSDK({
  appInfo: { name: 'MyWidget', version: '1.0.0' },
});
await bridge.connect();

// Host context (standard — works everywhere)
console.log(bridge.hostContext.theme);   // 'dark'
console.log(bridge.hostContext.locale);  // 'en-US'

const { structuredContent } = await bridge.toolResult;
// structuredContent has your data — render it
```

Or use the factory:

```js
import { createBridge } from './scripts/llmapps-sdk.js';

const bridge = await createBridge({
  appInfo: { name: 'MyWidget', version: '1.0.0' },
});
const { structuredContent } = await bridge.toolResult;
```

---

## Constructor

### `new LLMAppsSDK(options)`

Creates a bridge instance ready to connect. `appInfo` is **required** — every widget must identify itself.

| Option | Type | Required | Description |
|--------|------|----------|-------------|
| `appInfo` | `{ name: string, version: string }` | Yes | Identity sent to the host during `ui/initialize` |
| `appCapabilities` | `object` | No | Capabilities declared to the host (see below) |

**`appCapabilities`** fields (from the [LLM Apps spec](https://github.com/modelcontextprotocol/ext-apps/blob/main/specification/2026-01-26/apps.mdx)):

| Field | Type | Description |
|-------|------|-------------|
| `availableDisplayModes` | `('inline' \| 'fullscreen' \| 'pip')[]` | Display modes the widget supports |
| `tools` | `{ listChanged?: boolean }` | Declare if the widget exposes tools back to the host |
| `experimental` | `object` | Reserved for future features |

```js
const bridge = new LLMAppsSDK({
  appInfo: { name: 'ProductShowcase', version: '1.0.0' },
  appCapabilities: {
    availableDisplayModes: ['inline', 'fullscreen'],
  },
});
```

---

## Standard Protocol API

These work in **every** LLM Apps-compatible host (ChatGPT, Claude, etc.).

### Lifecycle

#### `bridge.connect()` → `Promise<LLMAppsSDK>`

Performs the `ui/initialize` handshake. Parses the `McpUiInitializeResult` and populates `hostContext`, `hostCapabilities`, and `hostInfo`. Safe to call when not in an iframe (becomes a no-op).

```js
await bridge.connect();

console.log(bridge.isConnected);          // true
console.log(bridge.host);                 // 'chatgpt' | 'claude' | 'unknown'
console.log(bridge.hostContext.theme);    // 'dark'
console.log(bridge.hostCapabilities);     // { openLinks: true, ... }
console.log(bridge.hostInfo);             // { name: 'chatgpt', version: '...' }
```

#### `bridge.destroy()`

Remove listeners, reject pending requests, unsubscribe all context observers, and clean up. Also triggered automatically when the host sends `ui/resource-teardown`.

### Properties (read-only)

| Property | Type | Description |
|----------|------|-------------|
| `bridge.isEmbedded` | `boolean` | `true` if running inside an iframe |
| `bridge.isConnected` | `boolean` | `true` after successful handshake |
| `bridge.host` | `string \| null` | Detected host: `'chatgpt'`, `'claude'`, etc. Prefers `hostInfo.name` from the handshake, falls back to environment sniffing |

### Host Context

After `connect()`, the host's response is exposed through three getters:

#### `bridge.hostContext` → `object`

Full context from the host. Updated live when `ui/notifications/host-context-changed` arrives.

| Field | Type | Description |
|-------|------|-------------|
| `theme` | `'light' \| 'dark'` | Host colour scheme |
| `styles` | `{ variables?, css? }` | CSS custom properties and font CSS |
| `locale` | `string` | User locale (BCP 47, e.g. `'en-US'`) |
| `timeZone` | `string` | User time zone (IANA) |
| `displayMode` | `'inline' \| 'fullscreen' \| 'pip'` | Current display mode |
| `availableDisplayModes` | `string[]` | Display modes the host supports |
| `containerDimensions` | `object` | Sizing constraints (see below) |
| `platform` | `string` | Host platform |
| `deviceCapabilities` | `object` | Device capabilities |
| `safeAreaInsets` | `{ top, bottom, left, right }` | Safe area insets |
| `userAgent` | `string` | Host user-agent string |
| `toolInfo` | `object` | Tool invocation context |

```js
console.log(bridge.hostContext.theme);           // 'dark'
console.log(bridge.hostContext.locale);          // 'en-US'
console.log(bridge.hostContext.displayMode);     // 'inline'
console.log(bridge.hostContext.safeAreaInsets);   // { top: 0, bottom: 0, ... }
```

#### `bridge.hostCapabilities` → `object`

What the host supports. Use for feature detection before calling methods.

| Field | Type | Description |
|-------|------|-------------|
| `openLinks` | `{} \| undefined` | Present if host supports `bridge.openLink()` |
| `serverTools` | `{ listChanged?: boolean } \| undefined` | Present if host can forward tool calls |
| `serverResources` | `{ listChanged?: boolean } \| undefined` | Present if host supports resource requests |
| `logging` | `{} \| undefined` | Present if host accepts `bridge.log()` messages |
| `sandbox` | `{ permissions?, csp? } \| undefined` | Sandbox configuration applied by the host |

```js
if (bridge.hostCapabilities.openLinks) {
  bridge.openLink('https://example.com');
}
```

#### `bridge.hostInfo` → `{ name?: string, version?: string }`

The host's identity. Used internally to improve `bridge.host` detection.

### Tool Data

#### `bridge.toolResult` → `Promise<params>`

Resolves when the host sends `ui/notifications/tool-result`. **One-shot** — resolves once per widget lifecycle.

```js
const result = await bridge.toolResult;

result.structuredContent  // → the data (visible to model + widget)
result.content            // → text narration array
result._meta              // → widget-only data (hidden from model)
```

#### `bridge.toolInput` → `Promise<params>`

Resolves when the host sends `ui/notifications/tool-input` — the arguments the model passed to the tool. **One-shot**.

```js
const input = await bridge.toolInput;
console.log(input); // e.g. { category: 'electronics' }
```

#### `bridge.toolCancelled` → `Promise<{ reason? }>`

Resolves if the host cancels the tool execution (`ui/notifications/tool-cancelled`). **One-shot**.

```js
bridge.toolCancelled.then(({ reason }) => {
  showMessage(`Tool cancelled: ${reason || 'unknown'}`);
});
```

### Interaction Methods

#### `bridge.callTool(name, args)` → `Promise<result>`

Call any tool from the widget UI.

```js
const result = await bridge.callTool('getProducts', { category: 'outdoor' });
console.log(result.structuredContent);
```

#### `bridge.sendMessage(text)` → `Promise<result>`

Post a follow-up message in the conversation as the user. The message is **visible** in the chat and the model responds.

```js
await bridge.sendMessage('Tell me more about this product.');
```

#### `bridge.updateModelContext(text)` → `Promise<result>`

Silently tell the model what the user is doing inside the widget. **Nothing appears** in the chat, but the model remembers it for future responses.

```js
await bridge.updateModelContext('User selected 3 items from the list.');
```

#### `bridge.openLink(url)` → `Promise<result>`

Open an external link via the host. The host may show a confirmation dialog.

```js
// Standard — works on any compliant host
await bridge.openLink('https://example.com/product/123');
```

Use `bridge.hostCapabilities.openLinks` to feature-detect before calling.

#### `bridge.requestDisplayMode(mode)` → `Promise<{ mode }>`

Request a display mode change. Returns the actual mode set by the host.

```js
// Standard — works on any compliant host
const { mode } = await bridge.requestDisplayMode('fullscreen');
console.log(mode); // 'fullscreen' (or whatever the host actually set)
```

#### `bridge.reportSize(width, height)`

Report the widget's current size to the host (fire-and-forget notification).

```js
bridge.reportSize(document.body.scrollWidth, document.body.scrollHeight);
```

#### `bridge.autoResize(target?)` → `stop`

Start automatic size reporting via ResizeObserver. Observes the target element and sends `ui/notifications/size-changed` whenever its dimensions change (debounced to 150ms). Returns a function to stop observing.

```js
// Observe document.body (default)
const stop = bridge.autoResize();

// Observe a specific element
const stop = bridge.autoResize(document.getElementById('app'));

// Later: stop observing
stop();
```

#### `bridge.readResource(uri)` → `Promise<result>`

Read a resource from the MCP server (proxied through the host). Use `bridge.hostCapabilities.serverResources` to feature-detect.

```js
const result = await bridge.readResource('ui://my-server/config');
console.log(result.contents);
```

#### `bridge.log(level, message)`

Send a log message to the host (fire-and-forget notification). Use `bridge.hostCapabilities.logging` to feature-detect.

```js
bridge.log('info', 'Widget loaded successfully');
bridge.log('error', 'Failed to fetch product data');
```

### Context Observation

#### `bridge.onContextChange(callback)` → `unsubscribe`

Register a callback for host context changes. Fires when the host sends `ui/notifications/host-context-changed` — for theme toggles, display mode changes, locale changes, container resizes, etc.

The callback receives the merged (full) `hostContext` after the update. Returns an unsubscribe function.

```js
const stop = bridge.onContextChange((ctx) => {
  document.body.dataset.theme = ctx.theme;
  if (ctx.displayMode === 'fullscreen') showExpandedLayout();
});

// Later: stop listening
stop();
```

#### `bridge.onToolInputPartial(callback)` → `unsubscribe`

Register a callback for streaming tool input arguments. Fires on each `ui/notifications/tool-input-partial` notification sent by the host while the agent is still streaming. The callback receives the best-effort recovered arguments object. Returns an unsubscribe function.

```js
const stop = bridge.onToolInputPartial((params) => {
  // Show fields as they stream in
  if (params.arguments?.title) showTitle(params.arguments.title);
});
```

### Style Helpers

#### `bridge.applyHostStyles(target?)` 

Inject host-provided CSS variables and fonts. Reads `hostContext.styles.variables` and sets each as a CSS custom property on `target`. Also injects font CSS and sets `color-scheme`.

```js
await bridge.connect();
bridge.applyHostStyles();                  // applies to <html>
bridge.applyHostStyles(shadowRoot.host);   // applies to a web component
```

#### `bridge.applyContainerDimensions(target?)`

Apply host-provided container dimensions as CSS. Handles fixed vs flexible sizing per the spec.

```js
bridge.applyContainerDimensions();  // applies to <html>
```

### Low-level JSON-RPC

Escape hatch for forward-compatibility. If the spec adds a new method tomorrow, you can call it immediately without waiting for an SDK update.

```js
// Request — expects a response from the host (returns a Promise)
const result = await bridge.request('ui/request-payment', { amount: 9.99 });
console.log(result); // host's response

// Notification — fire-and-forget (no response, no Promise)
bridge.notify('ui/notifications/size-changed', { width: 400, height: 600 });
```

---

## Vendor Extensions

Vendor extensions expose host-specific capabilities that have **no standard equivalent**. They are auto-detected — just check if the namespace exists.

### `bridge.chatgpt` → `ChatGPTExtensions | null`

Returns a ChatGPT extensions object when running inside ChatGPT (`window.openai` is present), or `null` otherwise.

> **Note**: Theme, locale, display mode, link opening, and size reporting are now handled by the standard protocol (`bridge.hostContext`, `bridge.openLink()`, etc.). The `bridge.chatgpt` namespace only contains truly ChatGPT-specific APIs.

#### State persistence

```js
// Read current state (restored by ChatGPT on re-render)
const state = bridge.chatgpt.widgetState;

// Save state (synchronous call, host persists async)
bridge.chatgpt.setWidgetState({ selectedTab: 2, filters: ['outdoor'] });
```

#### File APIs

```js
// Upload an image file
const { fileId } = await bridge.chatgpt.uploadFile(file);

// Get a temporary download URL
const { downloadUrl } = await bridge.chatgpt.getFileDownloadUrl({ fileId });
```

#### UI Control (ChatGPT-only)

```js
// Open a host modal (optionally targeting another template)
await bridge.chatgpt.requestModal({ template: 'ui://widget/checkout.html' });

// Close the widget
bridge.chatgpt.requestClose();

// Instant Checkout (when enabled)
await bridge.chatgpt.requestCheckout({ /* payload */ });

// Set the "Open in App" URL for fullscreen mode
bridge.chatgpt.setOpenInAppUrl({ href: 'https://myapp.com/dashboard' });
```

#### Other properties

| Property | Type | Description |
|----------|------|-------------|
| `.view` | `string \| null` | Current view identifier |

---

## Examples

### Minimal widget (standalone HTML)

```html
<script type="module">
  import { createBridge } from 'https://main--eds-01--posabogdanpetre.aem.page/scripts/llmapps-sdk.js';

  const bridge = await createBridge({ appInfo: { name: 'MinimalWidget', version: '1.0.0' } });
  const { structuredContent } = await bridge.toolResult;

  document.body.innerHTML = `<h1>${structuredContent.title}</h1>`;
</script>
```

### EDS block (with aem-embed)

The `aem-embed` web component creates the bridge and passes it to your block. It also calls `applyHostStyles()` and `applyContainerDimensions()` automatically.

```js
// blocks/product-showcase/product-showcase.js
export default async function decorate(block, bridge) {
  block.textContent = 'Loading...';

  const result = await bridge.toolResult;
  const products = result.structuredContent.products;

  block.textContent = '';
  products.forEach((p) => {
    const card = document.createElement('div');
    card.innerHTML = `<h3>${p.name}</h3><p>${p.description}</p>`;
    block.appendChild(card);
  });
}
```

### Theme-aware widget (standard protocol)

```js
const bridge = await createBridge({
  appInfo: { name: 'ThemeDemo', version: '1.0.0' },
});

// Initial theme from the standard handshake
document.body.dataset.theme = bridge.hostContext.theme || 'light';

// React to theme changes (standard — works everywhere)
bridge.onContextChange((ctx) => {
  document.body.dataset.theme = ctx.theme;
});

const { structuredContent } = await bridge.toolResult;
renderUI(structuredContent);
```

### Fullscreen with standard display mode

```js
const bridge = await createBridge({
  appInfo: { name: 'FullscreenDemo', version: '1.0.0' },
  appCapabilities: { availableDisplayModes: ['inline', 'fullscreen'] },
});

// Standard — works on any compliant host
expandBtn.addEventListener('click', () => {
  bridge.requestDisplayMode('fullscreen');
});

backBtn.addEventListener('click', () => {
  bridge.requestDisplayMode('inline');
});
```

### External links (standard protocol)

```js
const bridge = await createBridge({
  appInfo: { name: 'LinkDemo', version: '1.0.0' },
});

// Standard — host may show confirmation
link.addEventListener('click', (e) => {
  if (bridge.isConnected) {
    e.preventDefault();
    bridge.openLink('https://example.com/product/123');
  }
  // else: default <a> behavior
});
```

### Interactive widget (button calls another tool)

```js
const bridge = await createBridge({ appInfo: { name: 'Demo', version: '1.0.0' } });
const { structuredContent } = await bridge.toolResult;

const btn = document.createElement('button');
btn.textContent = 'Show only outdoor products';
btn.addEventListener('click', async () => {
  const filtered = await bridge.callTool('getProducts', { category: 'outdoor' });
  renderCards(filtered.structuredContent.products);
});
document.body.appendChild(btn);
```

### File upload with state persistence (ChatGPT)

```js
const bridge = await createBridge({
  appInfo: { name: 'UploadDemo', version: '1.0.0' },
  appCapabilities: { availableDisplayModes: ['inline', 'fullscreen'] },
});

// Standard: go fullscreen
await bridge.requestDisplayMode('fullscreen');

// ChatGPT-only: file upload
if (bridge.chatgpt) {
  fileInput.addEventListener('change', async (e) => {
    const file = e.target.files[0];
    const { fileId } = await bridge.chatgpt.uploadFile(file);
    await bridge.updateModelContext(`User uploaded image: ${fileId}`);
  });
}
```

---

## Protocol Mapping

Every SDK method maps 1:1 to a protocol method:

| SDK | Protocol | Direction | JSON-RPC Type |
|-----|----------|-----------|---------------|
| `connect()` | `ui/initialize` | Widget → Host | Request |
| *(auto)* | `ui/notifications/initialized` | Widget → Host | Notification |
| `toolResult` | `ui/notifications/tool-result` | Host → Widget | Notification |
| `toolInput` | `ui/notifications/tool-input` | Host → Widget | Notification |
| `onToolInputPartial()` | `ui/notifications/tool-input-partial` | Host → Widget | Notification |
| `toolCancelled` | `ui/notifications/tool-cancelled` | Host → Widget | Notification |
| `onContextChange()` | `ui/notifications/host-context-changed` | Host → Widget | Notification |
| *(auto)* | `ui/resource-teardown` | Host → Widget | Request |
| `callTool()` | `tools/call` | Widget → Host | Request |
| `readResource()` | `resources/read` | Widget → Host | Request |
| `log()` | `notifications/message` | Widget → Host | Notification |
| `sendMessage()` | `ui/message` | Widget → Host | Request |
| `updateModelContext()` | `ui/update-model-context` | Widget → Host | Request |
| `openLink()` | `ui/open-link` | Widget → Host | Request |
| `requestDisplayMode()` | `ui/request-display-mode` | Widget → Host | Request |
| `reportSize()` / `autoResize()` | `ui/notifications/size-changed` | Widget → Host | Notification |

Vendor extensions (`bridge.chatgpt.*`) use `window.openai` directly — they do **not** go through the JSON-RPC bridge.

## Vendor Support Matrix

| Capability | Standard | ChatGPT-only |
|-----------|----------|--------------|
| Tool result / input / cancelled | `bridge.toolResult` / `toolInput` / `toolCancelled` | -- |
| Streaming tool input | `bridge.onToolInputPartial()` | -- |
| Call tool / send message | `bridge.callTool()` / `sendMessage()` | -- |
| Read resources | `bridge.readResource()` | -- |
| Update model context | `bridge.updateModelContext()` | -- |
| Logging | `bridge.log()` | -- |
| Theme / locale / display mode | `bridge.hostContext.*` | -- |
| Context changes | `bridge.onContextChange()` | -- |
| Open external link | `bridge.openLink()` | -- |
| Display mode switching | `bridge.requestDisplayMode()` | -- |
| Size reporting | `bridge.reportSize()` / `autoResize()` | -- |
| Host styles / fonts | `bridge.applyHostStyles()` | -- |
| Container dimensions | `bridge.applyContainerDimensions()` | -- |
| Widget state persistence | -- | `bridge.chatgpt.widgetState` |
| File upload / download | -- | `bridge.chatgpt.uploadFile()` |
| Host modals | -- | `bridge.chatgpt.requestModal()` |
| Close widget | -- | `bridge.chatgpt.requestClose()` |
| Checkout | -- | `bridge.chatgpt.requestCheckout()` |
| "Open in App" URL | -- | `bridge.chatgpt.setOpenInAppUrl()` |

## API Surface

Summary of everything available on the bridge instance:

```
// ── Standard Protocol (works everywhere) ──────────────────────
bridge.connect()                         // ui/initialize handshake
bridge.destroy()                         // cleanup

bridge.hostContext                       // theme, locale, styles, displayMode, ...
bridge.hostCapabilities                  // openLinks, serverTools, logging, ...
bridge.hostInfo                          // { name, version }

bridge.toolResult                        // Promise → tool result data
bridge.toolInput                         // Promise → tool input arguments
bridge.toolCancelled                     // Promise → { reason }

bridge.callTool(name, args)              // tools/call
bridge.readResource(uri)                 // resources/read
bridge.log(level, message)              // notifications/message
bridge.sendMessage(text)                 // ui/message
bridge.updateModelContext(text)          // ui/update-model-context
bridge.openLink(url)                     // ui/open-link
bridge.requestDisplayMode(mode)          // ui/request-display-mode
bridge.reportSize(width, height)         // ui/notifications/size-changed
bridge.autoResize(target?)               // ResizeObserver → size-changed
bridge.onContextChange(callback)         // ui/notifications/host-context-changed
bridge.onToolInputPartial(callback)      // ui/notifications/tool-input-partial

bridge.applyHostStyles(target?)          // inject CSS variables + fonts
bridge.applyContainerDimensions(target?) // apply host sizing CSS

bridge.isEmbedded                        // boolean
bridge.isConnected                       // boolean
bridge.host                              // 'chatgpt' | 'claude' | 'unknown'

bridge.request(method, params)           // low-level JSON-RPC request
bridge.notify(method, params)            // low-level JSON-RPC notification

// ── ChatGPT Vendor Extensions ─────────────────────────────────
bridge.chatgpt                           // ChatGPTExtensions | null
bridge.chatgpt.widgetState               // persisted UI state
bridge.chatgpt.setWidgetState(state)     // save UI state
bridge.chatgpt.uploadFile(file)          // file upload → { fileId }
bridge.chatgpt.getFileDownloadUrl(opts)  // → { downloadUrl }
bridge.chatgpt.requestModal(opts)        // host-controlled modal
bridge.chatgpt.requestClose()            // close widget
bridge.chatgpt.requestCheckout(opts)     // instant checkout
bridge.chatgpt.setOpenInAppUrl(opts)     // "Open in App" URL
bridge.chatgpt.view                      // view identifier
```

## Why Use This SDK

Without the LLMApps SDK, every widget must manually implement the JSON-RPC 2.0 postMessage protocol — generating message IDs, matching responses, listening for host notifications, and performing the `ui/initialize` handshake. That's roughly 80–100 lines of boilerplate before you render a single pixel.

**What the SDK gives you:**

- **One-line handshake.** `await bridge.connect()` handles the full `ui/initialize` exchange and parses the host's response into `hostContext`, `hostCapabilities`, and `hostInfo` — ready to use immediately.
- **Promise-based tool data.** `await bridge.toolResult` replaces manual `message` event listeners, JSON-RPC filtering, and method matching with a single await.
- **Cross-host portability.** Standard methods like `openLink()`, `requestDisplayMode()`, and `onContextChange()` work on any compliant host. No vendor-specific code needed for core functionality.
- **Vendor isolation.** Host-specific APIs (ChatGPT's widget state, file upload, modals) are namespaced under `bridge.chatgpt` — cleanly separated from standard protocol, auto-detected, and `null` on other hosts. No runtime errors, no feature-detection boilerplate.
- **Host style injection.** `applyHostStyles()` reads the host's CSS variables and fonts from the handshake and applies them in one call — your widget matches the host theme without custom CSS logic.

## Spec & References

- [LLM Apps Spec](https://modelcontextprotocol.github.io/ext-apps)
- [OpenAI Apps SDK Reference](https://developers.openai.com/apps-sdk/reference)
- [LLM Apps in ChatGPT (migration guide)](https://developers.openai.com/apps-sdk/mcp-apps-in-chatgpt)
- [GitHub: ext-apps](https://github.com/modelcontextprotocol/ext-apps)
