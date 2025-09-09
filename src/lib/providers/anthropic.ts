import util from '@/lib/util.ts';

type OAIRole = 'system' | 'user' | 'assistant' | 'tool' | 'function';

type OpenAIMessage = {
  role: OAIRole;
  content?: string | Array<{ type: 'text'; text: string }> | null;
  name?: string;
  tool_call_id?: string;
  tool_calls?: Array<{
    id?: string;
    type: 'function';
    function: { name: string; arguments: string };
  }>;
};

type OpenAITool = {
  type: 'function';
  function: {
    name: string;
    description?: string;
    parameters?: Record<string, unknown>;
  };
};

type OpenAIChatCreate = {
  model: string;
  messages: OpenAIMessage[];
  tools?: OpenAITool[];
  tool_choice?: 'none' | 'auto' | { type: 'function'; function: { name: string } };
  temperature?: number;
  top_p?: number;
  max_tokens?: number;
  stream?: boolean;
};

// Anthropic types (minimal)
type AnthropicTool = { name: string; description?: string; input_schema?: Record<string, unknown> };
type AnthropicMessage = {
  role: 'user' | 'assistant' | 'system';
  content: Array<
    | { type: 'text'; text: string }
    | { type: 'tool_use'; id: string; name: string; input: unknown }
    | { type: 'tool_result'; tool_use_id: string; content: string }
  >;
};

type AnthropicCreate = {
  model: string;
  messages: AnthropicMessage[];
  tools?: AnthropicTool[];
  temperature?: number;
  top_p?: number;
  max_tokens?: number;
  stream?: boolean;
};

export function isClaudeModel(model: string): boolean {
  const m = (model || '').toLowerCase();
  return m.startsWith('claude');
}

function textContentOf(content: OpenAIMessage['content']): string {
  if (typeof content === 'string') return content;
  if (Array.isArray(content)) return content.map((c) => (typeof c === 'string' ? c : c.text || '')).join('\n');
  return '';
}

export function mapOpenAIToAnthropic(payload: OpenAIChatCreate): AnthropicCreate {
  const toolUseIdMap = new Map<string, string>();

  const messages: AnthropicMessage[] = [];
  for (let i = 0; i < payload.messages.length; i++) {
    const m = payload.messages[i];
    if (m.role === 'system') {
      messages.push({ role: 'system', content: [{ type: 'text', text: textContentOf(m.content) }] });
      continue;
    }

    if (m.role === 'assistant') {
      // If assistant has tool_calls, convert to tool_use blocks
      const content: AnthropicMessage['content'] = [];
      const text = textContentOf(m.content);
      if (text) content.push({ type: 'text', text });
      if (Array.isArray(m.tool_calls) && m.tool_calls.length > 0) {
        for (const tc of m.tool_calls) {
          const anthropicId = `toolu_${util.uuid(false)}`;
          if (tc.id) toolUseIdMap.set(tc.id, anthropicId);
          let input: unknown = {};
          try { input = JSON.parse(tc.function.arguments || '{}'); } catch { input = tc.function.arguments || {}; }
          content.push({ type: 'tool_use', id: anthropicId, name: tc.function.name, input });
        }
      }
      messages.push({ role: 'assistant', content });
      continue;
    }

    if (m.role === 'tool') {
      const content: AnthropicMessage['content'] = [];
      const mappedId = m.tool_call_id ? (toolUseIdMap.get(m.tool_call_id) || m.tool_call_id) : `toolu_${util.uuid(false)}`;
      const text = textContentOf(m.content);
      content.push({ type: 'tool_result', tool_use_id: mappedId, content: text });
      // Tool results are provided as a user message in Anthropic
      messages.push({ role: 'user', content });
      continue;
    }

    // user/function -> user text
    messages.push({ role: 'user', content: [{ type: 'text', text: textContentOf(m.content) }] });
  }

  const tools: AnthropicTool[] | undefined = Array.isArray(payload.tools)
    ? payload.tools
        .filter((t) => t?.type === 'function' && t.function?.name)
        .map((t) => ({ name: t.function.name, description: t.function.description, input_schema: t.function.parameters || {} }))
    : undefined;

  return {
    model: payload.model,
    messages,
    tools,
    temperature: payload.temperature,
    top_p: payload.top_p,
    max_tokens: payload.max_tokens,
    stream: payload.stream,
  };
}

