# 文荒代餐文 Demo

一个面向 C 端读者的「文荒代餐文 / 原创精神代餐」原型。

## 本地运行

1. 复制 `work/.env.local.example` 为 `work/.env.local`
2. 填入智谱 API Key：

```env
ZHIPU_API_KEY=你的智谱APIKey
ZHIPU_MODEL=glm-4.5-air
INVITE_CODES=reader001,reader002,reader003
LIMIT_ANALYZE_PER_DAY=2
LIMIT_PROPOSALS_PER_DAY=4
LIMIT_GENERATE_PER_DAY=5
```

3. 启动服务：

```bash
npm start
```

4. 打开：

```text
http://127.0.0.1:5177/wenhuang-demo.html
```

## Railway 部署

在 Railway 里从 GitHub 仓库部署后，进入服务的 `Variables`，添加：

```env
ZHIPU_API_KEY=你的智谱APIKey
ZHIPU_MODEL=glm-4.5-air
INVITE_CODES=reader001,reader002,reader003,reader004,reader005
LIMIT_ANALYZE_PER_DAY=2
LIMIT_PROPOSALS_PER_DAY=4
LIMIT_GENERATE_PER_DAY=5
```

Railway 会自动执行 `npm start`。部署成功后，在 `Settings` 或服务面板里生成公开域名，就可以把链接发给内测用户。

## 说明

- API Key 只在后端读取，不会暴露到前端页面。
- `work/.env.local` 已被 `.gitignore` 忽略，不应该提交。
- 邀请码额度目前存在内存里，重启或重新部署会清零；MVP 内测够用，正式产品建议换成 Redis 或数据库。
- 长文本上传用于抽样提取抽象阅读体验，不复用原文句子、人物、地名、专有设定和具体桥段。
