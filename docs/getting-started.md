# Getting Started

This guide walks you through installing, configuring, and running LLM Apps for local development.

## Prerequisites

### Both Components

- **Node.js** v20.x or higher (tested with v20.19.3)
- **npm** v10.x or higher (tested with v10.8.2)

### llma-server (additional)

- **Make** (pre-installed on macOS)
- **Fastly CLI** v11.x or higher (installed automatically by `make setup`)
- **Adobe I/O CLI** (installed automatically by `make setup`)
- **AEM Edge Functions plugin** (installed automatically by `make setup`)

### llma-ui

No additional dependencies — just Node.js and npm.

## Download

Download the latest release from the [Adobe Software Distribution](https://experience.adobe.com/#/downloads/content/software-distribution/en/aem.html) portal:

1. Log in to the portal
2. In **Filters**, select **Beta** under Software type
3. Find the latest LLM Apps release
4. Accept the EULA and download
5. Unzip to your preferred location:

```bash
unzip llm-conversion-bridge-*.zip -d ~/Projects/
```

## Install Dependencies

### llma-server

```bash
cd llma-server
make setup
```

This installs npm dependencies, Fastly CLI, Adobe I/O CLI, and the AEM Edge Functions plugin.

### llma-ui

```bash
cd llma-ui
npm install
```

## Configuration

### Environment Variables

The project uses a `.env` file as the single source of truth for all configuration.

```bash
cp .env.example .env
```

Open `.env` and configure:

| Variable | Required | Description | Example |
|----------|----------|-------------|---------|
| `AEM_COMPUTE_SERVICE` | Yes | AEM Edge Functions service ID | `pXXXXXX-eXXXXXX-llma-boilerplate` |
| `CDN_API_OAUTH_CLIENT_ID` | Yes | CDN API OAuth client ID ([how to obtain](#obtaining-oauth-credentials)) | `aem-cdn-api-client-xxxxxxxx` |
| `CDN_API_OAUTH_CLIENT_SECRET` | Yes | CDN API OAuth client secret ([how to obtain](#obtaining-oauth-credentials)) | `p8e-xxxxxxxxxxxxxxxxxxxxxxxx` |

The service ID follows the format `p<project>-e<env>-<service-name>`. The service name is extracted and used as the MCP endpoint path.

**Example:**

```bash
AEM_COMPUTE_SERVICE=p123456-e789012-my-chatgpt-app
# → MCP endpoint: http://localhost:7676/my-chatgpt-app
```

### Optional Variables

| Variable | Default | Description |
|----------|---------|-------------|
| `LLMA_UI_FRONTEND_PORT` | `4545` | llma-ui frontend port (HTTPS) |
| `LLMA_UI_BACKEND_PORT` | `3000` | llma-ui backend API port |
| `LLMA_SERVER_PORT` | `7676` | llma-server MCP server port |
| `EDS_BRANCH` | — | Git branch for EDS content (only for EDS Widgets) |
| `EDS_REPO` | — | EDS repository name (only for EDS Widgets) |
| `EDS_OWNER` | — | EDS repository owner (only for EDS Widgets) |

### Obtaining OAuth Credentials

1. Go to the [Adobe Developer Console](https://developer.adobe.com/)
2. Create a project (or use an existing one)
3. Add the **AEM Content Delivery Network (CDN) API**
4. Choose **Server-to-Server Authentication**
5. Select the **AEM Administrator Publish** product profile for your environment
6. Copy the **Client ID** and **Client Secret** into your `.env` file

## Running the Application

### Option 1: Using run.sh (Recommended)

```bash
./run.sh
```

This script:

- Loads environment variables from `.env`
- Runs environment checks
- Installs dependencies if needed
- Starts both llma-server and llma-ui
- Polls health checks until both services are ready
- Handles graceful shutdown with Ctrl+C

For faster startup (skips TypeScript tests):

```bash
./run.sh --skip-tests
```

### Option 2: Manual Startup

**Terminal 1 — llma-server:**

```bash
cd llma-server
make build
make serve
```

**Terminal 2 — llma-ui:**

```bash
cd llma-ui
npm run dev
```

### Access URLs

| Service | URL | Notes |
|---------|-----|-------|
| llma-ui | `https://localhost:4545` | HTTPS with self-signed or mkcert certificate |
| llma-server | `http://localhost:7676/<service-name>` | Service name from `AEM_COMPUTE_SERVICE` |

### Verify Everything is Running

When using `run.sh`, you should see:

```
================================================
   All services are running!
================================================

Access:
  • llma-ui:     https://localhost:4545
  • llma-server: http://localhost:7676/llma-boilerplate

Press Ctrl+C to stop all processes
```

You can also verify manually:

```bash
curl -sk https://localhost:4545
curl http://localhost:7676/<service-name>
```

## Using the UI

### Servers Page

Open `https://localhost:4545/llma-servers` to see two pre-configured server cards:

| Server | Description |
|--------|-------------|
| **Managed LLMA Server (Local)** | Your local development server — use this for building and testing actions |
| **Managed LLMA Server (Remote)** | Points to your AEM Edge Functions deployment — use for production testing |

Both server URLs are derived from `AEM_COMPUTE_SERVICE`:

```
AEM_COMPUTE_SERVICE=pXXXXXX-eXXXXXX-llma-boilerplate
                    └──────┬───────┘ └──────┬──────┘
                     environmentId     serviceName
```

| Server | URL Pattern |
|--------|-------------|
| Local | `http://localhost:7676/<serviceName>` |
| Remote | `https://publish-<environmentId>.adobeaemcloud.com/<serviceName>` |

Click **Connect** on the Local server to start working.

### Actions & Widgets Page

Once connected, click **Actions & Widgets** in the sidebar to browse and manage MCP actions.

| Action | Description |
|--------|-------------|
| **Execute** | Test an action by providing input parameters |
| **Edit** | Modify action details, schema, and metadata |
| **Delete** | Soft delete (restorable until deployment) |
| **Create** | Build new actions with the step-by-step wizard |

### Creating an Action

Click **Create Action** and choose the widget type:

| Type | Description |
|------|-------------|
| **EDS Widget** | Interactive widgets powered by Adobe Edge Delivery Services |
| **Experience Fragment** | Embed AEM Experience Fragments with dynamic content |
| **CF Widget** | Widgets backed by Adobe Content Fragments (coming soon) |
| **None (Headless)** | Pure text responses without visual interface |

The wizard guides you through:

1. **Action Details** — Name, description, annotations, input parameters
2. **OpenAI Metadata** — Output template, visibility, status messages
3. **Widget Configuration** — URLs, CSP domains (for widget actions)
4. **Resource Metadata** — Widget resource properties (for widget actions)
5. **User Intent Tracking** — Optional analytics field
6. **Files Preview** — Review generated file structure

### Deploying

After creating or editing actions:

1. Click **Review Changes** in the sidebar (orange dot indicates pending changes)
2. Review the list of additions, modifications, and deletions
3. Click **Apply Changes** to deploy

The system will:

- Generate action files in `llma-server/src/actions/`
- Build and restart the local server
- Reconnect automatically
- Clear all uncommitted changes

## Common Commands

### Development

```bash
./run.sh                              # Start everything
./run.sh --skip-tests                 # Fast startup
./check-env.sh                        # Verify your setup
```

### Creating Actions via CLI

```bash
cd llma-server
make create-action NAME=myAction              # Headless action
make create-action NAME=myWidget WIDGET=true  # Action with widget
```

### Testing

```bash
npx @modelcontextprotocol/inspector
# Connect to: http://localhost:7676/<service-name>
```

## Remote Deployment (AEM Edge Functions)

Once your actions are working locally, deploy them to AEM Edge Functions for production use.

### 1. Configure the AEM Edge Functions CLI

From `llma-server`, run the setup command to select your AEM program and environment:

```bash
cd llma-server
aio aem edge-functions setup
```

This creates a local `.aio` config file that tells the CLI which AEM program/environment to target. You only need to do this once per environment.

For CI/CD pipelines, copy the `.aio` file contents into a secret and recreate it at runtime — otherwise `aio aem edge-functions deploy` won't know which environment to target.

### 2. Set Environment Variables

Make sure your `.env` file has the correct values for the target environment:

```bash
AEM_COMPUTE_SERVICE=pXXXXXX-eXXXXXX-your-app-name
CDN_API_OAUTH_CLIENT_ID=aem-cdn-api-client-xxxxxxxx
CDN_API_OAUTH_CLIENT_SECRET=p8e-xxxxxxxxxxxxxxxxxxxxxxxx
```

### 3. Deploy

```bash
cd llma-server
make deploy
```

This will:

- Generate a fresh OAuth token from your credentials
- Build the WASM binary with your environment configuration baked in
- Deploy to AEM Edge Functions

### 4. Verify

Check the deployment logs:

```bash
make tail-logs
```

Your MCP server is now live at:

```
https://publish-pXXXXXX-eXXXXXX.adobeaemcloud.com/<service-name>
```

You can connect to it from the UI using the **Managed LLMA Server (Remote)** card.

## HTTPS Certificate Setup

The UI runs on HTTPS. By default, it uses a self-signed certificate (browser shows a warning). For a trusted certificate:

```bash
# Install mkcert
brew install mkcert
mkcert -install

# Generate certificates
cd llma-ui
mkdir -p certs
mkcert -key-file certs/localhost-key.pem \
       -cert-file certs/localhost-cert.pem \
       localhost 127.0.0.1 ::1
```

After this, the browser will show a green padlock with no warnings. The Vite dev server auto-detects mkcert certificates and uses them when present.

## Troubleshooting

### "AEM_COMPUTE_SERVICE not set"

Missing or incorrect `.env` file. Copy `.env.example` to `.env` and configure the values.

### "Port already in use"

Another process is using the port. Run `./run.sh` — it detects and offers to stop existing processes.

### Certificate error in browser

Self-signed HTTPS certificate. Click "Advanced" → "Proceed to localhost" for a quick fix, or install mkcert (see above) for a permanent solution.

### Action not appearing after creation

Actions are saved to the local database first. Click **Review Changes** → **Apply Changes** to deploy them to the running server.

### Still stuck?

```bash
./check-env.sh    # Verify your setup
```

Check `llma-server/README.md` and `llma-ui/README.md` for component-specific documentation.
