/**
 * Odoo MCP Tools
 * Complete set of tools for interacting with Odoo via MCP
 */

import { OdooApiClient } from './odoo-client.js';
import { McpTool, ToolHandler, McpToolResponse, OdooConfig } from '../types/index.js';
import { sanitizeOdooRecords, enforceSafeLimit } from '../utils/odoo-sanitizer.js';

export class OdooTools {
  private client: OdooApiClient | null = null;

  /**
   * Get all available Odoo tools
   */
  getTools(): { [key: string]: { definition: McpTool; handler: ToolHandler } } {
    return {
      odoo_ping: {
        definition: {
          name: 'odoo_ping',
          description: 'Quick health check - verifies Odoo connection without heavy payload',
          inputSchema: {
            type: 'object',
            properties: {},
          },
        },
        handler: this.handlePing.bind(this),
      },

      odoo_connect: {
        definition: {
          name: 'odoo_connect',
          description: 'Connect to an Odoo instance. Required before using other Odoo tools.',
          inputSchema: {
            type: 'object',
            properties: {
              url: {
                type: 'string',
                description: 'Odoo server URL (e.g., http://localhost:8069)',
              },
              database: {
                type: 'string',
                description: 'Database name',
              },
              username: {
                type: 'string',
                description: 'Username for authentication (not used by json2)',
              },
              password: {
                type: 'string',
                description: 'Password for authentication, or API key when transport=json2',
              },
              transport: {
                type: 'string',
                enum: ['jsonrpc', 'json2', 'xmlrpc', 'http'],
                description: 'Protocol (default: jsonrpc). Use json2 for Odoo 19+ external API.',
                default: 'jsonrpc',
              },
            },
            required: ['url', 'database', 'username', 'password'],
          },
        },
        handler: this.handleConnect.bind(this),
      },

      odoo_search_read: {
        definition: {
          name: 'odoo_search_read',
          description: 'Search and read records from Odoo model. Returns sanitized, safe payloads.',
          inputSchema: {
            type: 'object',
            properties: {
              model: {
                type: 'string',
                description: 'Model name (e.g., res.partner, sale.order)',
              },
              domain: {
                type: 'array',
                description: 'Search domain filters (e.g., [["is_company", "=", true]])',
                items: {
                  anyOf: [
                    { type: 'array', items: {} },
                    { type: 'string' },
                    { type: 'number' },
                    { type: 'boolean' },
                    { type: 'object' },
                    { type: 'null' }
                  ]
                },
                default: [],
              },
              fields: {
                type: 'array',
                items: { type: 'string' },
                description: 'Specific fields to retrieve (reduces payload size)',
                default: [],
              },
              limit: {
                type: 'integer',
                description: 'Maximum records to return (default: 10, max: 100) - Keep small for ChatGPT!',
                minimum: 1,
                maximum: 100,
                default: 10,
              },
              offset: {
                type: 'integer',
                description: 'Number of records to skip',
                minimum: 0,
                default: 0,
              },
              order: {
                type: 'string',
                description: 'Sort order (e.g., "name ASC")',
                default: 'id',
              },
            },
            required: ['model'],
          },
        },
        handler: this.handleSearchRead.bind(this),
      },

      odoo_create: {
        definition: {
          name: 'odoo_create',
          description: 'Create a new record in Odoo',
          inputSchema: {
            type: 'object',
            properties: {
              model: {
                type: 'string',
                description: 'Model name (e.g., res.partner, sale.order)',
              },
              values: {
                type: 'object',
                description: 'Field values for the new record',
              },
              context: {
                type: 'object',
                description: 'Additional context for the operation',
                default: {},
              },
            },
            required: ['model', 'values'],
          },
        },
        handler: this.handleCreate.bind(this),
      },

      odoo_update: {
        definition: {
          name: 'odoo_update',
          description: 'Update existing records in Odoo',
          inputSchema: {
            type: 'object',
            properties: {
              model: {
                type: 'string',
                description: 'Model name (e.g., res.partner, sale.order)',
              },
              ids: {
                type: 'array',
                items: { type: 'number' },
                description: 'Record IDs to update',
              },
              values: {
                type: 'object',
                description: 'Field values to update',
              },
              context: {
                type: 'object',
                description: 'Additional context for the operation',
                default: {},
              },
            },
            required: ['model', 'ids', 'values'],
          },
        },
        handler: this.handleUpdate.bind(this),
      },

      odoo_delete: {
        definition: {
          name: 'odoo_delete',
          description: 'Delete records from Odoo',
          inputSchema: {
            type: 'object',
            properties: {
              model: {
                type: 'string',
                description: 'Model name (e.g., res.partner, sale.order)',
              },
              ids: {
                type: 'array',
                items: { type: 'number' },
                description: 'Record IDs to delete',
              },
              context: {
                type: 'object',
                description: 'Additional context for the operation',
                default: {},
              },
            },
            required: ['model', 'ids'],
          },
        },
        handler: this.handleDelete.bind(this),
      },

      odoo_call_method: {
        definition: {
          name: 'odoo_call_method',
          description: 'Call a custom method on an Odoo model',
          inputSchema: {
            type: 'object',
            properties: {
              model: {
                type: 'string',
                description: 'Model name (e.g., res.partner, sale.order)',
              },
              method: {
                type: 'string',
                description: 'Method name to call',
              },
              args: {
                type: 'array',
                items: {
                  anyOf: [
                    { type: 'string' },
                    { type: 'number' },
                    { type: 'boolean' },
                    { type: 'object' },
                    { type: 'array', items: {} },
                    { type: 'null' }
                  ]
                },
                description: 'Positional arguments for the method',
                default: [],
              },
              kwargs: {
                type: 'object',
                description: 'Keyword arguments for the method',
                default: {},
              },
              context: {
                type: 'object',
                description: 'Additional context for the operation',
                default: {},
              },
            },
            required: ['model', 'method'],
          },
        },
        handler: this.handleCallMethod.bind(this),
      },

      odoo_get_model_fields: {
        definition: {
          name: 'odoo_get_model_fields',
          description: 'Get field definitions for an Odoo model',
          inputSchema: {
            type: 'object',
            properties: {
              model: {
                type: 'string',
                description: 'Model name (e.g., res.partner, sale.order)',
              },
            },
            required: ['model'],
          },
        },
        handler: this.handleGetModelFields.bind(this),
      },

      odoo_search: {
        definition: {
          name: 'odoo_search',
          description: 'Search for record IDs only',
          inputSchema: {
            type: 'object',
            properties: {
              model: {
                type: 'string',
                description: 'Model name (e.g., res.partner, sale.order)',
              },
              domain: {
                type: 'array',
                description: 'Search domain filters',
                items: {
                  anyOf: [
                    {
                      type: 'array',
                      minItems: 3,
                      maxItems: 3,
                      items: {
                        anyOf: [
                          { type: 'string', description: 'Field name/operator/value' },
                          { type: 'number' },
                          { type: 'boolean' },
                          { type: 'array', items: {} },
                          { type: 'null' }
                        ]
                      }
                    },
                    { type: 'string', description: 'Logical operator (&,|,!)' }
                  ]
                },
                default: [],
              },
              limit: {
                type: 'number',
                description: 'Maximum number of IDs to return',
              },
              offset: {
                type: 'number',
                description: 'Number of records to skip',
              },
            },
            required: ['model'],
          },
        },
        handler: this.handleSearch.bind(this),
      },

      odoo_read: {
        definition: {
          name: 'odoo_read',
          description: 'Read specific records by their IDs',
          inputSchema: {
            type: 'object',
            properties: {
              model: {
                type: 'string',
                description: 'Model name (e.g., res.partner, sale.order)',
              },
              ids: {
                type: 'array',
                items: { type: 'number' },
                description: 'Record IDs to read',
              },
              fields: {
                type: 'array',
                items: { type: 'string' },
                description: 'Fields to retrieve (all fields if empty)',
              },
            },
            required: ['model', 'ids'],
          },
        },
        handler: this.handleRead.bind(this),
      },

      odoo_version: {
        definition: {
          name: 'odoo_version',
          description: 'Get Odoo server version information',
          inputSchema: {
            type: 'object',
            properties: {},
          },
        },
        handler: this.handleVersion.bind(this),
      },

      odoo_list_databases: {
        definition: {
          name: 'odoo_list_databases',
          description: 'List available databases on the Odoo server',
          inputSchema: {
            type: 'object',
            properties: {},
          },
        },
        handler: this.handleListDatabases.bind(this),
      },
    };
  }

