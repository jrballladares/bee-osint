from pydantic import BaseModel, ConfigDict


class OsintSourceBase(BaseModel):
    name: str
    url: str
    is_active: bool = True


class OsintSourceCreate(OsintSourceBase):
    pass


class OsintSourceUpdate(BaseModel):
    name: str
    url: str
    is_active: bool


class OsintSourceRead(OsintSourceBase):
    id: int

    model_config = ConfigDict(from_attributes=True)


class OsintSourceInfo(BaseModel):
    name: str
    url: str
    is_active: bool
