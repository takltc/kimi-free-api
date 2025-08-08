import _ from 'lodash';
import { createModelList } from '@/lib/openai-compat';

export default {

    prefix: '/v1',

    get: {
        '/models': async () => {
            // 使用 OpenAI 兼容层创建标准格式的模型列表
            return createModelList();
        }

    }
}
