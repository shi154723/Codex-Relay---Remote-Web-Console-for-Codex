# Codex Relay - Remote Web Console for Codex

一个由电脑端桥接服务和手机网页组成的 Codex App Server 控制台。它支持查看历史对话、创建或恢复对话、发送任务、实时接收回复、停止回合，以及处理命令执行和文件修改审批。

“过程”页面展示 App Server 提供的推理摘要、计划、命令输出和状态事件；它不显示模型未公开的隐藏思维链。项目目前也不提供屏幕级远程控制。

## 要求

- Windows、macOS 或 Linux
- Node.js 20 或更高版本
- 已安装并可在终端运行的 Codex CLI（`codex app-server`）
- 手机和电脑之间可用的安全网络通道，例如 Tailscale 或 Cloudflare Tunnel

## 安装与启动

```sh
npm install
```

PowerShell：

```powershell
$env:CODEX_REMOTE_TOKEN = "请设置一个长随机口令"
$env:HOST = "127.0.0.1"
$env:PORT = "4317"
npm start
```

也可以复制 `.env.example` 为 `.env`，再由你使用的启动工具加载环境变量。服务默认监听 `127.0.0.1:4317`；如果需要通过私人 VPN 访问，可显式设置 `HOST=0.0.0.0`，并确保防火墙只允许私人网络访问。

不要把 4317 端口直接映射到公网。若使用反向代理或 Tunnel，请在代理层启用 HTTPS，并保留访问口令保护。

## Windows 登录后启动

```powershell
Set-ExecutionPolicy -Scope Process Bypass
./install-startup.ps1
```

脚本会在当前用户的 Startup 文件夹创建快捷方式，并使用当前项目目录启动 `start-remote.ps1`。迁移项目目录后请重新运行脚本。

## 环境变量

| 变量 | 默认值 | 说明 |
| --- | --- | --- |
| `CODEX_REMOTE_TOKEN` | 每次启动随机生成 | 网页登录口令，生产环境必须设置长随机值 |
| `HOST` | `0.0.0.0` | 监听地址；仅本机访问时建议设为 `127.0.0.1` |
| `PORT` | `4317` | 桥接服务端口 |

## 安全说明

登录后使用 HttpOnly、SameSite Cookie。API 仍接受 `x-codex-token` 以便客户端建立会话；访问口令不再通过 URL 查询参数传递。请勿把真实口令、个人 IP、域名或 Tunnel 配置提交到仓库。

## 开发

```sh
npm start
```

前端文件位于 `public/`，电脑端桥接逻辑位于 `server.mjs`。提交前请运行 `git diff --check`，并搜索仓库中的 `token`、`password`、`secret` 和个人网络地址。