  /**
   * Canary health check - minimal payload, fast response
   */
  private async handlePing(): Promise<McpToolResponse> {
    if (!this.client) {
      return {
        content: [
          {
            type: 'text',
            text: JSON.stringify({ ok: false, error: 'Not connected to Odoo', hint: 'Use odoo_connect first' }),
          },
        ],
      };
    }

    try {
      // Just get Odoo version - minimal call
      const version = await this.client.version();
      return {
        content: [
          {
            type: 'text',
            text: JSON.stringify({ 
              ok: true, 
              connected: true, 
              server: version?.server_version || 'unknown',
              protocol: version?.protocol_version || 'unknown'
            }),
          },
        ],
      };
    } catch (error) {
      return {
        content: [
          {
            type: 'text',
            text: JSON.stringify({ 
              ok: false, 
              connected: false, 
              error: error instanceof Error ? error.message : 'Unknown error'
            }),
          },
        ],
      };
    }
  }

  private async handleConnect(args: any): Promise<McpToolResponse> {
    try {
      const config: OdooConfig = {
        url: args.url,
        database: args.database,
        username: args.username,
        password: args.password,
      };

      this.client = new OdooApiClient(config, args.transport || 'jsonrpc');
      const authResult = await this.client.authenticate();

      return {
        content: [
          {
            type: 'text',
            text: `Successfully connected to Odoo instance at ${args.url}\\nDatabase: ${args.database}\\nUser ID: ${authResult.uid}\\nTransport: ${args.transport || 'jsonrpc'}`,
          },
        ],
      };
    } catch (error) {
      return {
        content: [
          {
            type: 'text',
            text: `Connection failed: ${error instanceof Error ? error.message : 'Unknown error'}`,
          },
        ],
      };
    }
  }

