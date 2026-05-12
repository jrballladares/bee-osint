from datetime import datetime

from pydantic import BaseModel, ConfigDict


# Phone Schemas
class RecordPhoneBase(BaseModel):
    phone_number: str
    label: str | None = None


class RecordPhoneCreate(RecordPhoneBase):
    pass


class RecordPhoneRead(RecordPhoneBase):
    id: int
    record_id: int
    model_config = ConfigDict(from_attributes=True)


# Address Schemas
class RecordAddressBase(BaseModel):
    address: str
    label: str | None = None


class RecordAddressCreate(RecordAddressBase):
    pass


class RecordAddressRead(RecordAddressBase):
    id: int
    record_id: int
    model_config = ConfigDict(from_attributes=True)


# Social Media Schemas
class RecordSocialMediaBase(BaseModel):
    platform: str
    username_or_url: str


class RecordSocialMediaCreate(RecordSocialMediaBase):
    pass


class RecordSocialMediaRead(RecordSocialMediaBase):
    id: int
    record_id: int
    model_config = ConfigDict(from_attributes=True)


# Document Schemas
class RecordDocumentBase(BaseModel):
    file_name: str
    file_type: str | None = None


class RecordDocumentCreate(RecordDocumentBase):
    file_path: str


class RecordDocumentRead(RecordDocumentBase):
    id: int
    record_id: int
    file_path: str
    uploaded_at: datetime
    model_config = ConfigDict(from_attributes=True)


# Person Record Schemas
class PersonRecordBase(BaseModel):
    first_name: str
    last_name: str
    date_of_birth: str | None = None
    gender: str | None = None
    nationality: str | None = None
    id_number: str | None = None
    email: str | None = None
    occupation: str | None = None
    notes: str | None = None


class PersonRecordCreate(PersonRecordBase):
    phones: list[RecordPhoneCreate] = []
    addresses: list[RecordAddressCreate] = []
    social_media: list[RecordSocialMediaCreate] = []


class PersonRecordUpdate(BaseModel):
    first_name: str | None = None
    last_name: str | None = None
    date_of_birth: str | None = None
    gender: str | None = None
    nationality: str | None = None
    id_number: str | None = None
    email: str | None = None
    occupation: str | None = None
    notes: str | None = None
    phones: list[RecordPhoneCreate] | None = None
    addresses: list[RecordAddressCreate] | None = None
    social_media: list[RecordSocialMediaCreate] | None = None


class PersonRecordRead(PersonRecordBase):
    id: int
    created_at: datetime
    updated_at: datetime

    phones: list[RecordPhoneRead] = []
    addresses: list[RecordAddressRead] = []
    social_media: list[RecordSocialMediaRead] = []
    documents: list[RecordDocumentRead] = []

    model_config = ConfigDict(from_attributes=True)
