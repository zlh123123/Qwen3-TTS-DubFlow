# 后端采用uv配置环境

1. uv安装

```sh
// Mac & Linux
curl -LsSf https://astral.sh/uv/install.sh | sh

// Windows
powershell -ExecutionPolicy ByPass -c "irm https://astral.sh/uv/install.ps1 | iex"

```

2. 运行项目

```sh

cd backend

// 换国内源（linux & Mac）
export UV_INDEX_URL=https://pypi.tuna.tsinghua.edu.cn/simple

// 换国内源（windows）
$env:UV_INDEX_URL="https://pypi.tuna.tsinghua.edu.cn/simple"

// 设置环境变量
cp .env.example .env

uv run main.py

```

可以访问`http://0.0.0.0:8000/docs`查看当前已开发的API

# 采用autodl穿透使用TTS服务
在autodl云服务器上运行：
cd /models_deploy
source entrypoint.sh

假设autodl服务器ssh登陆指令：ssh -p 47269 root@connect.nmb1.seetacloud.com

则在**本地主机**的终端中运行：
ssh -CNg -L 6006:127.0.0.1:6006 -L 6008:127.0.0.1:6008 -p 47269 root@connect.nmb1.seetacloud.com

输入密码后，终端会“卡住”不显示任何输出，这是正常的！不要关闭这个终端。