export async function anthropicChatCreate(
  baseUrl: string,
  apiKey: string,
  body: AnthropicCreate,
  requestId?: string
): Promise<Response> {
  const url = `${baseUrl.replace(/\/$/, '')}/v1/messages`;
  const headers: HeadersInit = {
    'content-type': 'application/json',
    'x-api-key': apiKey,
    'anthropic-version': '2023-06-01',
    ...(requestId ? { 'x-request-id': requestId } : {}),
  };
  const resp = await fetch(url, { method: 'POST', headers, body: JSON.stringify(body) });
  return resp;
}

// Streaming (SSE) → maps Anthropic events to OpenAI Chat Completions chunks
import { PassThrough } from 'stream';
import axios from 'axios';
import { createParser } from 'eventsource-parser';

type SSEvent = { type: string } & Record<string, any>;

function writeSSE(stream: PassThrough, obj: Record<string, unknown>) {
  stream.write(`data: ${JSON.stringify(obj)}\n\n`);
}

export async function anthropicChatCreateStream(
  baseUrl: string,
  apiKey: string,
  body: AnthropicCreate,
  model: string,
  requestId?: string
): Promise<PassThrough> {
  const url = `${baseUrl.replace(/\/$/, '')}/v1/messages`;
  const headers = {
    'content-type': 'application/json',
    'x-api-key': apiKey,
    'anthropic-version': '2023-06-01',
    Accept: 'text/event-stream',
    ...(requestId ? { 'x-request-id': requestId } : {}),
  };

  const resp = await axios.post(url, { ...body, stream: true }, { responseType: 'stream', headers, validateStatus: () => true });
  if (resp.status >= 400) {
    const pt = new PassThrough();
    const msg = `Anthropic upstream error ${resp.status}: ${resp.statusText}`;
    writeSSE(pt, {
      id: `chatcmpl-${util.uuid(false)}`,
      object: 'chat.completion.chunk',
      created: util.unixTimestamp(),
      model,
      choices: [{ index: 0, delta: { content: `Error: ${msg}` }, finish_reason: null, logprobs: null }],
    });
    pt.write(`data: [DONE]\n\n`);
    pt.end();
    return pt;
  }

  const source = resp.data as NodeJS.ReadableStream;
  const out = new PassThrough();
  const created = util.unixTimestamp();
  const id = `chatcmpl-${util.uuid(false)}`;

  // Emit initial role delta for better client compatibility
  writeSSE(out, {
    id,
    object: 'chat.completion.chunk',
    created,
    model,
    choices: [{ index: 0, delta: { role: 'assistant' }, finish_reason: null, logprobs: null }],
  });

  // State for tool calls
  const toolIndexByContentIndex = new Map<number, number>();
  const toolArgBufferByToolIndex = new Map<number, string>();
  let toolCount = 0;
  let sawToolUse = false;
  let stopReason: string | null = null;

  const parser = createParser((evt) => {
    if (evt.event !== 'event') return;
    if (!evt.data) return;
    let data: SSEvent | null = null;
    try { data = JSON.parse(evt.data) as SSEvent; } catch { return; }
    const t = data?.type;
    if (!t) return;

    if (t === 'content_block_delta') {
      // text or input_json_delta
      const index: number = data.index ?? 0;
      const delta = data.delta || {};
      if (delta.type === 'text_delta') {
        const text: string = delta.text || '';
        if (!text) return;
        writeSSE(out, {
          id,
          object: 'chat.completion.chunk',
          created: util.unixTimestamp(),
          model,
          choices: [{ index: 0, delta: { content: text }, finish_reason: null, logprobs: null }],
        });
        return;
      }
      if (delta.type === 'input_json_delta') {
        // Accumulate partial_json per tool index and stream as OpenAI tool_calls.arguments
        const toolIdx = toolIndexByContentIndex.get(index);
        if (toolIdx === undefined) return;
        sawToolUse = true;
        const part: string = delta.partial_json || '';
        const prev = toolArgBufferByToolIndex.get(toolIdx) || '';
        const next = prev + part;
        toolArgBufferByToolIndex.set(toolIdx, next);
        writeSSE(out, {
          id,
          object: 'chat.completion.chunk',
          created: util.unixTimestamp(),
          model,
          choices: [{
            index: 0,
            delta: { tool_calls: [{ index: toolIdx, function: { arguments: part } }] },
            finish_reason: null,
            logprobs: null,
          }],
        });
        return;
      }
      return;
    }

    if (t === 'content_block_start') {
      const index: number = data.index ?? 0;
      const block = data.content_block || {};
      if (block.type === 'tool_use') {
        const name: string = block.name || 'unknown';
        const blockId: string = block.id || `toolu_${util.uuid(false)}`;
        const myToolIdx = toolCount++;
        toolIndexByContentIndex.set(index, myToolIdx);
        toolArgBufferByToolIndex.set(myToolIdx, '');
        sawToolUse = true;
        writeSSE(out, {
          id,
          object: 'chat.completion.chunk',
          created: util.unixTimestamp(),
          model,
          choices: [{
            index: 0,
            delta: { tool_calls: [{ index: myToolIdx, id: blockId, type: 'function', function: { name } }] },
            finish_reason: null,
            logprobs: null,
          }],
        });
      }
      return;
    }

    if (t === 'message_delta') {
      const d = data.delta || {};
      stopReason = d.stop_reason ?? stopReason;
      return;
    }

    if (t === 'message_stop') {
      writeSSE(out, {
        id,
        object: 'chat.completion.chunk',
        created: util.unixTimestamp(),
        model,
        choices: [{ index: 0, delta: {}, finish_reason: sawToolUse ? 'tool_calls' : 'stop', logprobs: null }],
      });
      out.write(`data: [DONE]\n\n`);
      out.end();
      return;
    }

    // ignore ping/error/unknown
  });

  source.on('data', (chunk: Buffer) => parser.feed(chunk.toString('utf8')));
  source.on('error', () => {
    try { out.end(); } catch {}
  });
  source.on('end', () => {
    try { out.end(); } catch {}
  });

  return out;
}

