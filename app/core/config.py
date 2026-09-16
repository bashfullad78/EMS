"""Application configuration loaded from .env file."""
from functools import lru_cache

from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    model_config = SettingsConfigDict(env_file=".env", extra="ignore")

    APP_NAME: str = "Event Management System"
    APP_VERSION: str = "1.0.0"
    DEBUG: bool = False

    
    DATABASE_URL: str 
    DB_ECHO_LOG: bool = False

    JWT_SECRET_KEY: str 
    JWT_ALGORITHM: str 
    ACCESS_TOKEN_EXPIRE_MINUTES: int 

    CORS_ORIGINS: str 


@lru_cache
def get_settings() -> Settings:
    return Settings()


settings = get_settings()
