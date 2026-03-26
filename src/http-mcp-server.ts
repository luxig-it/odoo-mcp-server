#!/usr/bin/env node

/**
 * Universal HTTP MCP Server
 * Provides MCP (Model Context Protocol) over HTTP instead of stdio
 * Compatible with any MCP client that supports HTTP transport
 */

import express from 'express';
import cors from 'cors';
import crypto from 'crypto';
import path from 'path';
import { McpServerController } from './controllers/index.js';
import { logServerEvent } from './views/index.js';

export class HttpMcpServer {
  private app: express.Application;
  private controller: McpServerController;
  private port: number;
  private sessions: Map<string, { state: any; createdAt: Date }>;

  constructor(port: number = 3001) {
    this.port = port;
    this.app = express();
    this.controller = new McpServerController();
    this.sessions = new Map();
    this.setupMiddleware();
    this.setupMcpRoutes();
    this.setupUtilityRoutes();
    
    // Auto-login if ENV credentials are provided (non-blocking)
    // This runs in the background and doesn't block server startup
    this.initializeAutoLogin().catch(error => {
      console.error('[AUTO-LOGIN] Background connection failed:', error.message);
    });
  }

  private async initializeAutoLogin(): Promise<void> {
    const { ODOO_URL, ODOO_DB, ODOO_DATABASE, ODOO_USERNAME, ODOO_PASSWORD, ODOO_TRANSPORT } = process.env;
    const database = ODOO_DB || ODOO_DATABASE; // Support both ODOO_DB and ODOO_DATABASE
    const transport = ODOO_TRANSPORT || 'jsonrpc';
    const requiresUsername = transport !== 'json2';
    
    if (ODOO_URL && database && ODOO_PASSWORD && (!requiresUsername || ODOO_USERNAME)) {
      try {
        logServerEvent('Auto-Login', { 
          url: ODOO_URL, 
          database: database, 
          username: ODOO_USERNAME || '(json2-api-key)',
          transport
        });
        
        await this.controller.handleToolCall('odoo_connect', {
          url: ODOO_URL,
          database: database,
          username: ODOO_USERNAME || 'json2-api-key',
          password: ODOO_PASSWORD,
          transport
        });
        
        logServerEvent('Auto-Login Success', { status: 'Connected to Odoo' });
      } catch (error) {
        logServerEvent('Auto-Login Failed', { 
          error: error instanceof Error ? error.message : 'Unknown error' 
        });
      }
    }
  }
  
  private generateSessionId(): string {
    return crypto.randomUUID();
  }

  private setupMiddleware(): void {
    this.app.use(cors({
      origin: '*',
      methods: ['GET', 'POST', 'DELETE', 'OPTIONS'],
      allowedHeaders: ['Content-Type', 'Authorization', 'X-MCP-Client', 'Mcp-Session-Id', 'MCP-Protocol-Version', 'Accept'],
      exposedHeaders: ['Mcp-Session-Id', 'MCP-Protocol-Version']
    }));
    
    this.app.use(express.json({ limit: '10mb' }));
    this.app.use(express.urlencoded({ extended: true }));
    
    // ChatGPT-optimized request timeout (25 seconds max)
    this.app.use((req, res, next) => {
      req.setTimeout(25000); // 25 seconds
      res.setTimeout(25000); // 25 seconds
      next();
    });
    
    // Authentication middleware (relaxed for ChatGPT compatibility)
    this.app.use((req, res, next) => {
      const authToken = process.env.MCP_AUTH_TOKEN;
      
      // For now, allow both authenticated and unauthenticated access
      // TODO: Implement proper ChatGPT auth method
      if (authToken && req.path.startsWith('/mcp')) {
        const authHeader = req.headers.authorization;
        const expectedToken = `Bearer ${authToken}`;
        
        // Log auth attempt but don't block
        if (!authHeader) {
          console.error(`[AUTH] Unauthenticated request to ${req.path} from ${req.headers['user-agent']}`);
        } else if (authHeader !== expectedToken) {
          console.error(`[AUTH] Invalid token: ${authHeader}`);
        }
        
        // Allow both authenticated and public access for now
      }
      
      next();
    });

    // MCP Client detection middleware
    this.app.use((req, res, next) => {
      const clientInfo = req.headers['x-mcp-client'] || req.headers['user-agent'] || 'unknown';
      const authStatus = req.headers.authorization ? 'authenticated' : 'public';
      logServerEvent('HTTP MCP Request', { 
        method: req.method, 
        url: req.url,
        client: clientInfo,
        ip: req.ip,
        auth: authStatus
      });
      next();
    });
  }

