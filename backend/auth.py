
import os

import bcrypt
import psycopg
from fastapi import APIRouter, HTTPException
from pydantic import BaseModel, Field
from dotenv import load_dotenv

load_dotenv()

router = APIRouter(prefix="/auth", tags=["Authentication"])


class StudentLogin(BaseModel):
    student_id: int
    pin: str = Field(min_length=4, max_length=12)


def get_connection():
    return psycopg.connect(
        host="localhost",
        port=5432,
        dbname="edusync",
        user="postgres",
        password=os.getenv("DB_PASSWORD"),
    )


@router.post("/login")
def student_login(data: StudentLogin):
    conn = get_connection()

    try:
        with conn.cursor() as cur:
            cur.execute(
                """
                SELECT student_id, name, email, pin_hash, role
                FROM students
                WHERE student_id = %s
                """,
                (data.student_id,),
            )
            student = cur.fetchone()

        if student is None:
            raise HTTPException(
                status_code=401,
                detail="Invalid student ID or PIN.",
            )

        student_id, name, email, pin_hash, role = student

        if not pin_hash:
            raise HTTPException(
                status_code=403,
                detail="PIN not configured. Ask your teacher to set it.",
            )

        if role != "student":
            raise HTTPException(
                status_code=403,
                detail="This account is not a student account.",
            )

        pin_matches = bcrypt.checkpw(
            data.pin.encode("utf-8"),
            pin_hash.encode("utf-8"),
        )

        if not pin_matches:
            raise HTTPException(
                status_code=401,
                detail="Invalid student ID or PIN.",
            )

        return {
            "message": "Login successful",
            "student": {
                "student_id": student_id,
                "name": name,
                "email": email,
                "role": role,
            },
        }

    finally:
        conn.close()
