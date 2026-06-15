# 文荒拯救器 Demo

一个面向 C 端读者的「文荒拯救器 / 原创精神代餐」原型。

## 运行

1. 复制 `work/.env.local.example` 为 `work/.env.local`
2. 填入智谱 API Key：

```env
ZHIPU_API_KEY=你的智谱APIKey
ZHIPU_MODEL=glm-4.5
```

3. 启动服务：

```bash
node work/static-server.js
```

4. 打开：

```text
http://127.0.0.1:5177/wenhuang-demo.html
```

## 说明

- API Key 只在本地后端读取，不会暴露到前端页面。
- `work/.env.local` 已被 `.gitignore` 忽略，不应提交。
- 长文本上传用于抽样提取抽象阅读体验，不复用原文句子、人物、地名、专有设定和具体桥段。