  private setupMcpRoutes(): void {
    // Root MCP endpoint for protocol discovery (GET)
    this.app.get('/mcp', (req, res) => {
      res.json({
        protocol: 'mcp',
        version: '2024-11-05',
        transport: 'http',
        server: {
          name: 'odoo-mcp-http-server',
          version: '1.0.0'
        },
        capabilities: {
          tools: true,
          batch: true,
          streaming: false
        },
        endpoints: {
          initialize: 'POST /mcp/initialize',
          tools: 'GET /mcp/tools',
          execute: 'POST /mcp/tools/:toolName',
          batch: 'POST /mcp/batch',
          jsonrpc: 'POST /mcp'
        }
      });
    });

    // MCP Protocol v2024-11-05 compliant endpoints
    
    // Initialize endpoint
    this.app.post('/mcp/initialize', async (req, res) => {
      try {
        const minimalMode = process.env.MCP_MINIMAL_MODE === 'true';
        const simplifySchema = process.env.MCP_SIMPLIFY_SCHEMA === 'true';
        const response = {
          protocolVersion: '2024-11-05',
          capabilities: {
            tools: {
              list: true,
              call: true,
              jsonSchema: true,
              batch: true
            }
          },
          serverInfo: {
            name: 'odoo-mcp-http-server',
            version: '1.0.0'
          },
          modes: { minimal: minimalMode, simplifiedSchema: simplifySchema }
        };
        res.set('X-MCP-Mode', `minimal=${minimalMode};simplify=${simplifySchema}`);
        res.json({
          success: true,
          result: response
        });
      } catch (error) {
        res.status(500).json({
          success: false,
          error: error instanceof Error ? error.message : 'Initialize failed'
        });
      }
    });

    // Tools list endpoint
    this.app.get('/mcp/tools', async (req, res) => {
      try {
        const tools = this.controller.getAvailableTools();
        const minimalMode = process.env.MCP_MINIMAL_MODE === 'true';
        const simplifySchema = process.env.MCP_SIMPLIFY_SCHEMA === 'true';
        const ua = req.headers['user-agent'] || '';
        const openaiClient = typeof ua === 'string' && ua.toLowerCase().includes('openai-mcp');
        let transformed = tools;
        console.error(`[MCP][DEBUG][REST] MCP_MINIMAL_MODE=${process.env.MCP_MINIMAL_MODE} MCP_SIMPLIFY_SCHEMA=${process.env.MCP_SIMPLIFY_SCHEMA}`);
        if (minimalMode || (openaiClient && process.env.MCP_MINIMAL_MODE_AUTO === 'true')) {
          transformed = transformed.filter(t => ['echo', 'odoo_version'].includes(t.name));
          console.error(`[MCP][DEBUG][REST] Minimal mode applied: ${transformed.map(t=>t.name).join(', ')}`);
        }
        if (simplifySchema || (openaiClient && process.env.MCP_SIMPLIFY_SCHEMA_AUTO === 'true')) {
          transformed = transformed.map(t => {
            if (!t.inputSchema) return t;
            const copy = { ...t, inputSchema: { ...t.inputSchema } } as any;
            if (copy.inputSchema.properties) {
              for (const [k, v] of Object.entries<any>(copy.inputSchema.properties)) {
                if (v && v.type === 'array' && v.items && v.items.anyOf) {
                  copy.inputSchema.properties[k] = {
                    type: 'array',
                    items: {
                      anyOf: [
                        { type: 'string' },
                        { type: 'number' },
                        { type: 'boolean' },
                        { type: 'array', items: {} },
                        { type: 'null' }
                      ]
                    },
                    description: v.description || 'Array'
                  };
                }
              }
            }
            return copy;
          });
          console.error(`[MCP][DEBUG][REST] Simplify schema applied.`);
        }
        res.set('X-MCP-Mode', `minimal=${minimalMode};simplify=${simplifySchema}`);
        console.error(`[MCP][DEBUG][REST] X-MCP-Mode header set: minimal=${minimalMode};simplify=${simplifySchema}`);
        console.error(`[MCP][DEBUG] REST tools list served ${transformed.length} tools (minimal=${minimalMode} simplify=${simplifySchema})`);
        res.json({
          success: true,
          tools: transformed
        });
      } catch (error) {
        res.status(500).json({
          success: false,
          error: error instanceof Error ? error.message : 'Failed to list tools'
        });
      }
    });

    // Tool execution endpoint
    this.app.post('/mcp/tools/:toolName', async (req, res) => {
      try {
        const { toolName } = req.params;
        const args = req.body;

        const result = await this.controller.handleToolCall(toolName, args);
        
        res.json({
          success: true,
          result: result
        });
      } catch (error) {
        res.status(400).json({
          success: false,
          error: error instanceof Error ? error.message : 'Tool execution failed'
        });
      }
    });

    // MCP Streamable HTTP Transport endpoint
    this.app.post('/mcp', async (req, res) => {
      try {
        const protocolVersion = req.header('MCP-Protocol-Version') || '2024-11-05';
        const isInitialize = req.body?.method === 'initialize';
        
        // Handle initialize: create session and return session ID in header
        if (isInitialize) {
          const sessionId = this.generateSessionId();
          this.sessions.set(sessionId, { state: {}, createdAt: new Date() });
          
          console.error(`[MCP] Initialize: Created session ${sessionId}`);
          
          res.setHeader('Mcp-Session-Id', sessionId);
          res.setHeader('MCP-Protocol-Version', protocolVersion);
          res.setHeader('Content-Type', 'application/json');
          
          const request = { ...req.body, headers: req.headers };
          const response = await this.processJsonRpcRequest(request);
          
          return res.status(200).json(response);
        }
        
        // Session management: Optional if auto-login is enabled (ChatGPT compatibility)
        const sessionId = req.header('Mcp-Session-Id');
        const autoTransport = process.env.ODOO_TRANSPORT || 'jsonrpc';
        const hasAutoLogin = !!(
          process.env.ODOO_URL &&
          (process.env.ODOO_DB || process.env.ODOO_DATABASE) &&
          process.env.ODOO_PASSWORD &&
          (autoTransport === 'json2' || process.env.ODOO_USERNAME)
        );
        
        if (!hasAutoLogin && (!sessionId || !this.sessions.has(sessionId))) {
          // Strict session required only if no auto-login
          console.error(`[MCP] Invalid/missing session ID: ${sessionId}`);
          return res.status(400).json({
            jsonrpc: '2.0',
            error: {
              code: -32000,
              message: 'Missing or invalid Mcp-Session-Id header (no auto-login configured)'
            },
            id: req.body?.id || null
          });
        }
        
        if (hasAutoLogin && !sessionId) {
          console.error(`[MCP] Session-less request allowed (auto-login active)`);
        }
        
        console.error(`[MCP] Request with session ${sessionId}: ${req.body?.method}`);
        
        res.setHeader('MCP-Protocol-Version', protocolVersion);
        
        const request = { ...req.body, headers: req.headers, sessionId };
        const response = await this.processJsonRpcRequest(request);
        
        // Log debug info for tools/list
        if (req.body?.method === 'tools/list') {
          const minimalMode = process.env.MCP_MINIMAL_MODE;
          const simplifySchema = process.env.MCP_SIMPLIFY_SCHEMA;
          console.error(`[MCP][DEBUG][JSON-RPC] MCP_MINIMAL_MODE=${minimalMode} MCP_SIMPLIFY_SCHEMA=${simplifySchema}`);
          if (response?.result?.tools) {
            console.error(`[MCP][DEBUG][JSON-RPC] tools returned: ${response.result.tools.map((t: any)=>t.name).join(', ')}`);
          }
          res.set('X-MCP-Mode', `minimal=${minimalMode};simplify=${simplifySchema}`);
        }
        
        res.setHeader('Content-Type', 'application/json');
        res.json(response);
      } catch (error) {
        res.status(400).json({
          jsonrpc: '2.0',
          error: {
            code: -32700,
            message: 'Parse error',
            data: error instanceof Error ? error.message : 'Unknown error'
          },
          id: null
        });
      }
    });
    
    // Optional GET endpoint for SSE stream (server-initiated messages)
    this.app.get('/mcp', (req, res) => {
      const sessionId = req.header('Mcp-Session-Id');
      if (!sessionId || !this.sessions.has(sessionId)) {
        return res.status(400).send('Missing or invalid Mcp-Session-Id header');
      }
      
      console.error(`[MCP] SSE stream opened for session ${sessionId}`);
      
      res.setHeader('Content-Type', 'text/event-stream');
      res.setHeader('Cache-Control', 'no-cache');
      res.setHeader('Connection', 'keep-alive');
      res.flushHeaders();
      
      // Keep connection alive, send heartbeat every 30s
      const heartbeat = setInterval(() => {
        res.write(': heartbeat\n\n');
      }, 30000);
      
      req.on('close', () => {
        clearInterval(heartbeat);
        console.error(`[MCP] SSE stream closed for session ${sessionId}`);
      });
    });
    
    // DELETE endpoint to terminate session
    this.app.delete('/mcp', (req, res) => {
      const sessionId = req.header('Mcp-Session-Id');
      if (!sessionId || !this.sessions.has(sessionId)) {
        return res.status(404).json({
          error: 'Session not found'
        });
      }
      
      this.sessions.delete(sessionId);
      console.error(`[MCP] Session ${sessionId} terminated`);
      
      res.status(204).send();
    });

    // Batch tool execution
    this.app.post('/mcp/batch', async (req, res) => {
      try {
        const { tools } = req.body;
        
        if (!Array.isArray(tools)) {
          return res.status(400).json({
            success: false,
            error: 'Expected array of tools'
          });
        }

        const results = await Promise.allSettled(
          tools.map(async ({ name, args }) => {
            return await this.controller.handleToolCall(name, args || {});
          })
        );

        const responses = results.map((result, index) => ({
          tool: tools[index].name,
          success: result.status === 'fulfilled',
          result: result.status === 'fulfilled' ? result.value : undefined,
          error: result.status === 'rejected' ? result.reason.message : undefined
        }));

        res.json({
          success: true,
          results: responses
        });
      } catch (error) {
        res.status(400).json({
          success: false,
          error: error instanceof Error ? error.message : 'Batch execution failed'
        });
      }
    });
  }

