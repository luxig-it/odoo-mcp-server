#!/usr/bin/env node
/**
 * Odoo MCP Server - STDIO Entry Point
 * Starts the MCP server in STDIO mode for Claude Desktop integration
 */

export {};

const runtimeFlags = globalThis as typeof globalThis & {
  __ODOO_MCP_SUPPRESS_AUTO_START__?: boolean;
};

async function main(): Promise<void> {
  runtimeFlags.__ODOO_MCP_SUPPRESS_AUTO_START__ = true;

  const { HttpMcpServer } = await import('./http-mcp-server.js');

  // Create and start server
  const server = new HttpMcpServer();

  // Start STDIO mode (uses stdin/stdout for MCP protocol)
  await server.startStdio();
}

// Graceful shutdown
process.on('SIGINT', () => {
  console.error('[SHUTDOWN] Received SIGINT, shutting down gracefully');
  process.exit(0);
});

process.on('SIGTERM', () => {
  console.error('[SHUTDOWN] Received SIGTERM, shutting down gracefully');
  process.exit(0);
});

main().catch(error => {
  console.error('[FATAL] Failed to start Odoo MCP Server in STDIO mode:', error);
  process.exit(1);
});
