import Koa from 'koa';
import KoaRouter from 'koa-router';
import koaRange from 'koa-range';
import koaCors from "koa2-cors";
import koaBody from 'koa-body';
import _ from 'lodash';

import Exception from './exceptions/Exception.ts';
import Request from './request/Request.ts';
import Response from './response/Response.js';
import FailureBody from './response/FailureBody.ts';
import EX from './consts/exceptions.ts';
import logger from './logger.ts';
import config from './config.ts';
import authMiddleware from '../middleware/auth.ts';

class Server {

    app;
    router;
    
    constructor() {
        this.app = new Koa();
        // 增强的 CORS 配置
        // @author jizhejiang
        // @date 2025-08-07 23:39:47
        // @description 支持自定义请求头 Authorization 和 OpenAI-Organization
        this.app.use(koaCors({
            origin: (ctx: any) => {
                // 动态设置允许的源，如果请求包含 origin 则返回该 origin，否则返回 *
                const requestOrigin = ctx.request.header.origin;
                return requestOrigin || '*';
            },
            credentials: true,  // 允许携带凭证
            allowMethods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS', 'PATCH', 'HEAD'],  // 允许的 HTTP 方法
            allowHeaders: [
                'Content-Type',
                'Authorization',  // OpenAI 标准认证头
                'OpenAI-Organization',  // OpenAI 组织标识头
                'X-Requested-With',
                'Accept',
                'Accept-Version',
                'Content-Length',
                'Content-MD5',
                'Date',
                'X-Api-Version',
                'X-CSRF-Token'
            ],  // 允许的请求头
            exposeHeaders: ['Content-Length', 'Date', 'X-Request-Id'],  // 暴露给客户端的响应头
            maxAge: 86400  // 预检请求缓存时间（24小时）
        }));
        
        // OPTIONS 预检请求快速响应中间件
        // @author jizhejiang
        // @date 2025-08-07 23:39:47 
        // @description 快速处理 OPTIONS 请求，返回 204 状态码
        this.app.use(async (ctx: any, next: Function) => {
            if (ctx.method === 'OPTIONS') {
                logger.debug(`OPTIONS preflight request: ${ctx.url}`);
                ctx.status = 204;  // No Content
                // 不调用 next()，直接返回
                return;
            }
            await next();
        });
        
        // 范围请求支持
        this.app.use(koaRange);
        // 认证中间件 - 在 CORS 之后，其他中间件之前
        this.app.use(authMiddleware);
        this.router = new KoaRouter({ prefix: config.service.urlPrefix });
        // 前置处理异常拦截
        this.app.use(async (ctx: any, next: Function) => {
            if(ctx.request.type === "application/xml" || ctx.request.type === "application/ssml+xml")
                ctx.req.headers["content-type"] = "text/xml";
            try { await next() }
            catch (err) {
                logger.error(err);
                // 检查是否为OpenAI兼容的路由（以/v1开头的路由）
                const useOpenAIFormat = ctx.request.path.startsWith('/v1/');
                const failureBody = new FailureBody(err, null, useOpenAIFormat);
                new Response(failureBody).injectTo(ctx);
            }
        });
        // 载荷解析器支持
        this.app.use(koaBody(_.clone(config.system.requestBody)));
        this.app.on("error", (err: any) => {
            // 忽略连接重试、中断、管道、取消错误
            if (["ECONNRESET", "ECONNABORTED", "EPIPE", "ECANCELED"].includes(err.code)) return;
            logger.error(err);
        });
        logger.success("Server initialized");
    }

