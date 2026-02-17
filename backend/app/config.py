from pydantic_settings import BaseSettings


class Settings(BaseSettings):
    supabase_url: str
    supabase_key: str

    model_config = {"env_file": ".env"}


settings = Settings()
