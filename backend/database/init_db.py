"""建表脚本"""

from .database import engine, Base


def init_database():
    """创建所有表"""
    Base.metadata.create_all(bind=engine)
    print("数据库表创建完成")


def drop_database():
    """删除所有表"""
    Base.metadata.drop_all(bind=engine)
    print("数据库表已删除")


if __name__ == "__main__":
    init_database()
