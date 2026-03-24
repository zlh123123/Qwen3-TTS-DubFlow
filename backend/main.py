from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from database import SessionLocal
from database.init_db import init_database
from routers import projects, config, characters, tasks, assets, scripts
from utils.init_config import init_settings 
from workers.worker import start_worker
from contextlib import asynccontextmanager
import os
from fastapi.staticfiles import StaticFiles

# 创建 storage 目录
os.makedirs("storage", exist_ok=True)

# 自动创建表结构
init_database()

# 第一次运行软件时，初始化配置项
db = SessionLocal()
try:
    init_settings(db)
finally:
    db.close()

@asynccontextmanager
async def lifespan(app: FastAPI):
    start_worker()
    yield

app = FastAPI(lifespan=lifespan)

app.mount("/static", StaticFiles(directory="storage"), name="static")

# CORS 设置 
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# 注册路由
app.include_router(projects.router)
app.include_router(config.router) 
app.include_router(characters.router)
app.include_router(tasks.router)
app.include_router(assets.router)
app.include_router(scripts.router)

@app.get("/")
def read_root():
    return {"message": "Narratis Backend is running!"}

if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8000)
