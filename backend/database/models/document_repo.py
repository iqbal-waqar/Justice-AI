from sqlalchemy.orm import Session
from backend.database.migrations.user_document import UserDocument


class DocumentRepository:
    def __init__(self, db: Session):
        self.db = db

    def create(self, document_data: dict):
        document = UserDocument(**document_data)
        self.db.add(document)
        self.db.commit()
        self.db.refresh(document)
        return document

    def get_by_user(self, user_id: int):
        return self.db.query(UserDocument).filter(UserDocument.user_id == user_id).order_by(UserDocument.created_at.desc()).all()

    def get_by_id_and_user(self, doc_id: int, user_id: int):
        return self.db.query(UserDocument).filter(UserDocument.id == doc_id, UserDocument.user_id == user_id).first()

    def update(self, document: UserDocument, update_data: dict):
        for key, value in update_data.items():
            setattr(document, key, value)
        self.db.commit()
        self.db.refresh(document)
        return document

    def delete(self, document: UserDocument):
        self.db.delete(document)
        self.db.commit()
