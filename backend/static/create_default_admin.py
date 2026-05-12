from app.core.security import get_password_hash
from app.infrastructure.database import Base, SessionLocal, engine
from app.models.user import User


def create_default_admin():
    Base.metadata.create_all(bind=engine)
    db = SessionLocal()

    try:
        admin_email = "admin@example.com"
        existing_user = db.query(User).filter(User.email == admin_email).first()

        if not existing_user:
            admin_user = User(
                email=admin_email,
                username="admin",
                hashed_password=get_password_hash("admin123"),
            )

            db.add(admin_user)
            db.commit()
    finally:
        db.close()


if __name__ == "__main__":
    create_default_admin()
