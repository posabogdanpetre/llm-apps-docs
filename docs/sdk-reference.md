# LLMApps SDK

A lightweight, zero-dependency JavaScript SDK for building widgets that run inside LLM Apps hosts — ChatGPT, Claude, and any other compliant client.

It wraps the LLM Apps protocol (JSON-RPC 2.0 over postMessage) into a simple Promise-based API: connect with one call, receive tool data with one await, and interact with the conversation through clear, standard methods that work the same way on every host.

Host-specific capabilities (ChatGPT's widget state, file upload, modals) are auto-detected and isolated under a dedicated namespace — available when present, safely `null` otherwise.

If the spec evolves faster than the SDK, low-level `request()` and `notify()` methods give you a forward-compatible escape hatch to call any protocol method directly.

## Quick Start

```js
import { LLMAppsSDK } from './scripts/llmapps-myApp.js';

const myApp = new LLMAppsSDK({
  appInfo: { name: 'MyWidget', version: '1.0.0' },
});
await myApp.connect();

// Host context (standard — works everywhere)
console.log(myApp.hostContext.theme);   // 'dark'
console.log(myApp.hostContext.locale);  // 'en-US'

const { structuredContent } = await myApp.toolResult;
// structuredContent has your data — render it
```

Or use the factory:

```js
import { createBridge } from './scripts/llmapps-myApp.js';

const bridge = await createBridge({
  appInfo: { name: 'MyWidget', version: '1.0.0' },
});
const { structuredContent } = await myApp.toolResult;
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
const myApp = new LLMAppsSDK({
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

#### `myApp.connect()` → `Promise<LLMAppsSDK>`

Performs the `ui/initialize` handshake. Parses the `McpUiInitializeResult` and populates `hostContext`, `hostCapabilities`, and `hostInfo`. Safe to call when not in an iframe (becomes a no-op).

```js
await myApp.connect();

console.log(myApp.isConnected);          // true
console.log(myApp.host);                 // 'chatgpt' | 'claude' | 'unknown'
console.log(myApp.hostContext.theme);    // 'dark'
console.log(myApp.hostCapabilities);     // { openLinks: true, ... }
console.log(myApp.hostInfo);             // { name: 'chatgpt', version: '...' }
```

#### `myApp.destroy()`

Remove listeners, reject pending requests, unsubscribe all context observers, and clean up. Also triggered automatically when the host sends `ui/resource-teardown`.

### Properties (read-only)

| Property | Type | Description |
|----------|------|-------------|
| `myApp.isEmbedded` | `boolean` | `true` if running inside an iframe |
| `myApp.isConnected` | `boolean` | `true` after successful handshake |
| `myApp.host` | `string \| null` | Detected host: `'chatgpt'`, `'claude'`, etc. Prefers `hostInfo.name` from the handshake, falls back to environment sniffing |

### Host Context

After `connect()`, the host's response is exposed through three getters:

#### `myApp.hostContext` → `object`

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
console.log(myApp.hostContext.theme);           // 'dark'
console.log(myApp.hostContext.locale);          // 'en-US'
console.log(myApp.hostContext.displayMode);     // 'inline'
console.log(myApp.hostContext.safeAreaInsets);   // { top: 0, bottom: 0, ... }
```

#### `myApp.hostCapabilities` → `object`

What the host supports. Use for feature detection before calling methods.

| Field | Type | Description |
|-------|------|-------------|
| `openLinks` | `{} \| undefined` | Present if host supports `myApp.openLink()` |
| `serverTools` | `{ listChanged?: boolean } \| undefined` | Present if host can forward tool calls |
| `serverResources` | `{ listChanged?: boolean } \| undefined` | Present if host supports resource requests |
| `logging` | `{} \| undefined` | Present if host accepts `myApp.log()` messages |
| `sandbox` | `{ permissions?, csp? } \| undefined` | Sandbox configuration applied by the host |

```js
if (myApp.hostCapabilities.openLinks) {
  myApp.openLink('https://example.com');
}
```

#### `myApp.hostInfo` → `{ name?: string, version?: string }`

The host's identity. Used internally to improve `myApp.host` detection.

### Tool Data

#### `myApp.toolResult` → `Promise<params>`

Resolves when the host sends `ui/notifications/tool-result`. **One-shot** — resolves once per widget lifecycle.

```js
const result = await myApp.toolResult;

result.structuredContent  // → the data (visible to model + widget)
result.content            // → text narration array
result._meta              // → widget-only data (hidden from model)
```

#### `myApp.toolInput` → `Promise<params>`

Resolves when the host sends `ui/notifications/tool-input` — the arguments the model passed to the tool. **One-shot**.

```js
const input = await myApp.toolInput;
console.log(input); // e.g. { category: 'electronics' }
```

#### `myApp.toolCancelled` → `Promise<{ reason? }>`

Resolves if the host cancels the tool execution (`ui/notifications/tool-cancelled`). **One-shot**.

```js
myApp.toolCancelled.then(({ reason }) => {
  showMessage(`Tool cancelled: ${reason || 'unknown'}`);
});
```

### Interaction Methods

#### `myApp.callTool(name, args)` → `Promise<result>`

Call any tool from the widget UI.

```js
const result = await myApp.callTool('getProducts', { category: 'outdoor' });
console.log(result.structuredContent);
```

#### `myApp.sendMessage(text)` → `Promise<result>`

Post a follow-up message in the conversation as the user. The message is **visible** in the chat and the model responds.

```js
await myApp.sendMessage('Tell me more about this product.');
```

#### `myApp.updateModelContext(text)` → `Promise<result>`

Silently tell the model what the user is doing inside the widget. **Nothing appears** in the chat, but the model remembers it for future responses.

```js
await myApp.updateModelContext('User selected 3 items from the list.');
```

#### `myApp.openLink(url)` → `Promise<result>`

Open an external link via the host. The host may show a confirmation dialog.

```js
// Standard — works on any compliant host
await myApp.openLink('https://example.com/product/123');
```

Use `myApp.hostCapabilities.openLinks` to feature-detect before calling.

#### `myApp.requestDisplayMode(mode)` → `Promise<{ mode }>`

Request a display mode change. Returns the actual mode set by the host.

```js
// Standard — works on any compliant host
const { mode } = await myApp.requestDisplayMode('fullscreen');
console.log(mode); // 'fullscreen' (or whatever the host actually set)
```

#### `myApp.reportSize(width, height)`

Report the widget's current size to the host (fire-and-forget notification).

```js
myApp.reportSize(document.body.scrollWidth, document.body.scrollHeight);
```

#### `myApp.autoResize(target?)` → `stop`

Start automatic size reporting via ResizeObserver. Observes the target element and sends `ui/notifications/size-changed` whenever its dimensions change (debounced to 150ms). Returns a function to stop observing.

```js
// Observe document.body (default)
const stop = myApp.autoResize();

// Observe a specific element
const stop = myApp.autoResize(document.getElementById('app'));

// Later: stop observing
stop();
```

#### `myApp.readResource(uri)` → `Promise<result>`

Read a resource from the MCP server (proxied through the host). Use `myApp.hostCapabilities.serverResources` to feature-detect.

```js
const result = await myApp.readResource('ui://my-server/config');
console.log(result.contents);
```

#### `myApp.log(level, message)`

Send a log message to the host (fire-and-forget notification). Use `myApp.hostCapabilities.logging` to feature-detect.

```js
myApp.log('info', 'Widget loaded successfully');
myApp.log('error', 'Failed to fetch product data');
```

### Context Observation

#### `myApp.onContextChange(callback)` → `unsubscribe`

Register a callback for host context changes. Fires when the host sends `ui/notifications/host-context-changed` — for theme toggles, display mode changes, locale changes, container resizes, etc.

The callback receives the merged (full) `hostContext` after the update. Returns an unsubscribe function.

```js
const stop = myApp.onContextChange((ctx) => {
  document.body.dataset.theme = ctx.theme;
  if (ctx.displayMode === 'fullscreen') showExpandedLayout();
});

// Later: stop listening
stop();
```

#### `myApp.onToolInputPartial(callback)` → `unsubscribe`

Register a callback for streaming tool input arguments. Fires on each `ui/notifications/tool-input-partial` notification sent by the host while the agent is still streaming. The callback receives the best-effort recovered arguments object. Returns an unsubscribe function.

```js
const stop = myApp.onToolInputPartial((params) => {
  // Show fields as they stream in
  if (params.arguments?.title) showTitle(params.arguments.title);
});
```

### Style Helpers

#### `myApp.applyHostStyles(target?)` 

Inject host-provided CSS variables and fonts. Reads `hostContext.styles.variables` and sets each as a CSS custom property on `target`. Also injects font CSS and sets `color-scheme`.

```js
await myApp.connect();
myApp.applyHostStyles();                  // applies to <html>
myApp.applyHostStyles(shadowRoot.host);   // applies to a web component
```

#### `myApp.applyContainerDimensions(target?)`

Apply host-provided container dimensions as CSS. Handles fixed vs flexible sizing per the spec.

```js
myApp.applyContainerDimensions();  // applies to <html>
```

### Low-level JSON-RPC

Escape hatch for forward-compatibility. If the spec adds a new method tomorrow, you can call it immediately without waiting for an SDK update.

```js
// Request — expects a response from the host (returns a Promise)
const result = await myApp.request('ui/request-payment', { amount: 9.99 });
console.log(result); // host's response

// Notification — fire-and-forget (no response, no Promise)
myApp.notify('ui/notifications/size-changed', { width: 400, height: 600 });
```

---

## Vendor Extensions

Vendor extensions expose host-specific capabilities that have **no standard equivalent**. They are auto-detected — just check if the namespace exists.

### `myApp.chatgpt` → `ChatGPTExtensions | null`

Returns a ChatGPT extensions object when running inside ChatGPT (`window.openai` is present), or `null` otherwise.

> **Note**: Theme, locale, display mode, link opening, and size reporting are now handled by the standard protocol (`myApp.hostContext`, `myApp.openLink()`, etc.). The `myApp.chatgpt` namespace only contains truly ChatGPT-specific APIs.

#### State persistence

```js
// Read current state (restored by ChatGPT on re-render)
const state = myApp.chatgpt.widgetState;

// Save state (synchronous call, host persists async)
myApp.chatgpt.setWidgetState({ selectedTab: 2, filters: ['outdoor'] });
```

#### File APIs

```js
// Upload an image file
const { fileId } = await myApp.chatgpt.uploadFile(file);

// Get a temporary download URL
const { downloadUrl } = await myApp.chatgpt.getFileDownloadUrl({ fileId });
```

#### UI Control (ChatGPT-only)

```js
// Open a host modal (optionally targeting another template)
await myApp.chatgpt.requestModal({ template: 'ui://widget/checkout.html' });

// Close the widget
myApp.chatgpt.requestClose();

// Instant Checkout (when enabled)
await myApp.chatgpt.requestCheckout({ /* payload */ });

// Set the "Open in App" URL for fullscreen mode
myApp.chatgpt.setOpenInAppUrl({ href: 'https://myapp.com/dashboard' });
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
  import { createBridge } from 'https://main--eds-01--posabogdanpetre.aem.page/scripts/llmapps-myApp.js';

  const bridge = await createBridge({ appInfo: { name: 'MinimalWidget', version: '1.0.0' } });
  const { structuredContent } = await myApp.toolResult;

  document.body.innerHTML = `<h1>${structuredContent.title}</h1>`;
</script>
```

### EDS block (with aem-embed)

The `aem-embed` web component creates the bridge and passes it to your block. It also calls `applyHostStyles()` and `applyContainerDimensions()` automatically.

```js
// blocks/product-showcase/product-showcase.js
export default async function decorate(block, bridge) {
  block.textContent = 'Loading...';

  const result = await myApp.toolResult;
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
document.body.dataset.theme = myApp.hostContext.theme || 'light';

// React to theme changes (standard — works everywhere)
myApp.onContextChange((ctx) => {
  document.body.dataset.theme = ctx.theme;
});

const { structuredContent } = await myApp.toolResult;
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
  myApp.requestDisplayMode('fullscreen');
});

backBtn.addEventListener('click', () => {
  myApp.requestDisplayMode('inline');
});
```

### External links (standard protocol)

```js
const bridge = await createBridge({
  appInfo: { name: 'LinkDemo', version: '1.0.0' },
});

// Standard — host may show confirmation
link.addEventListener('click', (e) => {
  if (myApp.isConnected) {
    e.preventDefault();
    myApp.openLink('https://example.com/product/123');
  }
  // else: default <a> behavior
});
```

### Interactive widget (button calls another tool)

```js
const bridge = await createBridge({ appInfo: { name: 'Demo', version: '1.0.0' } });
const { structuredContent } = await myApp.toolResult;

const btn = document.createElement('button');
btn.textContent = 'Show only outdoor products';
btn.addEventListener('click', async () => {
  const filtered = await myApp.callTool('getProducts', { category: 'outdoor' });
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
await myApp.requestDisplayMode('fullscreen');

// ChatGPT-only: file upload
if (myApp.chatgpt) {
  fileInput.addEventListener('change', async (e) => {
    const file = e.target.files[0];
    const { fileId } = await myApp.chatgpt.uploadFile(file);
    await myApp.updateModelContext(`User uploaded image: ${fileId}`);
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

Vendor extensions (`myApp.chatgpt.*`) use `window.openai` directly — they do **not** go through the JSON-RPC myApp.

## Vendor Support Matrix

| Capability | Standard | ChatGPT-only |
|-----------|----------|--------------|
| Tool result / input / cancelled | `myApp.toolResult` / `toolInput` / `toolCancelled` | -- |
| Streaming tool input | `myApp.onToolInputPartial()` | -- |
| Call tool / send message | `myApp.callTool()` / `sendMessage()` | -- |
| Read resources | `myApp.readResource()` | -- |
| Update model context | `myApp.updateModelContext()` | -- |
| Logging | `myApp.log()` | -- |
| Theme / locale / display mode | `myApp.hostContext.*` | -- |
| Context changes | `myApp.onContextChange()` | -- |
| Open external link | `myApp.openLink()` | -- |
| Display mode switching | `myApp.requestDisplayMode()` | -- |
| Size reporting | `myApp.reportSize()` / `autoResize()` | -- |
| Host styles / fonts | `myApp.applyHostStyles()` | -- |
| Container dimensions | `myApp.applyContainerDimensions()` | -- |
| Widget state persistence | -- | `myApp.chatgpt.widgetState` |
| File upload / download | -- | `myApp.chatgpt.uploadFile()` |
| Host modals | -- | `myApp.chatgpt.requestModal()` |
| Close widget | -- | `myApp.chatgpt.requestClose()` |
| Checkout | -- | `myApp.chatgpt.requestCheckout()` |
| "Open in App" URL | -- | `myApp.chatgpt.setOpenInAppUrl()` |

## API Surface

Summary of everything available on the bridge instance:

```
// ── Standard Protocol (works everywhere) ──────────────────────
myApp.connect()                         // ui/initialize handshake
myApp.destroy()                         // cleanup

myApp.hostContext                       // theme, locale, styles, displayMode, ...
myApp.hostCapabilities                  // openLinks, serverTools, logging, ...
myApp.hostInfo                          // { name, version }

myApp.toolResult                        // Promise → tool result data
myApp.toolInput                         // Promise → tool input arguments
myApp.toolCancelled                     // Promise → { reason }

myApp.callTool(name, args)              // tools/call
myApp.readResource(uri)                 // resources/read
myApp.log(level, message)              // notifications/message
myApp.sendMessage(text)                 // ui/message
myApp.updateModelContext(text)          // ui/update-model-context
myApp.openLink(url)                     // ui/open-link
myApp.requestDisplayMode(mode)          // ui/request-display-mode
myApp.reportSize(width, height)         // ui/notifications/size-changed
myApp.autoResize(target?)               // ResizeObserver → size-changed
myApp.onContextChange(callback)         // ui/notifications/host-context-changed
myApp.onToolInputPartial(callback)      // ui/notifications/tool-input-partial

myApp.applyHostStyles(target?)          // inject CSS variables + fonts
myApp.applyContainerDimensions(target?) // apply host sizing CSS

myApp.isEmbedded                        // boolean
myApp.isConnected                       // boolean
myApp.host                              // 'chatgpt' | 'claude' | 'unknown'

myApp.request(method, params)           // low-level JSON-RPC request
myApp.notify(method, params)            // low-level JSON-RPC notification

// ── ChatGPT Vendor Extensions ─────────────────────────────────
myApp.chatgpt                           // ChatGPTExtensions | null
myApp.chatgpt.widgetState               // persisted UI state
myApp.chatgpt.setWidgetState(state)     // save UI state
myApp.chatgpt.uploadFile(file)          // file upload → { fileId }
myApp.chatgpt.getFileDownloadUrl(opts)  // → { downloadUrl }
myApp.chatgpt.requestModal(opts)        // host-controlled modal
myApp.chatgpt.requestClose()            // close widget
myApp.chatgpt.requestCheckout(opts)     // instant checkout
myApp.chatgpt.setOpenInAppUrl(opts)     // "Open in App" URL
myApp.chatgpt.view                      // view identifier
```

## Why Use This SDK

Without the LLMApps SDK, every widget must manually implement the JSON-RPC 2.0 postMessage protocol — generating message IDs, matching responses, listening for host notifications, and performing the `ui/initialize` handshake. That's roughly 80–100 lines of boilerplate before you render a single pixel.

**What the SDK gives you:**

- **One-line handshake.** `await myApp.connect()` handles the full `ui/initialize` exchange and parses the host's response into `hostContext`, `hostCapabilities`, and `hostInfo` — ready to use immediately.
- **Promise-based tool data.** `await myApp.toolResult` replaces manual `message` event listeners, JSON-RPC filtering, and method matching with a single await.
- **Cross-host portability.** Standard methods like `openLink()`, `requestDisplayMode()`, and `onContextChange()` work on any compliant host. No vendor-specific code needed for core functionality.
- **Vendor isolation.** Host-specific APIs (ChatGPT's widget state, file upload, modals) are namespaced under `myApp.chatgpt` — cleanly separated from standard protocol, auto-detected, and `null` on other hosts. No runtime errors, no feature-detection boilerplate.
- **Host style injection.** `applyHostStyles()` reads the host's CSS variables and fonts from the handshake and applies them in one call — your widget matches the host theme without custom CSS logic.

## Spec & References

- [LLM Apps Spec](https://modelcontextprotocol.github.io/ext-apps)
- [OpenAI Apps SDK Reference](https://developers.openai.com/apps-sdk/reference)
- [LLM Apps in ChatGPT (migration guide)](https://developers.openai.com/apps-sdk/mcp-apps-in-chatgpt)
- [GitHub: ext-apps](https://github.com/modelcontextprotocol/ext-apps)