  private setupUtilityRoutes(): void {
    // Health check endpoint
    this.app.get('/health', (req, res) => {
      res.json({ 
        status: 'healthy', 
        protocol: 'mcp-http',
        version: '2024-11-05',
        timestamp: new Date().toISOString(),
        server: 'odoo-mcp-http-server'
      });
    });

    // Server info endpoint
    this.app.get('/info', (req, res) => {
      res.json({
        name: 'Odoo MCP HTTP Server',
        version: '1.0.0',
        protocol: {
          name: 'MCP',
          version: '2024-11-05',
          transport: 'HTTP'
        },
        capabilities: {
          tools: true,
          batch: true,
          streaming: false
        },
        endpoints: {
          'POST /mcp/initialize': 'Initialize MCP session',
          'GET /mcp/tools': 'List available tools',
          'POST /mcp/tools/:name': 'Execute specific tool',
          'POST /mcp': 'JSON-RPC 2.0 endpoint',
          'POST /mcp/batch': 'Execute multiple tools',
          'GET /health': 'Health check',
          'GET /info': 'Server information',
          'GET /docs': 'API documentation'
        }
      });
    });

    // API Documentation endpoint
    this.app.get('/docs', (req, res) => {
      res.json({
        title: 'Odoo MCP HTTP Server API Documentation',
        version: '1.0.0',
        protocol: 'MCP over HTTP',
        baseUrl: `http://localhost:${this.port}`,
        
        endpoints: {
          initialization: {
            'POST /mcp/initialize': {
              description: 'Initialize MCP session',
              request: {},
              response: {
                protocolVersion: '2024-11-05',
                capabilities: { tools: {} },
                serverInfo: { name: 'string', version: 'string' }
              }
            }
          },
          
          tools: {
            'GET /mcp/tools': {
              description: 'List all available tools',
              response: {
                success: true,
                tools: [{ name: 'string', description: 'string', inputSchema: {} }]
              }
            },
            
            'POST /mcp/tools/:toolName': {
              description: 'Execute a specific tool',
              parameters: { toolName: 'Tool name from tools list' },
              request: { /* tool-specific arguments */ },
              response: {
                success: true,
                result: { content: [{ type: 'text', text: 'string' }] }
              }
            }
          },
          
          batch: {
            'POST /mcp/batch': {
              description: 'Execute multiple tools in parallel',
              request: {
                tools: [
                  { name: 'tool1', args: {} },
                  { name: 'tool2', args: {} }
                ]
              },
              response: {
                success: true,
                results: [
                  { tool: 'tool1', success: true, result: {} },
                  { tool: 'tool2', success: false, error: 'string' }
                ]
              }
            }
          }
        },
        
        examples: {
          'Connect to Odoo': {
            method: 'POST',
            url: '/mcp/tools/odoo_connect',
            headers: { 'Content-Type': 'application/json' },
            body: {
              url: 'http://localhost:8069',
              database: 'odoo',
              username: 'admin',
              password: 'admin',
              transport: 'jsonrpc'
            }
          },
          
          'Search Partners': {
            method: 'POST', 
            url: '/mcp/tools/odoo_search_read',
            body: {
              model: 'res.partner',
              domain: [['is_company', '=', true]],
              fields: ['name', 'email', 'phone'],
              limit: 10
            }
          },
          
          'Batch Operations': {
            method: 'POST',
            url: '/mcp/batch',
            body: {
              tools: [
                {
                  name: 'odoo_search',
                  args: { model: 'res.partner', limit: 5 }
                },
                {
                  name: 'echo',
                  args: { message: 'Hello World' }
                }
              ]
            }
          }
        }
      });
    });

    // 404 handler
    this.app.use('*', (req, res) => {
      res.status(404).json({
        success: false,
        error: 'Endpoint not found',
        available_endpoints: {
          mcp: [
            'POST /mcp/initialize',
            'GET /mcp/tools', 
            'POST /mcp/tools/:toolName',
            'POST /mcp',
            'POST /mcp/batch'
          ],
          utilities: [
            'GET /health',
            'GET /info',
            'GET /docs'
          ]
        }
      });
    });
  }

