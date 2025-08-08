import _ from 'lodash';

import Body from './Body.ts';
import Exception from '../exceptions/Exception.ts';
import APIException from '../exceptions/APIException.ts';
import EX from '../consts/exceptions.ts';
import HTTP_STATUS_CODES from '../http-status-codes.ts';
import { OpenAIErrorMapper } from '../openai/errors.ts';

export default class FailureBody extends Body {
    
    /** 是否使用OpenAI错误格式 */
    private useOpenAIFormat: boolean = false;
    
    constructor(error: APIException | Exception | Error, _data?: any, useOpenAIFormat: boolean = false) {
        this.useOpenAIFormat = useOpenAIFormat;
        
        // 如果使用OpenAI格式
        if (useOpenAIFormat) {
            const { error: openAIError, httpStatusCode } = OpenAIErrorMapper.mapError(error, _data);
            super({
                ...openAIError,
                statusCode: httpStatusCode
            });
        } else {
            // 原有的错误处理逻辑
            let errcode, errmsg, data = _data, httpStatusCode = HTTP_STATUS_CODES.OK;;
            if(_.isString(error))
                error = new Exception(EX.SYSTEM_ERROR, error);
            else if(error instanceof APIException || error instanceof Exception)
                ({ errcode, errmsg, data, httpStatusCode } = error);
            else if(_.isError(error))
                ({ errcode, errmsg, data, httpStatusCode } = new Exception(EX.SYSTEM_ERROR, error.message));
            super({
                code: errcode || -1,
                message: errmsg || 'Internal error',
                data,
                statusCode: httpStatusCode
            });
        }
    }

    static isInstance(value) {
        return value instanceof FailureBody;
    }

}