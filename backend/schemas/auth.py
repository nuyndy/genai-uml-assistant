from pydantic import BaseModel, ConfigDict, Field


class GoogleLoginSchema(BaseModel):
    credential: str = Field(..., min_length=1)


class UserSchema(BaseModel):
    id: int
    email: str
    name: str | None = None
    avatar_url: str | None = None
    model_config = ConfigDict(from_attributes=True)


class AuthResponse(BaseModel):
    access_token: str
    token_type: str = "bearer"
    user: UserSchema