  private async processJsonRpcRequest(request: any): Promise<any> {
    const { method, params, id } = request;
    const minimalMode = process.env.MCP_MINIMAL_MODE === 'true';
    const simplifySchema = process.env.MCP_SIMPLIFY_SCHEMA === 'true';

    try {
      switch (method) {
        case 'initialize': {
          const capabilities = {
            tools: {
              list: true,
              call: true,
              jsonSchema: true,
              batch: true
            },
            batch: true
          };
          return {
            jsonrpc: '2.0',
            result: {
              protocolVersion: '2024-11-05',
              capabilities,
              serverInfo: { name: 'odoo-mcp-http-server', version: '1.0.0' },
              modes: { minimal: minimalMode, simplifiedSchema: simplifySchema }
            },
            id
          };
        }

        case 'tools/list': {
          try {
            const tools = this.controller.getAvailableTools();
            const ua = (request?.headers?.['user-agent']) || ''; // may not exist depending on caller context
            const openaiClient = typeof ua === 'string' && ua.toLowerCase().includes('openai-mcp');
            let transformed = tools;

            // Apply minimal mode (environment flag or auto if openai-mcp and env auto flag maybe later)
            if (minimalMode || (openaiClient && process.env.MCP_MINIMAL_MODE_AUTO === 'true')) {
              transformed = tools.filter(t => ['echo', 'odoo_version'].includes(t.name));
            }

            // Simplify schemas if requested
            if (simplifySchema || (openaiClient && process.env.MCP_SIMPLIFY_SCHEMA_AUTO === 'true')) {
              transformed = transformed.map(t => {
                if (!t.inputSchema) return t;
                const copy = { ...t, inputSchema: { ...t.inputSchema } } as any;
                // Strip complex anyOf constructs for domain arrays
                if (copy.inputSchema.properties) {
                  for (const [k, v] of Object.entries<any>(copy.inputSchema.properties)) {
                    if (v && v.type === 'array' && v.items && v.items.anyOf) {
                      copy.inputSchema.properties[k] = {
                        type: 'array',
                        items: {
                          anyOf: [
                            { type: 'string' },
                            { type: 'number' },
                            { type: 'boolean' },
                            { type: 'array', items: {} },
                            { type: 'null' }
                          ]
                        },
                        description: v.description || 'Array'
                      };
                    }
                  }
                }
                return copy;
              });
            }
            if (typeof ua === 'string' && ua.toLowerCase().includes('chatgpt')) {
              console.error(`[MCP][DEBUG] ChatGPT tools/list requested. Returning ${transformed.length} tools. minimal=${minimalMode} simplify=${simplifySchema}`);
            } else if (openaiClient) {
              console.error(`[MCP][DEBUG] openai-mcp tools/list requested. Returning ${transformed.length} tools. minimal=${minimalMode} simplify=${simplifySchema}`);
            }
            return {
              jsonrpc: '2.0',
              result: { tools: transformed },
              id
            };
          } catch (err) {
            console.error('[MCP] tools/list error', err);
            return {
              jsonrpc: '2.0',
              error: { code: -32001, message: 'Failed to list tools' },
              id
            };
          }
        }

        case 'tools/call': {
          const toolName = params?.name;
          const toolArgs = params?.arguments || {};
          
          if (!toolName) {
            throw new Error('Tool name is required');
          }

          const result = await this.controller.handleToolCall(toolName, toolArgs);
          
          // ChatGPT-Safety: Check response size
          const responseJson = JSON.stringify({ jsonrpc: '2.0', result, id });
          const sizeKB = Buffer.byteLength(responseJson, 'utf8') / 1024;
          
          if (sizeKB > 95) { // ChatGPT has ~100KB limit
            console.error(`[CHATGPT-WARNING] Response too large: ${sizeKB.toFixed(1)}KB for tool ${toolName}`);
            return {
              jsonrpc: '2.0',
              error: {
                code: -32000,
                message: `Response too large (${sizeKB.toFixed(1)}KB). Try reducing 'limit' parameter or selecting fewer fields.`
              },
              id
            };
          }
          
          console.error(`[TOOL-CALL] ${toolName} → ${sizeKB.toFixed(1)}KB response`);
          return {
            jsonrpc: '2.0',
            result,
            id
          };
        }

        default:
          return {
            jsonrpc: '2.0',
            error: {
              code: -32601,
              message: `Method not found: ${method}`
            },
            id
          };
      }
    } catch (error) {
      return {
        jsonrpc: '2.0',
        error: {
          code: -32000,
          message: error instanceof Error ? error.message : 'Unknown error'
        },
        id
      };
    }
  }

