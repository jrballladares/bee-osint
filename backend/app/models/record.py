from datetime import UTC, datetime

from sqlalchemy import Column, DateTime, ForeignKey, Integer, String, Text
from sqlalchemy.orm import relationship

from app.infrastructure.database import Base


class PersonRecord(Base):
    __tablename__ = "person_records"

    id = Column(Integer, primary_key=True, index=True)
    first_name = Column(String, index=True, nullable=False)
    last_name = Column(String, index=True, nullable=False)
    date_of_birth = Column(String, nullable=True)
    gender = Column(String, nullable=True)
    nationality = Column(String, nullable=True)
    id_number = Column(String, index=True, nullable=True)
    email = Column(String, nullable=True)
    occupation = Column(String, nullable=True)
    notes = Column(Text, nullable=True)

    created_at = Column(DateTime(timezone=True), default=lambda: datetime.now(UTC))
    updated_at = Column(
        DateTime(timezone=True),
        default=lambda: datetime.now(UTC),
        onupdate=lambda: datetime.now(UTC),
    )

    phones = relationship("RecordPhone", back_populates="record", cascade="all, delete-orphan")
    addresses = relationship("RecordAddress", back_populates="record", cascade="all, delete-orphan")
    social_media = relationship(
        "RecordSocialMedia", back_populates="record", cascade="all, delete-orphan"
    )
    documents = relationship(
        "RecordDocument", back_populates="record", cascade="all, delete-orphan"
    )


class RecordPhone(Base):
    __tablename__ = "record_phones"
    id = Column(Integer, primary_key=True, index=True)
    record_id = Column(Integer, ForeignKey("person_records.id"), nullable=False)
    phone_number = Column(String, index=True, nullable=False)
    label = Column(String, nullable=True)
    record = relationship("PersonRecord", back_populates="phones")


class RecordAddress(Base):
    __tablename__ = "record_addresses"
    id = Column(Integer, primary_key=True, index=True)
    record_id = Column(Integer, ForeignKey("person_records.id"), nullable=False)
    address = Column(Text, nullable=False)
    label = Column(String, nullable=True)
    record = relationship("PersonRecord", back_populates="addresses")


class RecordSocialMedia(Base):
    __tablename__ = "record_social_media"
    id = Column(Integer, primary_key=True, index=True)
    record_id = Column(Integer, ForeignKey("person_records.id"), nullable=False)
    platform = Column(String, nullable=False)
    username_or_url = Column(String, nullable=False)
    record = relationship("PersonRecord", back_populates="social_media")


class RecordDocument(Base):
    __tablename__ = "record_documents"
    id = Column(Integer, primary_key=True, index=True)
    record_id = Column(Integer, ForeignKey("person_records.id"), nullable=False)
    file_name = Column(String, nullable=False)
    file_path = Column(String, nullable=False)
    file_type = Column(String, nullable=True)
    uploaded_at = Column(DateTime(timezone=True), default=lambda: datetime.now(UTC))
    record = relationship("PersonRecord", back_populates="documents")
