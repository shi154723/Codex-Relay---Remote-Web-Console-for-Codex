# Codex Relay - Remote Web Console for Codex

Codex Relay 是一个手机网页控制台。它在电脑上启动桥接服务，调用 Codex App Server，让你从手机查看历史对话、创建或恢复对话、发送任务、实时接收回复、停止回合，并处理命令执行和文件修改审批。

“过程”页面展示 App Server 提供的推理摘要、计划、命令输出和状态事件；它不显示模型未公开的隐藏思维链。项目目前也不提供屏幕级远程控制。

## 工作方式

```text
手机浏览器 -> 安全网络通道 -> Codex Relay -> codex app-server -> 本地工作区
```

电脑端桥接服务默认监听 `4317` 端口。建议只通过本机、家庭局域网或 Tailscale 等私人网络访问，避免直接把端口暴露到公网。

## 使用前准备

- Windows、macOS 或 Linux
- Node.js 20 或更高版本
- 已安装并完成登录的 Codex CLI，并且终端中可以运行 `codex`
- 手机和电脑之间可用的安全网络通道，例如同一局域网、Tailscale 或 Cloudflare Tunnel

先确认 Codex CLI 可用：

```sh
codex --version
codex app-server --listen stdio://
```

第二条命令用于确认服务能启动，看到服务启动后按 `Ctrl+C` 退出。

## 安装

```sh
cd /path/to/Codex-Relay---Remote-Web-Console-for-Codex
npm install
```

Windows 示例：

```powershell
cd "D:\Projects\Codex-Relay---Remote-Web-Console-for-Codex"
npm install
```

## 配置访问口令

访问口令用于网页登录桥接服务。请使用长随机字符串，不要使用示例值或 GitHub 账号密码。

当前终端临时设置：

```powershell
$env:CODEX_REMOTE_TOKEN = "请替换为长随机口令"
```

保存到当前用户环境变量（适合开机启动）：

```powershell
[Environment]::SetEnvironmentVariable("CODEX_REMOTE_TOKEN", "请替换为长随机口令", "User")
```

`.env.example` 只是配置参考；项目不会自动读取 `.env`，启动前需手动设置环境变量或使用环境变量加载工具。

## 启动服务

```sh
npm start
```

默认地址为 `http://127.0.0.1:4317/`。若未设置口令，服务会为本次启动生成随机口令并打印在终端中。

仅本机测试：

```powershell
$env:HOST = "127.0.0.1"
$env:PORT = "4317"
npm start
```

局域网访问：

```powershell
$env:HOST = "0.0.0.0"
$env:PORT = "4317"
npm start
```

运行 `ipconfig` 找到电脑局域网 IPv4 地址，例如 `192.168.1.20`，然后手机访问 `http://192.168.1.20:4317/`。无法访问时检查防火墙是否允许 Node.js 在专用网络通信。不要在公共 Wi-Fi 上开放此端口。

## 使用 Tailscale 远程访问

1. 在电脑和手机安装 Tailscale。
2. 两台设备登录同一个 Tailscale 账号或 Tailnet。
3. 电脑端将 `HOST` 设置为 `0.0.0.0` 并启动服务。
4. 电脑运行 `tailscale ip -4`，记下 Tailscale IPv4 地址。
5. 手机开启 Tailscale VPN，访问 `http://<电脑的 Tailscale IP>:4317/`。

如需 HTTPS，可使用 Tailscale Serve 或 Cloudflare Tunnel。请参考官方文档配置域名和证书，不要把真实域名、IP 或口令写入本仓库。

## 第一次连接

1. 在手机浏览器打开网页。
2. 打开右上角菜单。
3. 输入电脑端的 `CODEX_REMOTE_TOKEN`。
4. 在“电脑端目录”填写 Codex 工作目录，例如 `D:\Projects\demo`。
5. 点击“连接电脑”。
6. 点击“新建对话”或选择已有对话。

浏览器会保存访问口令到本机 `localStorage`，服务端登录后会发放 HttpOnly 会话 Cookie。不要在公共设备上使用“记住口令”。

## 发送和管理任务

- 在底部输入框描述任务，按 Enter 发送；Shift+Enter 换行。
- 回复会实时显示。
- 点击“停止”中断当前回合。
- 左侧历史列表恢复已有对话。
- 点击右上角“过程”进入 `thinking.html`，查看推理摘要、计划、命令输出和状态事件。

## 命令和文件审批

Codex 请求执行命令或修改文件时，页面会显示审批框。“允许本次”只批准当前请求，“拒绝”拒绝当前请求。批准前请检查命令、工作目录和修改文件。

## Windows 登录后自动启动

```powershell
Set-ExecutionPolicy -Scope Process Bypass
./install-startup.ps1
```

脚本会在当前用户 Startup 文件夹创建快捷方式，登录 Windows 后启动 `start-remote.ps1`。它读取当前用户的 `CODEX_REMOTE_TOKEN`，监听 `4317`，并避免重复启动。迁移项目目录后请重新运行安装脚本。

## 环境变量

| 变量 | 默认值 | 说明 |
| --- | --- | --- |
| `CODEX_REMOTE_TOKEN` | 每次启动随机生成 | 网页登录口令，生产环境必须设置长随机值 |
| `HOST` | `0.0.0.0` | 监听地址；仅本机访问时建议设为 `127.0.0.1` |
| `PORT` | `4317` | 桥接服务端口 |

## 故障排查

页面打不开时确认服务和端口：

```powershell
Get-NetTCPConnection -State Listen -LocalPort 4317
```

“Unauthorized” 通常表示口令不一致；修改环境变量后必须重启服务。历史为空或无法发送时，确认 `codex` 已安装并登录，查看启动终端的 `[codex]` 错误。服务立即退出时运行 `node server.mjs` 查看完整错误。

## 安全说明

登录后使用 HttpOnly、SameSite Cookie。API 仍接受 `x-codex-token` 以便客户端建立会话；访问口令不通过 URL 查询参数传递。请勿提交真实口令、个人 IP、域名或 Tunnel 配置，也不要把 4317 直接映射到公网。

## 开发与许可证

前端文件位于 `public/`，桥接逻辑位于 `server.mjs`。运行 `npm start` 开发。项目采用 MIT License，详见 [LICENSE](LICENSE)。提交前运行 `git diff --check`，并搜索 `token`、`password`、`secret` 和个人网络地址。