  private async handleSearchRead(args: any): Promise<McpToolResponse> {
    if (!this.client) {
      return this.notConnectedResponse();
    }

    try {
      // Enforce safe limit
      const safeLimit = enforceSafeLimit(args.limit);
      
      const records = await this.client.searchRead(args.model, {
        domain: args.domain,
        fields: args.fields,
        limit: safeLimit,
        offset: args.offset || 0,
        order: args.order || 'id',
        context: args.context || {},
      });

      // Sanitize records: drop binary fields, normalize relations, apply limits
      const sanitized = sanitizeOdooRecords(records, {
        limit: safeLimit,
        fields: args.fields,
        dropBinary: true,
        normalizeRelations: true,
      });

      return {
        content: [
          {
            type: 'text',
            text: `Found ${sanitized.length} records in ${args.model}${sanitized.length !== records.length ? ` (sanitized from ${records.length})` : ''}:\\n${JSON.stringify(sanitized, null, 2)}`,
          },
        ],
      };
    } catch (error) {
      return this.errorResponse('Search/read operation failed', error);
    }
  }

  private async handleCreate(args: any): Promise<McpToolResponse> {
    if (!this.client) {
      return this.notConnectedResponse();
    }

    try {
      const recordId = await this.client.create({
        model: args.model,
        values: args.values,
        context: args.context,
      });

      return {
        content: [
          {
            type: 'text',
            text: `Successfully created record in ${args.model} with ID: ${recordId}`,
          },
        ],
      };
    } catch (error) {
      return this.errorResponse('Create operation failed', error);
    }
  }

  private async handleUpdate(args: any): Promise<McpToolResponse> {
    if (!this.client) {
      return this.notConnectedResponse();
    }

    try {
      const success = await this.client.update({
        model: args.model,
        ids: args.ids,
        values: args.values,
        context: args.context,
      });

      return {
        content: [
          {
            type: 'text',
            text: success 
              ? `Successfully updated ${args.ids.length} record(s) in ${args.model}`
              : `Update operation returned false for ${args.model}`,
          },
        ],
      };
    } catch (error) {
      return this.errorResponse('Update operation failed', error);
    }
  }

