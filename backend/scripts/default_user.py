from app.core.security import get_password_hash
from app.infrastructure.database import SessionLocal
from app.models.user import User

DEFAULT_USERS = [
    {
        "email": "admin@example.com",
        "username": "admin",
        "password": "admin123",
    },
]


def normalize_username(username: str) -> str:
    return username.strip().lower()


def normalize_email(email: str) -> str:
    return email.strip().lower()


def create_or_update_user(db, *, email: str, username: str, password: str) -> User:
    email = normalize_email(email)
    username = normalize_username(username)

    user = db.query(User).filter((User.email == email) | (User.username == username)).first()

    if user is None:
        user = User(
            email=email,
            username=username,
            hashed_password=get_password_hash(password),
        )
        db.add(user)
        return user

    user.email = email
    user.username = username
    user.hashed_password = get_password_hash(password)
    return user


def create_default_user():
    db = SessionLocal()

    try:
        users = [create_or_update_user(db, **user_data) for user_data in DEFAULT_USERS]
        db.commit()

        for user in users:
            db.refresh(user)

    except Exception:
        db.rollback()
        raise
    finally:
        db.close()


if __name__ == "__main__":
    create_default_user()
