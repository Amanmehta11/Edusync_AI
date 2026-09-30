from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
from typing import List
import psycopg
import os
from dotenv import load_dotenv

load_dotenv()


app = FastAPI()


# =========================
# CORS CONFIGURATION
# =========================

app.add_middleware(
    CORSMiddleware,
    allow_origins=[
        "http://localhost:5173",
        "http://127.0.0.1:5173",
        "http://localhost:4173",
        "http://127.0.0.1:4173"
    ],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


# =========================
# HOME
# =========================

@app.get("/")
def home():
    return {
        "message": "EduSync AI Backend is Running"
    }


# =========================
# DATABASE TEST
# =========================

@app.get("/db-test")
def database_test():

    connection = psycopg.connect(
        host="localhost",
        port=5432,
        dbname="edusync",
        user="postgres",
        password=os.getenv("DB_PASSWORD")
    )

    connection.close()

    return {
        "message": "Database connected successfully"
    }


# =========================
# GET QUESTIONS
# =========================

@app.get("/questions")
def get_questions():

    connection = psycopg.connect(
        host="localhost",
        port=5432,
        dbname="edusync",
        user="postgres",
        password=os.getenv("DB_PASSWORD")
    )

    cursor = connection.cursor()

    cursor.execute("""
        SELECT
            q.question_id,
            q.question_text,
            q.difficulty,
            q.question_type,
            q.option_a,
            q.option_b,
            q.option_c,
            q.option_d,
            q.explanation,
            q.correct_answer,
            t.topic_id,
            t.name AS topic
        FROM questions q
        JOIN topics t
        ON q.topic_id = t.topic_id
        WHERE q.is_practice = FALSE
        ORDER BY q.question_id;
    """)

    rows = cursor.fetchall()

    cursor.close()
    connection.close()

    questions = []

    for row in rows:

        questions.append({
            "question_id": row[0],
            "question_text": row[1],
            "difficulty": row[2],
            "question_type": row[3],
            "option_a": row[4],
            "option_b": row[5],
            "option_c": row[6],
            "option_d": row[7],
            "correct_answer": row[8],
            "explanation": row[9],
            "topic": row[10]
        })

    return questions

@app.get("/practice/{topic_name}")
def get_practice_questions(topic_name: str):

    connection = psycopg.connect(
        host="localhost",
        port=5432,
        dbname="edusync",
        user="postgres",
        password=os.getenv("DB_PASSWORD")
    )

    cursor = connection.cursor()

    cursor.execute(
        """
        SELECT
            q.question_id,
            q.question_text,
            q.difficulty,
            q.question_type,
            q.option_a,
            q.option_b,
            q.option_c,
            q.option_d,
            q.correct_answer,
            t.topic_id,
            t.name AS topic
        FROM questions q
        JOIN topics t
            ON q.topic_id = t.topic_id
        WHERE LOWER(t.name) = LOWER(%s)
        AND q.is_practice = TRUE
        ORDER BY q.question_id
        LIMIT 5;
        """,
        (topic_name,)
    )

    rows = cursor.fetchall()

    cursor.close()
    connection.close()

    practice_questions = []

    for row in rows:
        practice_questions.append({
            "question_id": row[0],
            "question_text": row[1],
            "difficulty": row[2],
            "question_type": row[3],
            "option_a": row[4],
            "option_b": row[5],
            "option_c": row[6],
            "option_d": row[7],
            "correct_answer": row[8],
            "topic_id": row[9],
            "topic": row[10]
        })

    return practice_questions
# =========================
# QUIZ DATA MODELS
# =========================

class AnswerData(BaseModel):
    question_id: int
    selected_answer: str
    response_time_seconds: int


class QuizSubmission(BaseModel):
    student_id: int
    topic_id: int
    answers: List[AnswerData]


# =========================
# SUBMIT QUIZ
# =========================

@app.post("/submit-quiz")
def submit_quiz(data: QuizSubmission):

    conn = psycopg.connect(
        host="localhost",
        dbname="edusync",
        user="postgres",
        password=os.getenv("DB_PASSWORD")
    )

    try:

        cur = conn.cursor()

        # Create quiz attempt
        cur.execute(
            """
            INSERT INTO quiz_attempts
            (student_id, topic_id, started_at, completed_at, score)
            VALUES (%s, %s, NOW(), NOW(), 0)
            RETURNING attempt_id
            """,
            (data.student_id, data.topic_id)
        )

        attempt_id = cur.fetchone()[0]

        score = 0

        # Store every answer
        for answer in data.answers:

            cur.execute(
                """
                SELECT correct_answer
                FROM questions
                WHERE question_id = %s
                """,
                (answer.question_id,)
            )

            result = cur.fetchone()

            if result is None:
                continue

            correct_answer = result[0]

            is_correct = (
                answer.selected_answer == correct_answer
            )

            if is_correct:
                score += 1

            cur.execute(
                """
                INSERT INTO student_answers
                (
                    attempt_id,
                    question_id,
                    selected_answer,
                    is_correct,
                    response_time_seconds
                )
                VALUES (%s, %s, %s, %s, %s)
                """,
                (
                    attempt_id,
                    answer.question_id,
                    answer.selected_answer,
                    is_correct,
                    answer.response_time_seconds
                )
            )

        # Update final score
        cur.execute(
            """
            UPDATE quiz_attempts
            SET score = %s
            WHERE attempt_id = %s
            """,
            (score, attempt_id)
        )

        conn.commit()

        return {
            "message": "Quiz submitted successfully",
            "attempt_id": attempt_id,
            "score": score,
            "total_questions": len(data.answers)
        }

    except Exception as e:

        conn.rollback()

        print("SUBMIT QUIZ ERROR:", e)

        raise HTTPException(
            status_code=500,
            detail=str(e)
        )

    finally:

        conn.close()


# =========================
# PERFORMANCE ANALYSIS
# =========================

@app.get("/performance-analysis/{student_id}")
def performance_analysis(student_id: int):

    conn = psycopg.connect(
        host="localhost",
        dbname="edusync",
        user="postgres",
        password=os.getenv("DB_PASSWORD")
    )

    try:

        cur = conn.cursor()

        # Get latest quiz attempt
        cur.execute(
            """
            SELECT attempt_id, score
            FROM quiz_attempts
            WHERE student_id = %s
            ORDER BY attempt_id DESC
            LIMIT 1
            """,
            (student_id,)
        )

        attempt = cur.fetchone()

        if attempt is None:

            return {
                "message": "No quiz attempt found"
            }

        attempt_id = attempt[0]
        score = attempt[1]

        # =========================
        # TOPIC-WISE PERFORMANCE
        # =========================

        cur.execute(
            """
            SELECT
                t.name,
                COUNT(sa.answer_id) AS total_questions,
                SUM(
                    CASE
                        WHEN sa.is_correct
                        THEN 1
                        ELSE 0
                    END
                ) AS correct_answers,
                ROUND(
                    AVG(sa.response_time_seconds),
                    2
                ) AS average_response_time

            FROM student_answers sa

            JOIN questions q
                ON sa.question_id = q.question_id

            JOIN topics t
                ON q.topic_id = t.topic_id

            WHERE sa.attempt_id = %s

            GROUP BY
                t.topic_id,
                t.name

            ORDER BY
                (
                    SUM(
                        CASE
                            WHEN sa.is_correct
                            THEN 1
                            ELSE 0
                        END
                    )::float
                    /
                    COUNT(sa.answer_id)
                )
            ASC
            """,
            (attempt_id,)
        )

        topic_results = cur.fetchall()

        topics = []

        for row in topic_results:

            topic_name = row[0]
            total_questions = row[1]
            correct_answers = row[2]
            average_time = row[3]

            accuracy = round(
                (correct_answers / total_questions) * 100,
                2
            )

            topics.append({
                "topic": topic_name,
                "accuracy": accuracy,
                "correct": correct_answers,
                "total": total_questions,
                "average_response_time": average_time
            })


        # =========================
        # WEAK TOPIC ANALYSIS
        # =========================

        weak_topic = None
        recommendation = None

        if topics:

            # Find lowest accuracy
            lowest_accuracy = min(
                topic["accuracy"]
                for topic in topics
            )

            # ---------------------------------
            # CASE 1: Accuracy weakness
            # ---------------------------------

            if lowest_accuracy < 100:

                weak_candidates = [
                    topic
                    for topic in topics
                    if topic["accuracy"] == lowest_accuracy
                ]

                # If accuracy is tied,
                # use response time as secondary signal
                weak_topic = max(
                    weak_candidates,
                    key=lambda topic:
                    topic["average_response_time"]
                )

                recommendation = (
                    f"Practice more questions on "
                    f"{weak_topic['topic']} "
                    f"before moving to higher difficulty."
                )

            # ---------------------------------
            # CASE 2: All accuracy is 100%
            # Check response time
            # ---------------------------------

            else:

                # Find the topic with the highest
                # average response time
                slowest_topic = max(
                    topics,
                    key=lambda topic:
                    topic["average_response_time"]
                )

                # Prototype fluency threshold
                # This is configurable for the project.
                FLUENCY_THRESHOLD = 20

                if (
                    slowest_topic["average_response_time"]
                    > FLUENCY_THRESHOLD
                ):

                    weak_topic = slowest_topic

                    recommendation = (
                        f"{weak_topic['topic']} shows "
                        f"good accuracy but slower response time. "
                        f"Practice more timed questions to "
                        f"improve fluency."
                    )

                else:

                    recommendation = (
                        "No major weakness detected. "
                        "The student demonstrated strong "
                        "performance across the assessed topics."
                    )


        # =========================
        # FINAL RESPONSE
        # =========================

        return {
            "student_id": student_id,
            "attempt_id": attempt_id,
            "score": score,
            "topics": topics,
            "weak_topic": weak_topic,
            "recommendation": recommendation
        }


    except Exception as e:

        print(
            "PERFORMANCE ANALYSIS ERROR:",
            e
        )

        raise HTTPException(
            status_code=500,
            detail=str(e)
        )


    finally:

        conn.close()
        
@app.get("/student-progress/{student_id}")
def student_progress(student_id: int):

    conn = psycopg.connect(
        host="localhost",
        dbname="edusync",
        user="postgres",
        password=os.getenv("DB_PASSWORD")
    )

    try:
        cur = conn.cursor()

        # Get all quiz attempts
        cur.execute(
            """
            SELECT
                attempt_id,
                score,
                completed_at
            FROM quiz_attempts
            WHERE student_id = %s
            ORDER BY attempt_id ASC
            """,
            (student_id,)
        )

        attempts = cur.fetchall()

        if not attempts:
            return {
                "student_id": student_id,
                "total_attempts": 0,
                "average_score": 0,
                "latest_score": 0,
                "attempts": []
            }

        # Calculate average score
        scores = [row[1] for row in attempts]

        average_score = round(
            sum(scores) / len(scores),
            2
        )

        latest_score = attempts[-1][1]

        attempt_data = []

        for row in attempts:
            attempt_data.append({
                "attempt_id": row[0],
                "score": row[1],
                "completed_at": row[2]
            })

        return {
            "student_id": student_id,
            "total_attempts": len(attempts),
            "average_score": average_score,
            "latest_score": latest_score,
            "attempts": attempt_data
        }

    except Exception as e:

        print("STUDENT PROGRESS ERROR:", e)

        raise HTTPException(
            status_code=500,
            detail=str(e)
        )

    finally:
        conn.close()
@app.get("/student-topic-progress/{student_id}")
def student_topic_progress(student_id: int):

    conn = psycopg.connect(
        host="localhost",
        dbname="edusync",
        user="postgres",
        password=os.getenv("DB_PASSWORD")
    )

    try:
        cur = conn.cursor()

        cur.execute(
            """
            SELECT
                t.name AS topic,
                COUNT(sa.answer_id) AS questions_attempted,
                SUM(CASE WHEN sa.is_correct = TRUE THEN 1 ELSE 0 END) AS correct_answers
            FROM student_answers sa
            JOIN questions q
                ON sa.question_id = q.question_id
            JOIN topics t
                ON q.topic_id = t.topic_id
            JOIN quiz_attempts qa
                ON sa.attempt_id = qa.attempt_id
            WHERE qa.student_id = %s
            GROUP BY t.name
            ORDER BY t.name
            """,
            (student_id,)
        )

        rows = cur.fetchall()

        topic_progress = []

        for row in rows:

            topic = row[0]
            attempted = row[1]
            correct = row[2] or 0

            accuracy = round(
                (correct / attempted) * 100,
                2
            ) if attempted > 0 else 0

            topic_progress.append({
                "topic": topic,
                "questions_attempted": attempted,
                "correct_answers": correct,
                "accuracy": accuracy
            })

        return {
            "student_id": student_id,
            "topics": topic_progress
        }

    except Exception as e:
        print("TOPIC PROGRESS ERROR:", e)

        raise HTTPException(
            status_code=500,
            detail=str(e)
        )

    finally:
        conn.close()
        
@app.post("/practice-attempt")
def save_practice_attempt(data: dict):

    conn = psycopg.connect(
        host="localhost",
        dbname="edusync",
        user="postgres",
        password=os.getenv("DB_PASSWORD")
    )

    try:
        cur = conn.cursor()

        student_id = data["student_id"]
        topic_id = data["topic_id"]
        score = data["score"]
        total_questions = data["total_questions"]
        accuracy = data["accuracy"]

        cur.execute(
            """
            INSERT INTO practice_attempts
            (
                student_id,
                topic_id,
                score,
                total_questions,
                accuracy
            )
            VALUES (%s, %s, %s, %s, %s)
            RETURNING practice_attempt_id
            """,
            (
                student_id,
                topic_id,
                score,
                total_questions,
                accuracy
            )
        )

        practice_attempt_id = cur.fetchone()[0]

        conn.commit()

        return {
            "message": "Practice attempt saved successfully",
            "practice_attempt_id": practice_attempt_id
        }

    except Exception as e:
        conn.rollback()

        print("PRACTICE ATTEMPT ERROR:", e)

        raise HTTPException(
            status_code=500,
            detail=str(e)
        )

    finally:
        conn.close()    