// Minimal mapper from Anthropic response -> OpenAI ChatCompletion-like
export async function mapAnthropicResponseToOpenAI(resp: Response, model: string): Promise<{
  id: string;
  object: 'chat.completion';
  created: number;
  model: string;
  choices: Array<{ index: number; message: { role: 'assistant'; content: string | null; tool_calls?: any[] }; finish_reason: any; logprobs: null }>;
  usage?: { prompt_tokens: number; completion_tokens: number; total_tokens: number };
}> {
  const data = await resp.json();
  const created = util.unixTimestamp();
  let contentText = '';
  const toolCalls: any[] = [];
  const content = Array.isArray(data?.content) ? data.content : [];
  for (const block of content) {
    if (block && block.type === 'text') contentText += String(block.text || '');
    if (block && block.type === 'tool_use') {
      toolCalls.push({ id: block.id, type: 'function', function: { name: block.name, arguments: JSON.stringify(block.input ?? {}) } });
    }
  }

  return {
    id: data?.id || `chatcmpl-${util.uuid(false)}`,
    object: 'chat.completion',
    created,
    model,
    choices: [
      {
        index: 0,
        message: { role: 'assistant', content: toolCalls.length ? null : contentText || '', ...(toolCalls.length ? { tool_calls: toolCalls } : {}) },
        finish_reason: toolCalls.length ? 'tool_calls' : 'stop',
        logprobs: null,
      },
    ],
    usage: data?.usage ? { prompt_tokens: data.usage.input_tokens || 0, completion_tokens: data.usage.output_tokens || 0, total_tokens: (data.usage.input_tokens || 0) + (data.usage.output_tokens || 0) } : undefined,
  };
}

export function resolveAnthropicBaseUrl(envUrl?: string): string {
  const base = (envUrl || '').trim() || 'https://api.anthropic.com';
  return base.replace(/\/$/, '');
}
