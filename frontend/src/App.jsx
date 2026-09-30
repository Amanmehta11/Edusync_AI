import { useEffect, useState } from "react";

function App() {
  // =========================
  // NORMAL QUIZ STATES
  // =========================
  const [questions, setQuestions] = useState([]);
  const [currentQuestion, setCurrentQuestion] = useState(0);
  const [answers, setAnswers] = useState({});
  const [responseTimes, setResponseTimes] = useState({});
  const [questionStartTime, setQuestionStartTime] = useState(null);

  const [loading, setLoading] = useState(true);
  const [score, setScore] = useState(null);
  const [analysis, setAnalysis] = useState(null);

  // =========================
  // PROGRESS STATES
  // =========================
  const [progress, setProgress] = useState(null);
  const [showProgress, setShowProgress] = useState(false);
  const [topicProgress, setTopicProgress] = useState(null);

  // =========================
  // PRACTICE STATES
  // =========================
  const [practiceQuestions, setPracticeQuestions] = useState([]);
  const [practiceMode, setPracticeMode] = useState(false);
  const [practiceQuestion, setPracticeQuestion] = useState(0);
  const [practiceAnswers, setPracticeAnswers] = useState({});
  const [practiceScore, setPracticeScore] = useState(null);

 // =========================
// LOAD NORMAL QUIZ
// =========================

useEffect(() => {
  fetch("http://127.0.0.1:8000/questions")
    .then((response) => {
      if (!response.ok) {
        throw new Error("Failed to fetch questions");
      }

      return response.json();
    })
    .then((data) => {
      // Save questions locally for offline use
      localStorage.setItem(
        "edusync_questions",
        JSON.stringify(data)
      );

      setQuestions(data);
      setLoading(false);

      // Start timer for first question
      setQuestionStartTime(Date.now());

      console.log("Questions loaded from backend and cached locally.");
    })
    .catch((error) => {
      console.log(
        "Backend unavailable. Trying cached questions..."
      );

      // Try loading previously cached questions
      const cachedQuestions = localStorage.getItem(
        "edusync_questions"
      );

      if (cachedQuestions) {
        const data = JSON.parse(cachedQuestions);

        setQuestions(data);
        setLoading(false);
        setQuestionStartTime(Date.now());

        console.log("Questions loaded from local cache.");
      } else {
        console.error("No cached questions available.", error);
        setLoading(false);
      }
    });
}, []);

  // =========================
  // NORMAL QUIZ - SELECT ANSWER
  // =========================
  const handleAnswer = (selectedAnswer) => {
    const question = questions[currentQuestion];

    if (!question) return;

    const now = Date.now();

    const responseTime = questionStartTime
      ? Math.round((now - questionStartTime) / 1000)
      : 0;

    setAnswers((prev) => ({
      ...prev,
      [question.question_id]: selectedAnswer,
    }));

    setResponseTimes((prev) => ({
      ...prev,
      [question.question_id]: responseTime,
    }));
  };

  // =========================
  // NORMAL QUIZ - NEXT
  // =========================
  const nextQuestion = () => {
    const question = questions[currentQuestion];

    if (!question || !answers[question.question_id]) {
      alert("Please select an answer first.");
      return;
    }

    if (currentQuestion < questions.length - 1) {
      setCurrentQuestion((prev) => prev + 1);
      setQuestionStartTime(Date.now());
    }
  };

  // =========================
  // NORMAL QUIZ - PREVIOUS
  // =========================
  const previousQuestion = () => {
    if (currentQuestion > 0) {
      setCurrentQuestion((prev) => prev - 1);
      setQuestionStartTime(Date.now());
    }
  };

  // =========================
  // START RECOMMENDED PRACTICE
  // =========================
  const startPractice = async () => {
    if (!analysis?.weak_topic) return;

    const topic = analysis.weak_topic.topic;

    try {
      const response = await fetch(
        `http://127.0.0.1:8000/practice/${encodeURIComponent(topic)}`
      );

      const data = await response.json();

      if (!response.ok) {
        console.error(data);
        alert("Could not load recommended practice.");
        return;
      }

      if (!Array.isArray(data) || data.length === 0) {
        alert("No practice questions available for this topic.");
        return;
      }

      console.log("Practice Questions:", data);

      setPracticeQuestions(data);
      setPracticeQuestion(0);
      setPracticeAnswers({});
      setPracticeScore(null);
      setPracticeMode(true);
    } catch (error) {
      console.error("Error loading practice questions:", error);
      alert("Could not load recommended practice.");
    }
  };

  // =========================
  // PRACTICE - SELECT ANSWER
  // =========================
  const handlePracticeAnswer = (selectedAnswer) => {
    const question = practiceQuestions[practiceQuestion];

    if (!question) return;

    setPracticeAnswers((prev) => ({
      ...prev,
      [question.question_id]: selectedAnswer,
    }));
  };

  // =========================
  // PRACTICE - NEXT
  // =========================
  const nextPracticeQuestion = () => {
    const question = practiceQuestions[practiceQuestion];

    if (!question || !practiceAnswers[question.question_id]) {
      alert("Please select an answer first.");
      return;
    }

    if (practiceQuestion < practiceQuestions.length - 1) {
      setPracticeQuestion((prev) => prev + 1);
    }
  };

  // =========================
  // PRACTICE - PREVIOUS
  // =========================
  const previousPracticeQuestion = () => {
    if (practiceQuestion > 0) {
      setPracticeQuestion((prev) => prev - 1);
    }
  };

  // =========================
  // FINISH PRACTICE
  // =========================
  const finishPractice = async (lastSelectedAnswer) => {
    // Include the answer currently selected on the last question.
    // This avoids a stale React state value if the user clicks
    // the option and immediately clicks Finish Practice.
    const finalAnswers = {
      ...practiceAnswers,
    };

    const currentPracticeQuestion =
      practiceQuestions[practiceQuestion];

    if (currentPracticeQuestion && lastSelectedAnswer) {
      finalAnswers[currentPracticeQuestion.question_id] =
        lastSelectedAnswer;
    }

    // Check that every practice question has an answer.
    const unansweredQuestion = practiceQuestions.find(
      (question) => !finalAnswers[question.question_id]
    );

    if (unansweredQuestion) {
      alert("Please answer all practice questions first.");
      return;
    }

    let finalPracticeScore = 0;

    practiceQuestions.forEach((question) => {
      if (
        finalAnswers[question.question_id] ===
        question.correct_answer
      ) {
        finalPracticeScore++;
      }
    });

    const accuracy =
  practiceQuestions.length > 0
    ? Math.round(
        (finalPracticeScore / practiceQuestions.length) * 100
      )
    : 0;

const topicId = practiceQuestions[0]?.topic_id;

try {
  const response = await fetch(
    "http://127.0.0.1:8000/practice-attempt",
    {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        student_id: 1,
        topic_id: topicId,
        score: finalPracticeScore,
        total_questions: practiceQuestions.length,
        accuracy: accuracy,
      }),
    }
  );

  const data = await response.json();

  if (!response.ok) {
    console.error(data);
    alert("Practice result could not be saved.");
    return;
  }

  console.log("Practice result saved:", data);

  setPracticeAnswers(finalAnswers);
  setPracticeScore(finalPracticeScore);
  setPracticeMode(false);

} catch (error) {
  console.error("Practice save error:", error);
  alert("Could not save practice result.");
  return;
}
  };

  // =========================
  // SUBMIT NORMAL QUIZ
  // =========================
  const submitQuiz = async () => {
    const question = questions[currentQuestion];

    if (!question || !answers[question.question_id]) {
      alert("Please select an answer first.");
      return;
    }

    const finalResponseTime = questionStartTime
      ? Math.round((Date.now() - questionStartTime) / 1000)
      : 0;

    const finalResponseTimes = {
      ...responseTimes,
      [question.question_id]: finalResponseTime,
    };

    setResponseTimes(finalResponseTimes);

    const quizAnswers = questions.map((quizQuestion) => ({
      question_id: quizQuestion.question_id,
      selected_answer: answers[quizQuestion.question_id] || "",
      response_time_seconds:
        finalResponseTimes[quizQuestion.question_id] || 0,
    }));

    try {
      const response = await fetch("http://127.0.0.1:8000/submit-quiz", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          student_id: 1,
          topic_id: 2,
          answers: quizAnswers,
        }),
      });

      const data = await response.json();

      console.log("Quiz submission:", data);

      if (!response.ok) {
        console.error(data);
        alert("Quiz submission failed. Check backend terminal.");
        return;
      }

      setScore(data.score);

      const analysisResponse = await fetch(
        "http://127.0.0.1:8000/performance-analysis/1"
      );

      const analysisData = await analysisResponse.json();

      console.log("Performance Analysis:", analysisData);

      if (!analysisResponse.ok) {
        console.error(analysisData);
        alert("Could not load performance analysis.");
        return;
      }

      setAnalysis(analysisData);
    } catch (error) {
      console.error("Error submitting quiz:", error);
      alert("Could not connect to backend.");
    }
  };

  // =========================
  // LOAD STUDENT PROGRESS
  // =========================
  const loadProgress = async () => {
    try {
      const response = await fetch(
        "http://127.0.0.1:8000/student-progress/1"
      );

      const data = await response.json();

      if (!response.ok) {
        throw new Error("Could not load overall progress");
      }

      setProgress(data);

      const topicResponse = await fetch(
        "http://127.0.0.1:8000/student-topic-progress/1"
      );

      const topicData = await topicResponse.json();

      if (!topicResponse.ok) {
        throw new Error("Could not load topic progress");
      }

      setTopicProgress(topicData);
      setShowProgress(true);
    } catch (error) {
      console.error("Progress error:", error);
      alert("Could not load student progress.");
    }
  };

  // =========================
  // LOADING
  // =========================
  if (loading) {
    return <h2>Loading questions...</h2>;
  }

  // =========================
  // NO QUESTIONS
  // =========================
  if (questions.length === 0) {
    return <h2>No questions available.</h2>;
  }

  // =====================================================
  // PRACTICE SCREEN
  // =====================================================
  if (practiceMode && practiceQuestions.length > 0) {
    const question = practiceQuestions[practiceQuestion];
    const selectedAnswer = practiceAnswers[question.question_id];

    return (
      <div
        style={{
          maxWidth: "800px",
          margin: "40px auto",
          padding: "20px",
          fontFamily: "Arial",
        }}
      >
        <h1>EduSync AI</h1>

        <h2>🧠 Recommended Practice</h2>

        <p>
          Topic: <strong>{question.topic}</strong>
        </p>

        <p>
          Practice Question {practiceQuestion + 1} of{" "}
          {practiceQuestions.length}
        </p>

        <hr />

        <h3>{question.question_text}</h3>

        <div style={{ marginTop: "25px" }}>
          <button
            onClick={() => handlePracticeAnswer(question.option_a)}
            style={{
              display: "block",
              width: "100%",
              padding: "15px",
              marginBottom: "12px",
              cursor: "pointer",
              textAlign: "left",
              border:
                selectedAnswer === question.option_a
                  ? "3px solid #2563eb"
                  : "1px solid #ccc",
              background:
                selectedAnswer === question.option_a ? "#eaf2ff" : "white",
              borderRadius: "8px",
              fontSize: "16px",
            }}
          >
            A. {question.option_a}
          </button>

          <button
            onClick={() => handlePracticeAnswer(question.option_b)}
            style={{
              display: "block",
              width: "100%",
              padding: "15px",
              marginBottom: "12px",
              cursor: "pointer",
              textAlign: "left",
              border:
                selectedAnswer === question.option_b
                  ? "3px solid #2563eb"
                  : "1px solid #ccc",
              background:
                selectedAnswer === question.option_b ? "#eaf2ff" : "white",
              borderRadius: "8px",
              fontSize: "16px",
            }}
          >
            B. {question.option_b}
          </button>

          <button
            onClick={() => handlePracticeAnswer(question.option_c)}
            style={{
              display: "block",
              width: "100%",
              padding: "15px",
              marginBottom: "12px",
              cursor: "pointer",
              textAlign: "left",
              border:
                selectedAnswer === question.option_c
                  ? "3px solid #2563eb"
                  : "1px solid #ccc",
              background:
                selectedAnswer === question.option_c ? "#eaf2ff" : "white",
              borderRadius: "8px",
              fontSize: "16px",
            }}
          >
            C. {question.option_c}
          </button>

          <button
            onClick={() => handlePracticeAnswer(question.option_d)}
            style={{
              display: "block",
              width: "100%",
              padding: "15px",
              marginBottom: "12px",
              cursor: "pointer",
              textAlign: "left",
              border:
                selectedAnswer === question.option_d
                  ? "3px solid #2563eb"
                  : "1px solid #ccc",
              background:
                selectedAnswer === question.option_d ? "#eaf2ff" : "white",
              borderRadius: "8px",
              fontSize: "16px",
            }}
          >
            D. {question.option_d}
          </button>
        </div>

        <hr />

        <div style={{ display: "flex", gap: "10px" }}>
          {practiceQuestion > 0 && (
            <button onClick={previousPracticeQuestion}>Previous</button>
          )}

          {practiceQuestion < practiceQuestions.length - 1 && (
            <button onClick={nextPracticeQuestion}>Next</button>
          )}

          {practiceQuestion === practiceQuestions.length - 1 && (
            <button
              onClick={() => finishPractice(selectedAnswer)}
            >
              Finish Practice
            </button>
          )}
        </div>
      </div>
    );
  }

  // =====================================================
  // NORMAL QUIZ + RESULT SCREEN
  // =====================================================
  const question = questions[currentQuestion];

  return (
    <div
      style={{
        maxWidth: "800px",
        margin: "40px auto",
        padding: "20px",
        fontFamily: "Arial",
      }}
    >
      {/* =====================================================
          NORMAL QUIZ
      ===================================================== */}
      {score === null && (
        <>
          <h1>EduSync AI</h1>

          <h2>Adaptive Quiz</h2>

          <p>
            Question {currentQuestion + 1} of {questions.length}
          </p>

          <hr />

          <h3>{question.question_text}</h3>

          <div>
            <label>
              <input
                type="radio"
                name="answer"
                checked={answers[question.question_id] === question.option_a}
                onChange={() => handleAnswer(question.option_a)}
              />{" "}
              A. {question.option_a}
            </label>

            <br />
            <br />

            <label>
              <input
                type="radio"
                name="answer"
                checked={answers[question.question_id] === question.option_b}
                onChange={() => handleAnswer(question.option_b)}
              />{" "}
              B. {question.option_b}
            </label>

            <br />
            <br />

            <label>
              <input
                type="radio"
                name="answer"
                checked={answers[question.question_id] === question.option_c}
                onChange={() => handleAnswer(question.option_c)}
              />{" "}
              C. {question.option_c}
            </label>

            <br />
            <br />

            <label>
              <input
                type="radio"
                name="answer"
                checked={answers[question.question_id] === question.option_d}
                onChange={() => handleAnswer(question.option_d)}
              />{" "}
              D. {question.option_d}
            </label>
          </div>

          {responseTimes[question.question_id] !== undefined && (
            <p>
              Response time: {responseTimes[question.question_id]} seconds
            </p>
          )}

          <hr />

          <div>
            {currentQuestion > 0 && (
              <button onClick={previousQuestion}>Previous</button>
            )}{" "}

            {currentQuestion < questions.length - 1 && (
              <button onClick={nextQuestion}>Next</button>
            )}

            {currentQuestion === questions.length - 1 && (
              <button onClick={submitQuiz}>Submit Quiz</button>
            )}
          </div>
        </>
      )}

      {/* =====================================================
          RESULT
      ===================================================== */}
      {score !== null && (
        <div>
          <h1>EduSync AI</h1>

          <h2>Your Score: {score} / {questions.length}</h2>

          {analysis && (
            <>
              <h2>Performance Analysis</h2>

              <h3>Topic Performance</h3>

              {analysis.topics.map((topic) => (
                <div key={topic.topic}>
                  <p>
                    <strong>{topic.topic}</strong>
                  </p>

                  <p>Accuracy: {topic.accuracy}%</p>

                  <p>
                    Correct: {topic.correct} / {topic.total}
                  </p>

                  <p>
                    Average Response Time:{" "}
                    {topic.average_response_time} seconds
                  </p>

                  <hr />
                </div>
              ))}

              {/* =========================
                  WEAK TOPIC / RECOMMENDATION
              ========================= */}
              {analysis.weak_topic ? (
                <div>
                  <h3>Weak Topic: {analysis.weak_topic.topic}</h3>

                  <p>Accuracy: {analysis.weak_topic.accuracy}%</p>

                  <p>
                    Average Response Time:{" "}
                    {analysis.weak_topic.average_response_time} seconds
                  </p>

                  <p>
                    <strong>Recommendation:</strong>{" "}
                    {analysis.recommendation}
                  </p>

                  <div
                    style={{
                      marginTop: "20px",
                      padding: "20px",
                      border: "1px solid #ddd",
                      borderRadius: "10px",
                    }}
                  >
                    <h3>🧠 Recommended Practice</h3>

                    <p>
                      Practice questions selected for your weak topic:
                    </p>

                    <p>
                      <strong>{analysis.weak_topic.topic}</strong>
                    </p>

                    <button onClick={startPractice}>
                      Start Recommended Practice
                    </button>
                  </div>
                </div>
              ) : (
                <div>
                  <h3>🎉 No Major Weakness Detected</h3>

                  <p>
                    <strong>Recommendation:</strong>{" "}
                    {analysis.recommendation}
                  </p>
                </div>
              )}
            </>
          )}

          {/* =====================================================
              PRACTICE COMPLETED
              IMPORTANT: OUTSIDE analysis && SO IT ALWAYS SHOWS
          ===================================================== */}
          {practiceScore !== null && (
            <div
              style={{
                marginTop: "20px",
                marginBottom: "20px",
                padding: "20px",
                border: "1px solid #ddd",
                borderRadius: "10px",
                background: "#f8fafc",
              }}
            >
              <h3>🧠 Practice Completed</h3>

              <p>
                Practice Topic:{" "}
                <strong>{analysis?.weak_topic?.topic || "Recommended Topic"}</strong>
              </p>

              <p>
                Practice Score:{" "}
                <strong>
                  {practiceScore} / {practiceQuestions.length}
                </strong>
              </p>

              <p>
                Practice Accuracy:{" "}
                <strong>
                  {practiceQuestions.length > 0
                    ? Math.round(
                        (practiceScore / practiceQuestions.length) * 100
                      )
                    : 0}
                  %
                </strong>
              </p>

              {practiceScore === practiceQuestions.length ? (
                <p>
                  🎉 Excellent! You answered all practice questions correctly.
                </p>
              ) : (
                <p>Keep practicing this topic to improve your mastery.</p>
              )}
            </div>
          )}

          {/* =====================================================
              STUDENT PROGRESS
          ===================================================== */}
          <button
            onClick={loadProgress}
            style={{
              padding: "12px 20px",
              marginTop: "15px",
              cursor: "pointer",
            }}
          >
            📊 View My Progress
          </button>

          {showProgress && progress && (
            <div
              style={{
                marginTop: "30px",
                padding: "25px",
                border: "1px solid #ddd",
                borderRadius: "12px",
                background: "#fafafa",
              }}
            >
              <h2>📊 Student Progress</h2>

              <div style={{ marginTop: "15px" }}>
                <p>
                  <strong>Quizzes Attempted:</strong>{" "}
                  {progress.total_attempts}
                </p>

                <p>
                  <strong>Average Score:</strong>{" "}
                  {progress.average_score}
                </p>

                <p>
                  <strong>Latest Score:</strong>{" "}
                  {progress.latest_score}
                </p>
              </div>

              <h3 style={{ marginTop: "25px" }}>Quiz History</h3>

              {progress.attempts.map((attempt) => (
                <div
                  key={attempt.attempt_id}
                  style={{
                    padding: "12px",
                    marginTop: "10px",
                    border: "1px solid #ddd",
                    borderRadius: "8px",
                    background: "white",
                  }}
                >
                  <strong>Quiz {attempt.attempt_id}</strong>
                  <p>Score: {attempt.score}</p>
                </div>
              ))}

              {topicProgress && (
                <div style={{ marginTop: "30px" }}>
                  <h3>📚 Topic-wise Progress</h3>

                  {topicProgress.topics.map((topic) => (
                    <div
                      key={topic.topic}
                      style={{
                        padding: "15px",
                        marginTop: "10px",
                        border: "1px solid #ddd",
                        borderRadius: "8px",
                        background: "white",
                      }}
                    >
                      <h4>{topic.topic}</h4>

                      <p>
                        Questions Attempted:{" "}
                        {topic.questions_attempted}
                      </p>

                      <p>
                        Correct Answers:{" "}
                        {topic.correct_answers}
                      </p>

                      <p>
                        Accuracy:{" "}
                        <strong>{topic.accuracy}%</strong>
                      </p>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

export default App;
