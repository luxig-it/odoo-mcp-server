/**
 * MCP Server Types and Interfaces
 */

export interface McpTool {
  name: string;
  description: string;
  inputSchema: {
    type: 'object';
    properties: Record<string, any>;
    required?: string[];
  };
}

export interface McpToolCall {
  name: string;
  arguments: Record<string, any>;
}

export interface McpToolResponse {
  content: Array<{
    type: 'text' | 'image';
    text?: string;
    data?: string;
    mimeType?: string;
  }>;
}

export interface ServerConfig {
  name: string;
  version: string;
  capabilities: {
    tools?: Record<string, any>;
    resources?: Record<string, any>;
    prompts?: Record<string, any>;
  };
}

export type ToolHandler = (args: Record<string, any>) => Promise<McpToolResponse>;

/**
 * Odoo API Types and Interfaces
 */

export interface OdooConfig {
  url: string;
  database: string;
  username: string;
  password: string;
}

export interface OdooAuthResult {
  uid: number;
  session_id?: string;
}

export interface OdooRecord {
  id: number;
  [key: string]: any;
}

export interface OdooSearchParams {
  domain?: Array<any>;
  fields?: string[];
  offset?: number;
  limit?: number;
  order?: string;
  context?: Record<string, any>;
}

export interface OdooCreateParams {
  model: string;
  values: Record<string, any>;
  context?: Record<string, any>;
}

export interface OdooUpdateParams {
  model: string;
  ids: number[];
  values: Record<string, any>;
  context?: Record<string, any>;
}

export interface OdooDeleteParams {
  model: string;
  ids: number[];
  context?: Record<string, any>;
}

export interface OdooCallParams {
  model: string;
  method: string;
  args?: any[];
  kwargs?: Record<string, any>;
  context?: Record<string, any>;
}

export interface OdooRpcRequest {
  service: string;
  method: string;
  args: any[];
}

export interface OdooRpcResponse {
  result?: any;
  error?: {
    code: number;
    message: string;
    data?: any;
  };
}

export interface OdooModel {
  name: string;
  fields: Record<string, OdooField>;
  methods: string[];
}

export interface OdooField {
  type: string;
  string: string;
  required?: boolean;
  readonly?: boolean;
  help?: string;
  relation?: string;
  domain?: any[];
  selection?: Array<[any, string]>;
}

export type OdooTransport = 'xmlrpc' | 'jsonrpc' | 'json2' | 'http';