from sqlalchemy import or_
from sqlalchemy.orm import Session

from app.models.record import (
    PersonRecord,
    RecordAddress,
    RecordDocument,
    RecordPhone,
    RecordSocialMedia,
)


class RecordRepository:
    def __init__(self, db: Session):
        self.db = db

    def get_record(self, record_id: int) -> PersonRecord | None:
        return self.db.query(PersonRecord).filter(PersonRecord.id == record_id).first()

    def list_records(self, search: str | None = None) -> list[PersonRecord]:
        query = self.db.query(PersonRecord)

        if search:
            words = search.split()

            for word in words:
                term = f"%{word}%"
                query = query.filter(
                    or_(
                        PersonRecord.first_name.ilike(term),
                        PersonRecord.last_name.ilike(term),
                        PersonRecord.id_number.ilike(term),
                        PersonRecord.email.ilike(term),
                        PersonRecord.occupation.ilike(term),
                        PersonRecord.notes.ilike(term),
                        PersonRecord.phones.any(RecordPhone.phone_number.ilike(term)),
                        PersonRecord.addresses.any(RecordAddress.address.ilike(term)),
                        PersonRecord.social_media.any(
                            RecordSocialMedia.username_or_url.ilike(term)
                        ),
                    )
                )

        return query.all()

    def create_record(self, record_data: dict) -> PersonRecord:
        phones_data = record_data.pop("phones", [])
        addresses_data = record_data.pop("addresses", [])
        social_media_data = record_data.pop("social_media", [])

        record = PersonRecord(**record_data)

        for phone in phones_data:
            record.phones.append(RecordPhone(**phone))

        for address in addresses_data:
            record.addresses.append(RecordAddress(**address))

        for social in social_media_data:
            record.social_media.append(RecordSocialMedia(**social))

        self.db.add(record)
        self.db.commit()
        self.db.refresh(record)
        return record

    def update_record(self, record_id: int, record_data: dict) -> PersonRecord | None:
        record = self.get_record(record_id)
        if not record:
            return None

        if "phones" in record_data:
            new_phones = record_data.pop("phones")
            record.phones = [RecordPhone(record_id=record.id, **phone) for phone in new_phones]

        if "addresses" in record_data:
            new_addresses = record_data.pop("addresses")
            record.addresses = [
                RecordAddress(record_id=record.id, **address) for address in new_addresses
            ]

        if "social_media" in record_data:
            new_social_media = record_data.pop("social_media")
            record.social_media = [
                RecordSocialMedia(record_id=record.id, **social) for social in new_social_media
            ]

        for key, value in record_data.items():
            if hasattr(record, key):
                setattr(record, key, value)

        self.db.commit()
        self.db.refresh(record)
        return record

    def delete_record(self, record_id: int) -> bool:
        record = self.get_record(record_id)
        if not record:
            return False

        self.db.delete(record)
        self.db.commit()
        return True

    def add_document(self, record_id: int, doc_data: dict) -> RecordDocument:
        document = RecordDocument(record_id=record_id, **doc_data)
        self.db.add(document)
        self.db.commit()
        self.db.refresh(document)
        return document

    def get_document(self, doc_id: int) -> RecordDocument | None:
        return (
            self.db.query(RecordDocument)
            .join(PersonRecord, PersonRecord.id == RecordDocument.record_id)
            .filter(RecordDocument.id == doc_id)
            .first()
        )

    def delete_document(self, doc_id: int) -> bool:
        document = self.get_document(doc_id)
        if not document:
            return False

        self.db.delete(document)
        self.db.commit()
        return True
