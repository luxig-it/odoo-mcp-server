# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [1.1.0] - 2026-03-01
- Provide support for JSON2 Transport Mode
- Add new environment variable `ODOO_API_KEY` for API key authentication

## [1.0.1] - 2025-10-12

### Changed
- **Package Name**: Published as `@mweinheimer/odoo-mcp-server` (scoped package)
- **Documentation**: Complete rewrite of README.md with clearer structure
- **Repository**: Updated all GitHub links to `heimerle/odoo-mcp-server`
- **Project Cleanup**: Removed temporary files, backups, and unused development files

### Fixed
- **STDIO Mode**: Fixed auto-start conflict when importing `http-mcp-server.js` as module
- **Auto-Login**: Fixed environment variable handling - now supports both `ODOO_DB` and `ODOO_DATABASE`
- **Claude Desktop Integration**: Added dedicated `stdio-server.js` entry point for seamless integration
- **Module Detection**: Improved direct-call detection to prevent HTTP server auto-start when imported
- **ESLint**: Fixed escape character and unused parameter warnings

### Added
- Dedicated STDIO entry point (`dist/stdio-server.js`) for desktop MCP clients
- Support for both `ODOO_DB` and `ODOO_DATABASE` environment variables
- Better logging and error messages for connection issues
- Comprehensive documentation with usage examples

## [1.0.0] - 2025-10-12

### Fixed
- **STDIO Mode**: Fixed auto-start conflict when importing `http-mcp-server.js` as module
- **Auto-Login**: Fixed environment variable handling - now supports both `ODOO_DB` and `ODOO_DATABASE`
- **Claude Desktop Integration**: Added dedicated `stdio-server.js` entry point for seamless Claude Desktop integration
- **Module Detection**: Improved direct-call detection to prevent HTTP server auto-start when imported

### Added
- Dedicated STDIO entry point (`dist/stdio-server.js`) for desktop MCP clients
- Support for both `ODOO_DB` and `ODOO_DATABASE` environment variables
- Better logging and error messages for connection issues

### Changed
- Improved module architecture for better separation of HTTP and STDIO modes
- Enhanced documentation for Claude Desktop setup

## [1.0.0] - 2025-10-10

### Added
- Complete Odoo API implementation with MCP (Model Context Protocol) support
- Multi-transport support: XML-RPC, JSON-RPC, and HTTP
- Comprehensive CRUD operations for all Odoo models
- 11 specialized MCP tools for Odoo operations:
  - `odoo_connect` - Connect to Odoo instance with multiple transport options
  - `odoo_search_read` - Advanced search and read with domain filtering
  - `odoo_create` - Create new records in any Odoo model
  - `odoo_update` - Update existing records
  - `odoo_delete` - Delete records from Odoo models
  - `odoo_call_method` - Execute custom methods on Odoo models
  - `odoo_get_model_fields` - Get field definitions for model introspection
  - `odoo_search` - Search for record IDs with domain filtering
  - `odoo_read` - Read specific records by their IDs
  - `odoo_version` - Get Odoo server version information
  - `odoo_list_databases` - List available databases on server
- Dual communication modes:
  - Stdio mode for standard MCP protocol communication
  - HTTP mode with RESTful API endpoints
- TypeScript implementation with full type safety
- Comprehensive error handling and logging
- Built-in API documentation at `/docs` endpoint
- Express HTTP server with CORS support
- Jest testing framework setup
- ESLint configuration for code quality
- Development tools with watch mode and auto-restart

### Technical Features
- Modern ES modules with TypeScript compilation
- Axios-based HTTP client with timeout handling
- XML-RPC client for legacy Odoo versions
- Session management and authentication
- Tool registry system for extensibility
- Comprehensive TypeScript type definitions
- Source maps for debugging
- Production-ready build system

### Documentation
- Complete README with usage examples
- API documentation with curl examples
- Copilot instructions for development guidelines
- Comprehensive JSDoc comments
- Type definitions for all interfaces

## [Unreleased]

### Planned
- WebSocket support for real-time communication
- Odoo model caching for improved performance
- Plugin system for custom tool extensions
- Prometheus metrics integration
- Docker container support
- CLI tool for easy setup and configuration