    /**
     * 附加路由
     * 
     * @param routes 路由列表
     */
    attachRoutes(routes: any[]) {
        routes.forEach((route: any) => {
            const prefix = route.prefix || "";
            for (let method in route) {
                if(method === "prefix") continue;
                if (!_.isObject(route[method])) {
                    logger.warn(`Router ${prefix} ${method} invalid`);
                    continue;
                }
                for (let uri in route[method]) {
                    this.router[method](`${prefix}${uri}`, async ctx => {
                        const { request, response } = await this.#requestProcessing(ctx, route[method][uri]);
                        if(response != null && config.system.requestLog)
                            logger.info(`<- ${request.method} ${request.url} ${response.time - request.time}ms`);
                    });
                }
            }
            logger.info(`Route ${config.service.urlPrefix || ""}${prefix} attached`);
        });
        this.app.use(this.router.routes());
        this.app.use((ctx: any) => {
            const request = new Request(ctx);
            logger.debug(`-> ${ctx.request.method} ${ctx.request.url} request is not supported - ${request.remoteIP || "unknown"}`);
            const message = `The requested endpoint was not found`;
            logger.warn(`[404] ${ctx.request.method} ${ctx.request.url}`);
            // 检查是否为OpenAI兼容的路由
            const useOpenAIFormat = ctx.request.path.startsWith('/v1/');
            
            // 设置404状态码
            ctx.status = 404;
            
            if (useOpenAIFormat) {
                // OpenAI格式的404错误
                const errorBody = {
                    error: {
                        message: message,
                        type: "not_found_error",
                        code: "not_found"
                    }
                };
                const response = new Response(errorBody);
                response.injectTo(ctx);
            } else {
                // 普通格式的404错误
                const failureBody = new FailureBody(new Exception(EX.SYSTEM_NOT_ROUTE_MATCHING, message), null, false);
                const response = new Response(failureBody);
                response.injectTo(ctx);
            }
            
            if(config.system.requestLog)
                logger.info(`<- ${request.method} ${request.url} 404`);
        });
    }

    /**
     * 请求处理
     * 
     * @param ctx 上下文
     * @param routeFn 路由方法
     */
    #requestProcessing(ctx: any, routeFn: Function): Promise<any> {
        return new Promise(resolve => {
            const request = new Request(ctx);
            try {
                if(config.system.requestLog)
                    logger.info(`-> ${request.method} ${request.url}`);
                    routeFn(request)
                .then(response => {
                    try {
                        if(!Response.isInstance(response)) {
                            const _response = new Response(response);
                            _response.injectTo(ctx);
                            return resolve({ request, response: _response });
                        }
                        response.injectTo(ctx);
                        resolve({ request, response });
                    }
                    catch(err) {
                        logger.error(err);
                        // 检查是否为OpenAI兼容的路由
                        const useOpenAIFormat = ctx.request.path.startsWith('/v1/');
                        const failureBody = new FailureBody(err, null, useOpenAIFormat);
                        const response = new Response(failureBody);
                        response.injectTo(ctx);
                        resolve({ request, response });
                    }
                })
                .catch(err => {
                    try {
                        logger.error(err);
                        // 检查是否为OpenAI兼容的路由
                        const useOpenAIFormat = ctx.request.path.startsWith('/v1/');
                        const failureBody = new FailureBody(err, null, useOpenAIFormat);
                        const response = new Response(failureBody);
                        response.injectTo(ctx);
                        resolve({ request, response });
                    }
                    catch(err) {
                        logger.error(err);
                        // 检查是否为OpenAI兼容的路由
                        const useOpenAIFormat = ctx.request.path.startsWith('/v1/');
                        const failureBody = new FailureBody(err, null, useOpenAIFormat);
                        const response = new Response(failureBody);
                        response.injectTo(ctx);
                        resolve({ request, response });
                    }
                });
            }
            catch(err) {
                logger.error(err);
                // 检查是否为OpenAI兼容的路由
                const useOpenAIFormat = ctx.request.path.startsWith('/v1/');
                const failureBody = new FailureBody(err, null, useOpenAIFormat);
                const response = new Response(failureBody);
                response.injectTo(ctx);
                resolve({ request, response });
            }
        });
    }

    /**
     * 监听端口
     */
    async listen() {
        const host = config.service.host;
        const port = config.service.port;
        await Promise.all([
            new Promise((resolve, reject) => {
                if(host === "0.0.0.0" || host === "localhost" || host === "127.0.0.1")
                    return resolve(null);
                this.app.listen(port, "localhost", err => {
                    if(err) return reject(err);
                    resolve(null);
                });
            }),
            new Promise((resolve, reject) => {
                this.app.listen(port, host, err => {
                    if(err) return reject(err);
                    resolve(null);
                });
            })
        ]);
        logger.success(`Server listening on port ${port} (${host})`);
    }

}

export default new Server();