  start(): Promise<void> {
    return new Promise((resolve) => {
      this.app.listen(this.port, () => {
        logServerEvent(`HTTP MCP Server started on port ${this.port}`);
        console.error(`🌍 Odoo MCP HTTP Server running at http://localhost:${this.port}`);
        console.error(`📚 API Documentation: http://localhost:${this.port}/docs`);
        console.error(`🏥 Health Check: http://localhost:${this.port}/health`);
        console.error(`🔧 Server Info: http://localhost:${this.port}/info`);
        resolve();
      });
    });
  }

  /**
   * Start STDIO transport mode
   * Reads JSON-RPC requests from stdin and writes responses to stdout
   */
  async startStdio(): Promise<void> {
    console.error('🔌 Starting MCP Server in STDIO mode');
    console.error('📡 Reading JSON-RPC from stdin, writing to stdout');
    
    const readline = await import('readline');
    const rl = readline.createInterface({
      input: process.stdin,
      output: process.stdout,
      terminal: false
    });

    rl.on('line', async (line) => {
      try {
        const request = JSON.parse(line);
        const response = await this.processJsonRpcRequest(request);
        
        // Write response to stdout (pure protocol, no extra logging)
        process.stdout.write(JSON.stringify(response) + '\n');
      } catch (error) {
        // Log errors to stderr only
        console.error('[MCP STDIO] Parse error:', error);
        
        // Send error response to stdout
        const errorResponse = {
          jsonrpc: '2.0',
          error: {
            code: -32700,
            message: 'Parse error',
            data: error instanceof Error ? error.message : 'Unknown error'
          },
          id: null
        };
        process.stdout.write(JSON.stringify(errorResponse) + '\n');
      }
    });

    rl.on('close', () => {
      console.error('[MCP STDIO] Input stream closed');
      process.exit(0);
    });

    // Keep process alive
    return new Promise(() => {});
  }
}

