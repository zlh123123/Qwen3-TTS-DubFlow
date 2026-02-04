后端采用uv配置环境

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