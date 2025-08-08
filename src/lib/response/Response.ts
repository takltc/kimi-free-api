import mime from 'mime';
import _ from 'lodash';

import Body from './Body.ts';
import util from '../util.ts';

export interface ResponseOptions {
    statusCode?: number;
    type?: string;
    headers?: Record<string, any>;
    redirect?: string;
    body?: any;
    size?: number;
    time?: number;
}

export default class Response {

    /** 响应HTTP状态码 */
    statusCode: number;
    /** 响应内容类型 */
    type: string;
    /** 响应headers */
    headers: Record<string, any>;
    /** 重定向目标 */
    redirect: string;
    /** 响应载荷 */
    body: any;
    /** 响应载荷大小 */
    size: number;
    /** 响应时间戳 */
    time: number;

    constructor(body: any, options: ResponseOptions = {}) {
        const { statusCode, type, headers, redirect, size, time } = options;
        this.statusCode = Number(_.defaultTo(statusCode, Body.isInstance(body) ? body.statusCode : undefined))
        this.type = type;
        this.headers = headers;
        this.redirect = redirect;
        this.size = size;
        this.time = Number(_.defaultTo(time, util.timestamp()));
        this.body = body;
    }

    injectTo(ctx) {
        this.redirect && ctx.redirect(this.redirect);
        this.statusCode && (ctx.status = this.statusCode);
        this.type && (ctx.type = mime.getType(this.type) || this.type);
        const headers = this.headers || {};
        
        // 对 SSE 响应自动设置必要的响应头
        if(this.type === 'text/event-stream') {
            headers['Connection'] = 'keep-alive';
            headers['Cache-Control'] = 'no-cache, no-transform';
            headers['X-Accel-Buffering'] = 'no'; // 针对 nginx 代理
            // 移除 Content-Length，SSE 是流式响应
            delete headers['Content-Length'];
            delete headers['content-length'];
        } else if(this.size && !headers["Content-Length"] && !headers["content-length"]) {
            headers["Content-Length"] = this.size;
        }
        
        ctx.set(headers);
        if(Body.isInstance(this.body))
            ctx.body = this.body.toObject();
        else
            ctx.body = this.body;
    }

    static isInstance(value) {
        return value instanceof Response;
    }

}