// Start server if called directly (not when imported as module)
// This check ensures the server only auto-starts when running `node dist/http-mcp-server.js`
// and NOT when imported by stdio-server.js or other modules
const runtimeFlags = globalThis as typeof globalThis & {
  __ODOO_MCP_SUPPRESS_AUTO_START__?: boolean;
};
const entryScript = process.argv[1] ? path.resolve(process.argv[1]) : null;
const isHttpEntrypoint = !!entryScript
  && /^http-mcp-server\.(?:js|cjs|mjs)$/i.test(path.basename(entryScript));
const isDirectCall = !!entryScript
  && !runtimeFlags.__ODOO_MCP_SUPPRESS_AUTO_START__
  && isHttpEntrypoint;

if (isDirectCall) {
  const mode = process.env.MCP_TRANSPORT || 'http';
  const port = process.env.MCP_HTTP_PORT ? parseInt(process.env.MCP_HTTP_PORT) : 3001;
  const server = new HttpMcpServer(port);
  
  // Handle graceful shutdown
  process.on('SIGINT', () => {
    logServerEvent('Received SIGINT, shutting down MCP server gracefully');
    process.exit(0);
  });

  process.on('SIGTERM', () => {
    logServerEvent('Received SIGTERM, shutting down MCP server gracefully');
    process.exit(0);
  });

  if (mode === 'stdio') {
    console.error('🔌 MCP_TRANSPORT=stdio - Starting in STDIO mode');
    server.startStdio().catch(error => {
      console.error('Failed to start MCP server in STDIO mode:', error);
      process.exit(1);
    });
  } else {
    console.error('🌐 MCP_TRANSPORT=http - Starting in HTTP mode');
    server.start().catch(error => {
      logServerEvent('Failed to start HTTP MCP server', error);
      process.exit(1);
    });
  }
}