# LLM Apps

A boilerplate for rapidly building ChatGPT applications with custom actions and interactive widgets, powered by the Model Context Protocol (MCP).

## What is LLM Apps?

LLM Apps helps you create ChatGPT applications that can:

- Execute custom **actions** — search products, book appointments, fetch data
- Display rich **widgets** — interactive cards, forms, product galleries
- Connect to your own **data sources and APIs**
- Deploy to **AEM Edge Functions** for production use

## Key Concepts

| Concept | Description |
|---------|-------------|
| **MCP** | Model Context Protocol — the standard protocol for AI assistants to interact with external tools |
| **Actions** | Functions that ChatGPT can call (e.g., "search catalog", "get weather") |
| **Widgets** | Visual components displayed in ChatGPT conversations (product cards, booking forms, carousels) |
| **llma-server** | Your MCP server that handles ChatGPT requests and serves actions/widgets |
| **llma-ui** | Web interface for creating, managing, and deploying actions |

## Components

### llma-server — MCP Server

Your ChatGPT action server with:

- **Action System** — Create custom functions ChatGPT can call
- **Widget System** — Build interactive UI components (EDS, Experience Fragments, Content Fragments)
- **Input Validation** — Automatic validation of user inputs via Zod schemas
- **Session Management** — Handles user sessions automatically
- **AEP Integration** — Optional Adobe Experience Platform tracking
- **Production Ready** — Deploy to AEM Edge Functions

### llma-ui — Management Interface

Visual tool for managing your actions:

- **Action Wizard** — Step-by-step action creation with full validation
- **Edit & Deploy** — Modify actions and deploy changes instantly
- **Widget Builder** — Create interactive UI components
- **Visual Flow Builder** — Design conversation flows
- **Change Tracking** — Review all changes before deploying
- **One-Click Deploy** — Deploy to local or production with real-time output

## Technology Stack

| Layer | Technology |
|-------|-----------|
| Language | TypeScript (full type safety) |
| MCP SDK | @modelcontextprotocol/sdk v1.20.2 |
| Server Runtime | Fastly Compute@Edge (JavaScript/WASM) |
| UI Framework | React 18 + Vite |
| UI Library | Adobe React Spectrum |
| Backend | Hono (lightweight & fast) |
| Testing | Jest |

## What You Can Build

- **E-commerce** — Product search with cart widgets
- **Booking** — Appointment scheduling with calendar display
- **Data Visualization** — Interactive charts and dashboards
- **Content Search** — Rich result cards with AEM content
- **Forms** — Submission flows with confirmation widgets
- **Carousels** — Dynamic Experience Fragment galleries

## Documentation

| Guide | Description |
|-------|-------------|
| [Getting Started](/getting-started) | Prerequisites, installation, configuration, and first run |
| [JS SDK Reference](/js-sdk-reference) | Full API reference for the LLMApps JavaScript SDK |
