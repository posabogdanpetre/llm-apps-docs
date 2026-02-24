# LLMApps Docs

Welcome to the LLMApps documentation — everything you need to build widgets that run inside LLM Apps hosts like ChatGPT, Claude, and any compliant client.

## Getting Started

LLMApps provides a lightweight, zero-dependency JavaScript SDK that wraps the LLM Apps protocol (JSON-RPC 2.0 over postMessage) into a simple Promise-based API.

```js
import { LLMAppsSDK } from './scripts/llmapps-sdk.js';

const bridge = new LLMAppsSDK({
  appInfo: { name: 'MyWidget', version: '1.0.0' },
});
await bridge.connect();

const toolData = await bridge.getToolData();
```

That's it — three lines to connect, one to receive data.

## Documentation

| Guide | Description |
|-------|-------------|
| [JS SDK Reference](/js-sdk-reference) | Full API reference — constructor, lifecycle, tool data, interaction methods, context observation, and vendor extensions |

## Key Features

- **Zero dependencies** — no bundler required, works as a plain ES module
- **Universal** — same API across ChatGPT, Claude, and any compliant host
- **Promise-based** — async/await from connect to disconnect
- **Auto-detection** — host-specific capabilities discovered automatically
- **Forward-compatible** — low-level `request()` and `notify()` for any protocol method

## Architecture

LLMApps widgets run inside an iframe hosted by the LLM application. Communication flows through `postMessage` using JSON-RPC 2.0:

```
┌─────────────────────────────┐
│  LLM Host (ChatGPT, etc.)  │
│                             │
│  ┌───────────────────────┐  │
│  │   Widget (iframe)     │  │
│  │                       │  │
│  │   LLMAppsSDK          │  │
│  │     ↕ postMessage     │  │
│  └───────────────────────┘  │
│         ↕ JSON-RPC 2.0     │
│  Host Protocol Handler      │
└─────────────────────────────┘
```

## Links

- [GitHub Repository](https://github.com/posabogdanpetre/llm-apps-docs)
