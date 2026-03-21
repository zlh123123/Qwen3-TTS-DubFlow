import os
from dotenv import load_dotenv

load_dotenv()

DATABASE_PATH = os.getenv("DATABASE_PATH", "storage/database.db")
DATABASE_URL = os.getenv("DATABASE_URL")
