# Odoo MCP Server

A professional Model Context Protocol (MCP) server for seamless Odoo ERP integration. Supports both HTTP and STDIO transports for maximum flexibility.

[![npm version](https://img.shields.io/npm/v/@mweinheimer/odoo-mcp-server.svg)](https://www.npmjs.com/package/@mweinheimer/odoo-mcp-server)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)

## 🚀 Features

### 🌐 Dual Transport Support
- **HTTP Mode**: REST API with Express.js for web applications and remote access
- **STDIO Mode**: Direct stdin/stdout communication for Claude Desktop and local AI assistants

### 🔧 Complete Odoo Integration
- **Authentication**: Automatic login with environment variables or manual connect
- **CRUD Operations**: Full Create, Read, Update, Delete on any Odoo model
- **Advanced Search**: Complex domain filtering with Odoo's powerful search syntax
- **Method Calls**: Execute any custom method on Odoo models
- **Multi-Protocol**: XML-RPC and JSON-RPC support

### 🏗️ Professional Architecture
- **TypeScript**: Full type safety and modern ES modules
- **MCP Protocol**: Compliant with Model Context Protocol 2024-11-05
- **Error Handling**: Comprehensive error handling and logging
- **Modular Design**: Clean separation of concerns
- **Production Ready**: Battle-tested with real Odoo deployments

## 📦 Installation

### NPM (Recommended)
```bash
npm install -g @mweinheimer/odoo-mcp-server
```

### From Source
```bash
git clone https://github.com/heimerle/odoo-mcp-server.git
cd odoo-mcp-server
npm install
npm run build
```

## ⚙️ Configuration

### Environment Variables

Create a `.env.local` file or set these environment variables:

```bash
# Odoo Connection (Required)
ODOO_URL=http://your-odoo-instance:8069
ODOO_DB=your_database            # or ODOO_DATABASE
ODOO_USERNAME=your_username      # optional when ODOO_TRANSPORT=json2
ODOO_PASSWORD=your_password      # or API key when ODOO_TRANSPORT=json2

# Transport Mode
MCP_TRANSPORT=stdio              # 'http' or 'stdio' (default: http)

# Odoo Protocol
ODOO_TRANSPORT=jsonrpc           # 'jsonrpc', 'json2', or 'xmlrpc' (default: jsonrpc)

# HTTP Mode Settings (only for MCP_TRANSPORT=http)
MCP_HTTP_PORT=3001               # HTTP server port (default: 3001)
```

### Claude Desktop Configuration

Add to your `claude_desktop_config.json`:

```json
{
  "mcpServers": {
    "odoo": {
      "command": "node",
      "args": [
        "/path/to/odoo-mcp-server/dist/stdio-server.js"
      ],
      "env": {
        "ODOO_URL": "http://your-odoo:8069",
        "ODOO_DB": "your_database",
        "ODOO_USERNAME": "your_username",
        "ODOO_PASSWORD": "your_password"
      }
    }
  }
}
```

Or use the global installation:

```json
{
  "mcpServers": {
    "odoo": {
      "command": "odoo-stdio-server",
      "env": {
        "ODOO_URL": "http://your-odoo:8069",
        "ODOO_DB": "your_database",
        "ODOO_USERNAME": "your_username",
        "ODOO_PASSWORD": "your_password",
        "MCP_TRANSPORT": "stdio"
      }
    }
  }
}
```

### VS Code Configuration

**Global installation:**
```json
{
    "servers": {
        "odoo": {
            "command": "odoo-stdio-server",
            "env": {
                "ODOO_URL": "${input:odoo_url}",
                "ODOO_DATABASE": "${input:odoo_db}",
                "ODOO_USERNAME": "${input:odoo_username}",
                "ODOO_PASSWORD": "${input:odoo_api_key}",
                "ODOO_TRANSPORT": "${input:odoo_transport}",
                "MCP_TRANSPORT": "stdio"
            }
        }
    },
    "inputs": [
        {
            "id": "odoo_url",
            "type": "promptString",
            "description": "Odoo base URL",
            "default": "http://localhost:8069"
        },
        {
            "id": "odoo_db",
            "type": "promptString",
            "description": "Odoo database name",
            "default": "odoo_live"
        },
        {
            "id": "odoo_username",
            "type": "promptString",
            "description": "Odoo username (email)",
        },
        {
            "id": "odoo_api_key",
            "type": "promptString",
            "description": "Odoo API key (token) or password for non-json2 transports",
            "default": ""
        },
        {
            "id": "odoo_transport",
            "type": "promptString",
            "description": "Odoo transport mode ('jsonrpc', 'json2', or 'xmlrpc')",
            "default": "json2"
        }
    ]
}
```

**Local installation (self-built):**
`./vscode/mcp.json`
```json
{
  "servers": {
      "odoo": {
          "command": "npx",
          "args": ["odoo-stdio-server"],
          // env ...
      }
  }
}
```

## 🚀 Quick Start

### HTTP Mode

```bash
# Using environment variables
ODOO_URL=http://localhost:8069 \
ODOO_DB=mydb \
ODOO_USERNAME=admin \
ODOO_PASSWORD=admin \
MCP_TRANSPORT=http \
node dist/http-mcp-server.js

# Server starts on http://localhost:3001
```

### STDIO Mode (Claude Desktop)

```bash
# Using the dedicated STDIO entry point
ODOO_URL=http://localhost:8069 \
ODOO_DB=mydb \
ODOO_USERNAME=admin \
ODOO_PASSWORD=admin \
node dist/stdio-server.js
```

## 🔧 Available Tools

The server provides 13 MCP tools for Odoo interaction:

1. **odoo_ping** - Test Odoo connection and get server info
2. **odoo_connect** - Manual login to Odoo (when auto-login is not configured)
3. **odoo_search_read** - Search and read records with domain filters
4. **odoo_create** - Create new records in any model
5. **odoo_write** - Update existing records
6. **odoo_unlink** - Delete records
7. **odoo_call_method** - Execute custom methods on models
8. **odoo_get_fields** - Get field definitions for a model
9. **odoo_read** - Read specific records by ID
10. **odoo_search** - Search for record IDs
11. **odoo_search_count** - Count records matching criteria
12. **odoo_name_get** - Get display names for records
13. **odoo_name_search** - Search records by name

## 📚 Usage Examples

### Example 1: Search Customers (HTTP)

```bash
curl -X POST http://localhost:3001/mcp \
  -H "Content-Type: application/json" \
  -d '{
    "jsonrpc": "2.0",
    "method": "tools/call",
    "params": {
      "name": "odoo_search_read",
      "arguments": {
        "model": "res.partner",
        "domain": [["is_company", "=", true]],
        "fields": ["name", "email", "phone"],
        "limit": 10
      }
    },
    "id": 1
  }'
```

### Example 2: Create Contact (Claude Desktop - STDIO)

Simply ask Claude:
> "Create a new contact in Odoo with name 'John Doe', email 'john@example.com'"

Claude will use the `odoo_create` tool automatically.

### Example 3: Update Record

```bash
curl -X POST http://localhost:3001/mcp \
  -H "Content-Type: application/json" \
  -d '{
    "jsonrpc": "2.0",
    "method": "tools/call",
    "params": {
      "name": "odoo_write",
      "arguments": {
        "model": "res.partner",
        "ids": [42],
        "values": {
          "phone": "+1234567890"
        }
      }
    },
    "id": 1
  }'
```

## 🧪 Development

### Build from Source
```bash
git clone https://github.com/heimerle/odoo-mcp-server.git
cd odoo-mcp-server
npm install
npm run build
```

### Development Mode
```bash
npm run dev      # Watch mode with auto-recompile
npm run lint     # Run ESLint
npm run test     # Run tests
```

### Project Structure
```
src/
├── http-mcp-server.ts      # Main HTTP/STDIO server
├── stdio-server.ts         # Dedicated STDIO entry point
├── models/
│   ├── odoo-client.ts     # Odoo API client
│   └── odoo-tools.ts      # MCP tool definitions
├── utils/
│   └── odoo-sanitizer.ts  # Response sanitization
└── types/
    └── index.ts           # TypeScript type definitions
```

## 📖 Documentation

- **[Quick Start Guide](./QUICK-START.md)** - Get started in 5 minutes
- **[Examples](./EXAMPLES.md)** - Detailed usage examples
- **[Transport Modes](./TRANSPORT-MODES.md)** - HTTP vs STDIO explained
- **[MCP Setup](./MCP-SETUP.md)** - Claude Desktop integration
- **[Testing Guide](./TESTING-GUIDE.md)** - How to test the server
- **[Changelog](./CHANGELOG.md)** - Version history

## 🐛 Troubleshooting

### STDIO Mode: "Not connected to Odoo"

Make sure you're using the correct environment variable names:
- Use `ODOO_DB` or `ODOO_DATABASE` (both work)
- All credentials must be provided for auto-login

### HTTP Mode: Port Already in Use

```bash
# Check what's using port 3001
lsof -i :3001

# Kill the process
pkill -f "node.*http-mcp-server"

# Or use a different port
MCP_HTTP_PORT=3002 node dist/http-mcp-server.js
```

### Connection Refused

Check that your Odoo instance is accessible:
```bash
curl http://your-odoo-instance:8069/web/database/selector
```

## 🤝 Contributing

Contributions are welcome! Please:

1. Fork the repository
2. Create a feature branch (`git checkout -b feature/amazing-feature`)
3. Commit your changes (`git commit -m 'Add amazing feature'`)
4. Push to the branch (`git push origin feature/amazing-feature`)
5. Open a Pull Request

## 📄 License

MIT License - see [LICENSE](./LICENSE) file for details.

## 🔗 Links

- **GitHub**: https://github.com/heimerle/odoo-mcp-server
- **NPM**: https://www.npmjs.com/package/@mweinheimer/odoo-mcp-server
- **Issues**: https://github.com/heimerle/odoo-mcp-server/issues

## 🙏 Acknowledgments

- Built with [Model Context Protocol](https://modelcontextprotocol.io/)
- Powered by [Odoo ERP](https://www.odoo.com/)
- TypeScript and Node.js

---

**Made with ❤️ for the Odoo and AI community**