  private async handleDelete(args: any): Promise<McpToolResponse> {
    if (!this.client) {
      return this.notConnectedResponse();
    }

    try {
      const success = await this.client.delete({
        model: args.model,
        ids: args.ids,
        context: args.context,
      });

      return {
        content: [
          {
            type: 'text',
            text: success 
              ? `Successfully deleted ${args.ids.length} record(s) from ${args.model}`
              : `Delete operation returned false for ${args.model}`,
          },
        ],
      };
    } catch (error) {
      return this.errorResponse('Delete operation failed', error);
    }
  }

  private async handleCallMethod(args: any): Promise<McpToolResponse> {
    if (!this.client) {
      return this.notConnectedResponse();
    }

    try {
      const result = await this.client.call({
        model: args.model,
        method: args.method,
        args: args.args,
        kwargs: args.kwargs,
        context: args.context,
      });

      return {
        content: [
          {
            type: 'text',
            text: `Method ${args.method} on ${args.model} returned:\\n${JSON.stringify(result, null, 2)}`,
          },
        ],
      };
    } catch (error) {
      return this.errorResponse(`Method call ${args.method} failed`, error);
    }
  }

  private async handleGetModelFields(args: any): Promise<McpToolResponse> {
    if (!this.client) {
      return this.notConnectedResponse();
    }

    try {
      const fields = await this.client.getModelFields(args.model);

      return {
        content: [
          {
            type: 'text',
            text: `Model ${args.model} fields:\\n${JSON.stringify(fields, null, 2)}`,
          },
        ],
      };
    } catch (error) {
      return this.errorResponse(`Failed to get fields for model ${args.model}`, error);
    }
  }

  private async handleSearch(args: any): Promise<McpToolResponse> {
    if (!this.client) {
      return this.notConnectedResponse();
    }

    try {
      const ids = await this.client.search(
        args.model,
        args.domain,
        args.limit,
        args.offset
      );

      return {
        content: [
          {
            type: 'text',
            text: `Found ${ids.length} record IDs in ${args.model}: [${ids.join(', ')}]`,
          },
        ],
      };
    } catch (error) {
      return this.errorResponse('Search operation failed', error);
    }
  }

  private async handleRead(args: any): Promise<McpToolResponse> {
    if (!this.client) {
      return this.notConnectedResponse();
    }

    try {
      const records = await this.client.read(args.model, args.ids, args.fields);

      return {
        content: [
          {
            type: 'text',
            text: `Read ${records.length} records from ${args.model}:\\n${JSON.stringify(records, null, 2)}`,
          },
        ],
      };
    } catch (error) {
      return this.errorResponse('Read operation failed', error);
    }
  }

  private async handleVersion(): Promise<McpToolResponse> {
    if (!this.client) {
      return this.notConnectedResponse();
    }

    try {
      const version = await this.client.version();

      return {
        content: [
          {
            type: 'text',
            text: `Odoo server version:\\n${JSON.stringify(version, null, 2)}`,
          },
        ],
      };
    } catch (error) {
      return this.errorResponse('Failed to get version information', error);
    }
  }

  private async handleListDatabases(): Promise<McpToolResponse> {
    if (!this.client) {
      return this.notConnectedResponse();
    }

    try {
      const databases = await this.client.listDatabases();

      return {
        content: [
          {
            type: 'text',
            text: `Available databases: ${databases.join(', ')}`,
          },
        ],
      };
    } catch (error) {
      return this.errorResponse('Failed to list databases', error);
    }
  }

  private notConnectedResponse(): McpToolResponse {
    return {
      content: [
        {
          type: 'text',
          text: 'Not connected to Odoo. Please use odoo_connect first.',
        },
      ],
    };
  }

  private errorResponse(message: string, error: any): McpToolResponse {
    return {
      content: [
        {
          type: 'text',
          text: `${message}: ${error instanceof Error ? error.message : 'Unknown error'}`,
        },
      ],
    };
  }
}