# DeepSeek Harness 接入核查

核查日期：2026-11-03。本轮保留现有真实 DeepSeek API 问答，没有把普通 API 连接标称成 Harness。

## 官方依据

- [官方仓库](https://github.com/deepseek-ai/deepseek-harness)：独立运行时、Cordis 插件组合，开发预览仍存在兼容性变更。
- [Python SDK 官方指南](https://github.com/deepseek-ai/deepseek-harness/blob/master/docs/user/guide/python-sdk.md)：SDK 可以用于自己的程序，明确要求独立工作目录和 Harness home。
- [官方 minimal 示例](https://github.com/deepseek-ai/deepseek-harness/blob/master/python/sdk/examples/minimal.py)：使用 DeepSeekHarness.run 与 session_id，不是现有 /chat/completions 的替代地址。

## 本轮结论

技术上可通过本地后端托管官方 SDK，再把对话事件适配到问答应用。但官方 sdk-minimal 默认包含持久 shell、read_image、working_directory；文档明确说工作目录不构成文件访问沙箱。直接挂上该默认 profile 会超出本轮“只操作模拟桌面现有窗口”的边界。

因此没有自动安装/启动 Harness，也没有给聊天应用宿主机 shell 或文件读写权限。用户要求不确定部分先留着，本轮不猜测配置、不新增权限对话或常驻按钮。

后续若要实施，需要锁定已核实的 SDK 版本，并建立仅暴露模拟桌面观察/已授权窗口动作的定制 profile。模型请求、会话、取消和权限必须复用应用的 Agent 开关；模拟桌面的显式确认机制不能被 Harness 的工具循环绕过。工具集合及是否允许模型经聊天提出布局，需先确定，不将未知工具当成既有技术。

当前 AI 问答继续走已接入的 DeepSeek API；Agent 关闭会拒绝请求并取消进行中的回答，密钥替换取消旧请求，失败保留草稿。以上行为有桌面回归验证。
