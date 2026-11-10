import { useEffect, useState } from "react";

import "./App.css";
import Login from "./login";

import {
  savePendingAttempt,
  getPendingAttempts,
  deletePendingAttempt,
} from "./offlineDB";

function App() {
  const [isOnline, setIsOnline] = useState(navigator.onLine);
  const [student, setStudent] = useState(null);

  // =====================================================

  // NORMAL QUIZ STATES

  // =====================================================

  const [questions, setQuestions] = useState([]);

  const [currentQuestion, setCurrentQuestion] = useState(0);

  const [answers, setAnswers] = useState({});

  const [responseTimes, setResponseTimes] = useState({});

  const [questionStartTime, setQuestionStartTime] = useState(null);

  const [loading, setLoading] = useState(true);

  const [score, setScore] = useState(null);

  const [analysis, setAnalysis] = useState(null);

  // =====================================================

  // PROGRESS STATES

  // =====================================================

  const [progress, setProgress] = useState(null);

  const [showProgress, setShowProgress] = useState(false);

  const [showAllAttempts, setShowAllAttempts] = useState(false);

  const [topicProgress, setTopicProgress] = useState(null);

  // =====================================================

  // PRACTICE STATES

  // =====================================================

  const [practiceQuestions, setPracticeQuestions] = useState([]);

  const [practiceMode, setPracticeMode] = useState(false);

  const [practiceQuestion, setPracticeQuestion] = useState(0);

  const [practiceAnswers, setPracticeAnswers] = useState({});

  const [practiceScore, setPracticeScore] = useState(null);

  // AI QUESTION GENERATOR STATES

  const [topics, setTopics] = useState([]);
  const [selectedTopic, setSelectedTopic] = useState("");
  const [difficulty, setDifficulty] = useState("Medium");
  const [questionCount, setQuestionCount] = useState(5);
  const [generating, setGenerating] = useState(false);
  const [assessmentStarted, setAssessmentStarted] = useState(false);

  // =====================================================

  // LOAD NORMAL QUIZ

  useEffect(() => {
    const loadQuestions = async () => {
      if (!navigator.onLine) {
        const cachedQuestions = localStorage.getItem(
          "edusync_assessment_questions",
        );

        if (cachedQuestions) {
          const data = JSON.parse(cachedQuestions);
          setQuestions(data);
        } else {
          const normalCache = localStorage.getItem("edusync_questions");

          if (normalCache) {
            setQuestions(JSON.parse(normalCache));
          }
        }

        setLoading(false);
        setQuestionStartTime(Date.now());
        return;
      }

      try {
        const [normalResponse, aiResponse] = await Promise.all([
          fetch("http://127.0.0.1:8000/questions"),
          fetch("http://127.0.0.1:8000/ai-questions"),
        ]);

        if (!normalResponse.ok) {
          throw new Error("Could not load normal questions.");
        }

        const normalQuestions = await normalResponse.json();

        let aiQuestions = [];

        if (aiResponse.ok) {
          aiQuestions = await aiResponse.json();
        }

        const combinedQuestions = [...normalQuestions, ...aiQuestions];

        localStorage.setItem(
          "edusync_questions",
          JSON.stringify(normalQuestions),
        );

        localStorage.setItem(
          "edusync_assessment_questions",
          JSON.stringify(combinedQuestions),
        );

        setQuestions(combinedQuestions);
        setLoading(false);
        setQuestionStartTime(Date.now());

        console.log("Normal and AI questions cached for offline assessments.");
      } catch (error) {
        console.error("Question loading error:", error);

        const cachedQuestions = localStorage.getItem(
          "edusync_assessment_questions",
        );

        if (cachedQuestions) {
          setQuestions(JSON.parse(cachedQuestions));
        } else {
          const normalCache = localStorage.getItem("edusync_questions");

          if (normalCache) {
            setQuestions(JSON.parse(normalCache));
          }
        }

        setLoading(false);
        setQuestionStartTime(Date.now());
      }
    };

    loadQuestions();
  }, []);

  // LOAD TOPICS FOR AI QUESTION GENERATOR

  useEffect(() => {
    const loadTopics = async () => {
      try {
        const response = await fetch("http://127.0.0.1:8000/topics");

        if (!response.ok) {
          throw new Error("Failed to load topics");
        }

        const data = await response.json();

        setTopics(data);

        if (data.length > 0) {
          setSelectedTopic(String(data[0].topic_id));
        }
      } catch (error) {
        console.error("Error loading topics:", error);
      }
    };

    loadTopics();
  }, []);

  // ONLINE / OFFLINE STATUS

  useEffect(() => {
    const handleOnline = () => {
      setIsOnline(true);
      console.log("Internet connection restored.");
    };

    const handleOffline = () => {
      setIsOnline(false);
      console.log("Offline mode enabled.");
    };

    window.addEventListener("online", handleOnline);
    window.addEventListener("offline", handleOffline);

    return () => {
      window.removeEventListener("online", handleOnline);
      window.removeEventListener("offline", handleOffline);
    };
  }, []);

  // =====================================================
  // AUTOMATIC OFFLINE-TO-ONLINE SYNCHRONIZATION
  // =====================================================

  const syncPendingAttempts = async () => {
    if (!student || !navigator.onLine) return;

    try {
      const pendingAttempts = await getPendingAttempts();

      // Only sync attempts belonging to the logged-in student
      const studentAttempts = pendingAttempts.filter(
        (attempt) => attempt.student_id === student.student_id,
      );

      if (studentAttempts.length === 0) return;

      console.log("Pending attempts found:", studentAttempts.length);

      let syncedCount = 0;
      let latestScore = null;

      for (const attempt of studentAttempts) {
        // Stop if internet disconnects during synchronization
        if (!navigator.onLine) break;

        try {
          const response = await fetch("http://127.0.0.1:8000/submit-quiz", {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
            },
            body: JSON.stringify({
              attempt_id: attempt.attempt_id,
              student_id: attempt.student_id,
              topic_id: attempt.topic_id,
              answers: attempt.answers,
            }),
          });

          const data = await response.json();

          if (!response.ok) {
            console.error("Sync failed:", data);
            break;
          }

          // Delete locally ONLY after server confirmation
          await deletePendingAttempt(attempt.attempt_id);

          latestScore = data.score;
          syncedCount++;

          console.log("Attempt synchronized:", attempt.attempt_id);
        } catch (error) {
          console.error("Attempt synchronization error:", error);
          break;
        }
      }

      if (syncedCount > 0) {
        console.log("Successfully synchronized:", syncedCount);

        alert(
          `${syncedCount} offline quiz attempt(s) synchronized successfully!`,
        );

        // Refresh performance analysis
        try {
          const analysisResponse = await fetch(
            `http://127.0.0.1:8000/performance-analysis/${student.student_id}`,
          );

          if (analysisResponse.ok) {
            const analysisData = await analysisResponse.json();
            setAnalysis(analysisData);
          }
        } catch (error) {
          console.error("Could not refresh analysis:", error);
        }

        if (latestScore !== null && score === null) {
          setScore(latestScore);
        }
      }
    } catch (error) {
      console.error("Could not retrieve pending attempts:", error);
    }
  };

  // Automatically sync when connectivity returns
  useEffect(() => {
    console.log("SYNC EFFECT TRIGGERED:", {
      isOnline,
      student: student,
    });

    if (isOnline && student) {
      console.log("Starting pending attempt synchronization...");
      syncPendingAttempts();
    }
  }, [isOnline, student]);

  // GENERATE AI QUESTIONS

  const generateAIQuestions = async () => {
    if (!isOnline) {
      alert("AI question generation requires an internet connection.");
      return;
    }

    if (!selectedTopic) {
      alert("Please select a topic.");
      return;
    }

    setGenerating(true);

    try {
      const response = await fetch("http://127.0.0.1:8000/generate-questions", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          topic_id: Number(selectedTopic),
          difficulty: difficulty,
          count: Number(questionCount),
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.detail || "Question generation failed.");
      }

      // Refresh normal and AI question banks
      const [normalResponse, aiResponse] = await Promise.all([
        fetch("http://127.0.0.1:8000/questions"),
        fetch("http://127.0.0.1:8000/ai-questions"),
      ]);

      if (!normalResponse.ok || !aiResponse.ok) {
        throw new Error("Questions generated, but refresh failed.");
      }

      const normalQuestions = await normalResponse.json();
      const aiQuestions = await aiResponse.json();

      const combinedQuestions = [...normalQuestions, ...aiQuestions];

      setQuestions(combinedQuestions);

      localStorage.setItem(
        "edusync_questions",
        JSON.stringify(normalQuestions),
      );

      localStorage.setItem(
        "edusync_assessment_questions",
        JSON.stringify(combinedQuestions),
      );

      alert(`${data.count} AI questions generated and added successfully!`);
    } catch (error) {
      console.error("AI generation error:", error);
      alert(error.message);
    } finally {
      setGenerating(false);
    }
  };

  // START TOPIC-BASED ASSESSMENT

  const startAssessment = async () => {
    if (!selectedTopic) {
      alert("Please select a topic.");
      return;
    }

    try {
      let assessmentQuestions = [];

      if (isOnline && navigator.onLine) {
        // ONLINE: Load 10 questions from backend
        const response = await fetch(
          `http://127.0.0.1:8000/assessment/${selectedTopic}`,
        );

        const data = await response.json();

        if (!response.ok) {
          throw new Error(data.detail || "Could not load assessment.");
        }

        assessmentQuestions = data;
      } else {
        // OFFLINE: Load cached normal + AI questions
        const cachedQuestions = localStorage.getItem(
          "edusync_assessment_questions",
        );

        if (!cachedQuestions) {
          throw new Error(
            "No cached assessment questions. Please connect to the internet first.",
          );
        }

        const allCachedQuestions = JSON.parse(cachedQuestions);

        const topicQuestions = allCachedQuestions.filter(
          (q) => Number(q.topic_id) === Number(selectedTopic),
        );

        // Randomly select 10 questions
        assessmentQuestions = topicQuestions
          .sort(() => Math.random() - 0.5)
          .slice(0, 10);

        if (assessmentQuestions.length < 10) {
          throw new Error(
            `Only ${assessmentQuestions.length} questions are cached for this topic. Connect to the internet to load more.`,
          );
        }
      }

      setQuestions(assessmentQuestions);
      setCurrentQuestion(0);
      setAnswers({});
      setResponseTimes({});
      setScore(null);
      setAnalysis(null);
      setQuestionStartTime(Date.now());
      setAssessmentStarted(true);

      alert("Your 10-question assessment is ready!");
    } catch (error) {
      console.error("Assessment loading error:", error);
      alert(error.message);
    }
  };

  // NORMAL QUIZ - SELECT ANSWER

  // =====================================================

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

  // =====================================================

  // NORMAL QUIZ - NEXT

  // =====================================================

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

  // =====================================================

  // NORMAL QUIZ - PREVIOUS

  // =====================================================

  const previousQuestion = () => {
    if (currentQuestion > 0) {
      setCurrentQuestion((prev) => prev - 1);

      setQuestionStartTime(Date.now());
    }
  };

  // =====================================================

  // START RECOMMENDED PRACTICE

  // =====================================================

  const startPractice = async () => {
    if (!analysis?.weak_topic) return;

    const topic = analysis.weak_topic.topic;

    try {
      const response = await fetch(
        `http://127.0.0.1:8000/practice/${encodeURIComponent(topic)}`,
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

  // =====================================================

  // PRACTICE - SELECT ANSWER

  // =====================================================

  const handlePracticeAnswer = (selectedAnswer) => {
    const question = practiceQuestions[practiceQuestion];

    if (!question) return;

    setPracticeAnswers((prev) => ({
      ...prev,

      [question.question_id]: selectedAnswer,
    }));
  };

  // =====================================================

  // PRACTICE - NEXT

  // =====================================================

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

  // =====================================================

  // PRACTICE - PREVIOUS

  // =====================================================

  const previousPracticeQuestion = () => {
    if (practiceQuestion > 0) {
      setPracticeQuestion((prev) => prev - 1);
    }
  };

  // =====================================================

  // FINISH PRACTICE

  // =====================================================

  const finishPractice = async (lastSelectedAnswer) => {
    // Include the answer currently selected on the last question.

    const finalAnswers = {
      ...practiceAnswers,
    };

    const currentPracticeQuestion = practiceQuestions[practiceQuestion];

    if (currentPracticeQuestion && lastSelectedAnswer) {
      finalAnswers[currentPracticeQuestion.question_id] = lastSelectedAnswer;
    }

    // Check that every practice question has an answer.

    const unansweredQuestion = practiceQuestions.find(
      (question) => !finalAnswers[question.question_id],
    );

    if (unansweredQuestion) {
      alert("Please answer all practice questions first.");

      return;
    }

    let finalPracticeScore = 0;

    practiceQuestions.forEach((question) => {
      if (finalAnswers[question.question_id] === question.correct_answer) {
        finalPracticeScore++;
      }
    });

    const accuracy =
      practiceQuestions.length > 0
        ? Math.round((finalPracticeScore / practiceQuestions.length) * 100)
        : 0;

    const topicId = practiceQuestions[0]?.topic_id;

    try {
      const response = await fetch("http://127.0.0.1:8000/practice-attempt", {
        method: "POST",

        headers: {
          "Content-Type": "application/json",
        },

        body: JSON.stringify({
          student_id: student.student_id,

          topic_id: topicId,

          score: finalPracticeScore,

          total_questions: practiceQuestions.length,

          accuracy: accuracy,
        }),
      });

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

  // =====================================================

  // SUBMIT NORMAL QUIZ

  // =====================================================

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
      response_time_seconds: finalResponseTimes[quizQuestion.question_id] || 0,
    }));

    const attempt = {
      attempt_id: crypto.randomUUID(),
      student_id: student.student_id,
      topic_id: questions[0].topic_id,
      answers: quizAnswers,
      created_at: new Date().toISOString(),
      status: "pending",
    };

    // OFFLINE SUBMISSION
    if (!isOnline || !navigator.onLine) {
      try {
        await savePendingAttempt(attempt);

        console.log("Offline quiz saved:", attempt);

        alert(
          "Assessment saved offline! It will automatically sync when internet connection is restored.",
        );

        return;
      } catch (error) {
        console.error("Offline save failed:", error);

        alert("Could not save your assessment offline. Please try again.");

        return;
      }
    }

    // ONLINE SUBMISSION
    try {
      const response = await fetch("http://127.0.0.1:8000/submit-quiz", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          attempt_id: attempt.attempt_id,
          student_id: attempt.student_id,
          topic_id: attempt.topic_id,
          answers: attempt.answers,
        }),
      });

      const data = await response.json();

      console.log("Quiz submission:", data);

      if (!response.ok) {
        throw new Error(data.detail || "Quiz submission failed.");
      }

      setScore(data.score);

      const analysisResponse = await fetch(
        `http://127.0.0.1:8000/performance-analysis/${student.student_id}`,
      );

      const analysisData = await analysisResponse.json();

      if (!analysisResponse.ok) {
        throw new Error("Could not load performance analysis.");
      }

      setAnalysis(analysisData);

      console.log("Performance Analysis:", analysisData);
    } catch (error) {
      console.error("Quiz submission error:", error);

      try {
        await savePendingAttempt(attempt);

        alert(
          "Connection lost. Your assessment has been saved locally and is waiting to sync.",
        );
      } catch (saveError) {
        console.error("Could not save pending attempt:", saveError);

        alert("Submission failed and local saving also failed.");
      }
    }
  };

  // =====================================================

  // LOAD STUDENT PROGRESS

  // =====================================================

  const loadProgress = async () => {
    try {
      const response = await fetch(
        `http://127.0.0.1:8000/student-progress/${student.student_id}`,
      );

      const data = await response.json();

      if (!response.ok) {
        throw new Error("Could not load overall progress");
      }

      setProgress(data);

      const topicResponse = await fetch(
        `http://127.0.0.1:8000/student-topic-progress/${student.student_id}`,
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

  // =====================================================

  // LOADING

  // =====================================================

  if (!student) {
    return <Login onLogin={setStudent} />;
  }

  if (loading) {
    return (
      <div className="loading-screen">
        <h2>Loading your learning session...</h2>
      </div>
    );
  }

  // =====================================================

  // NO QUESTIONS

  // =====================================================

  if (questions.length === 0) {
    return (
      <div className="loading-screen">
        <h2>No questions available.</h2>
      </div>
    );
  }

  // =====================================================

  // PRACTICE SCREEN

  // =====================================================

  if (practiceMode && practiceQuestions.length > 0) {
    const question = practiceQuestions[practiceQuestion];

    const selectedAnswer = practiceAnswers[question.question_id];

    return (
      <div className="practice-page">
        <div className="practice-container">
          <div className="edusync-brand">
            <div>
              <h1>EduSync AI</h1>

              <span>Personalized practice</span>
            </div>

            <span>Practice</span>
          </div>

          <div className="quiz-card">
            <span className="quiz-label">Recommended Practice</span>

            <p className="quiz-progress">
              {question.topic} · Question {practiceQuestion + 1} of{" "}
              {practiceQuestions.length}
            </p>

            {/* Practice progress bar */}

            <div
              style={{
                width: "100%",

                height: "5px",

                background: "var(--surface-soft)",

                borderRadius: "10px",

                overflow: "hidden",

                marginBottom: "28px",
              }}
            >
              <div
                style={{
                  width: `${
                    ((practiceQuestion + 1) / practiceQuestions.length) * 100
                  }%`,

                  height: "100%",

                  background: "var(--accent)",

                  borderRadius: "10px",

                  transition: "width 0.3s ease",
                }}
              />
            </div>

            <h2 className="quiz-question">{question.question_text}</h2>

            <div className="answer-list">
              {[
                ["A", question.option_a],

                ["B", question.option_b],

                ["C", question.option_c],

                ["D", question.option_d],
              ].map(([letter, option]) => (
                <button
                  key={letter}
                  type="button"
                  className={`answer-option ${
                    selectedAnswer === option ? "selected" : ""
                  }`}
                  onClick={() => handlePracticeAnswer(option)}
                >
                  <span className="answer-letter">{letter}</span>

                  <span>{option}</span>
                </button>
              ))}
            </div>

            <div className="quiz-actions">
              {practiceQuestion > 0 ? (
                <button
                  className="btn btn-secondary"
                  onClick={previousPracticeQuestion}
                >
                  ← Previous
                </button>
              ) : (
                <span />
              )}

              {practiceQuestion < practiceQuestions.length - 1 ? (
                <button
                  className="btn btn-primary"
                  onClick={nextPracticeQuestion}
                >
                  Next →
                </button>
              ) : (
                <button
                  className="btn btn-primary"
                  onClick={() => finishPractice(selectedAnswer)}
                >
                  Finish Practice →
                </button>
              )}
            </div>
          </div>
        </div>
      </div>
    );
  }

  // =====================================================

  // NORMAL QUIZ + RESULT SCREEN

  // =====================================================

  const question = questions[currentQuestion];

  return (
    <div className="edusync-app">
      <div className="edusync-container">
        {/* =====================================================

            NORMAL QUIZ

        ===================================================== */}

        {score === null && (
          <>
            <div className="edusync-brand">
              <div>
                <h1>EduSync AI</h1>

                <span>Adaptive learning platform</span>
              </div>

              <span>Assessment</span>
            </div>

            {/* AI QUESTION GENERATOR */}

            <div className="quiz-card" style={{ marginBottom: "20px" }}>
              <span className="quiz-label">AI POWERED FEATURE</span>

              <h2 className="section-title">AI Question Generator</h2>

              <p>Generate additional questions using Gemini AI.</p>

              <label>Choose Topic</label>

              <select
                value={selectedTopic}
                onChange={(e) => setSelectedTopic(e.target.value)}
                style={{
                  width: "100%",
                  padding: "12px",
                  margin: "10px 0 18px",
                  borderRadius: "8px",
                }}
              >
                {topics.map((topic) => (
                  <option key={topic.topic_id} value={topic.topic_id}>
                    {topic.name}
                  </option>
                ))}
              </select>

              <label>Difficulty</label>

              <select
                value={difficulty}
                onChange={(e) => setDifficulty(e.target.value)}
                style={{
                  width: "100%",
                  padding: "12px",
                  margin: "10px 0 18px",
                  borderRadius: "8px",
                }}
              >
                <option value="Easy">Easy</option>
                <option value="Medium">Medium</option>
                <option value="Hard">Hard</option>
              </select>

              <label>Number of Questions</label>

              <select
                value={questionCount}
                onChange={(e) => setQuestionCount(Number(e.target.value))}
                style={{
                  width: "100%",
                  padding: "12px",
                  margin: "10px 0 18px",
                  borderRadius: "8px",
                }}
              >
                <option value={5}>5 Questions</option>
                <option value={10}>10 Questions</option>
              </select>

              <button
                className="btn btn-primary"
                onClick={generateAIQuestions}
                disabled={generating || !isOnline || topics.length === 0}
              >
                {generating
                  ? "Generating Questions..."
                  : "✨ Generate AI Questions"}
              </button>

              {!isOnline && (
                <p style={{ color: "var(--danger)" }}>
                  AI generation requires an internet connection.
                </p>
              )}
            </div>

            {/* TOPIC-BASED ASSESSMENT */}

            <div className="quiz-card" style={{ marginBottom: "20px" }}>
              <span className="quiz-label">STUDENT ASSESSMENT</span>

              <h2 className="section-title">Choose Your Topic</h2>

              <select
                value={selectedTopic}
                onChange={(e) => setSelectedTopic(e.target.value)}
                style={{
                  width: "100%",
                  padding: "12px",
                  margin: "10px 0 18px",
                  borderRadius: "8px",
                }}
              >
                {topics.map((topic) => (
                  <option key={topic.topic_id} value={topic.topic_id}>
                    {topic.name}
                  </option>
                ))}
              </select>

              <p>
                Start an assessment containing 10 randomly selected questions.
              </p>

              <button
                className="btn btn-primary"
                onClick={startAssessment}
                disabled={!selectedTopic}
              >
                Start 10-Question Assessment →
              </button>
            </div>

            {assessmentStarted && (
              <div className="quiz-card">
                <div
                  style={{
                    display: "flex",

                    justifyContent: "space-between",

                    alignItems: "center",

                    marginBottom: "18px",
                  }}
                >
                  <span className="quiz-label">Adaptive Assessment</span>

                  <span
                    style={{
                      fontSize: "13px",

                      color: "var(--text-muted)",
                    }}
                  >
                    {questions.length > 0
                      ? Math.round(
                          ((currentQuestion + 1) / questions.length) * 100,
                        )
                      : 0}
                    %
                  </span>
                </div>

                {/* Progress bar */}

                <div
                  style={{
                    width: "100%",

                    height: "5px",

                    background: "var(--surface-soft)",

                    borderRadius: "10px",

                    overflow: "hidden",

                    marginBottom: "28px",
                  }}
                >
                  <div
                    style={{
                      width: `${
                        questions.length > 0
                          ? ((currentQuestion + 1) / questions.length) * 100
                          : 0
                      }%`,

                      height: "100%",

                      background: "var(--accent)",

                      borderRadius: "10px",

                      transition: "width 0.3s ease",
                    }}
                  />
                </div>

                <p className="quiz-progress">
                  Question {currentQuestion + 1} of {questions.length}
                </p>

                <h2 className="quiz-question">{question.question_text}</h2>

                {/* Answer options */}

                <div className="answer-list">
                  {[
                    ["A", question.option_a],

                    ["B", question.option_b],

                    ["C", question.option_c],

                    ["D", question.option_d],
                  ].map(([letter, option]) => (
                    <button
                      key={letter}
                      type="button"
                      className={`answer-option ${
                        answers[question.question_id] === option
                          ? "selected"
                          : ""
                      }`}
                      onClick={() => handleAnswer(option)}
                    >
                      <span className="answer-letter">{letter}</span>

                      <span>{option}</span>
                    </button>
                  ))}
                </div>

                {/* Response time */}

                {responseTimes[question.question_id] !== undefined && (
                  <p
                    style={{
                      marginTop: "18px",

                      fontSize: "13px",

                      color: "var(--text-muted)",
                    }}
                  >
                    Response time: {responseTimes[question.question_id]} seconds
                  </p>
                )}

                {/* Navigation */}

                <div className="quiz-actions">
                  {currentQuestion > 0 ? (
                    <button
                      className="btn btn-secondary"
                      onClick={previousQuestion}
                    >
                      ← Previous
                    </button>
                  ) : (
                    <span />
                  )}

                  {currentQuestion < questions.length - 1 ? (
                    <button className="btn btn-primary" onClick={nextQuestion}>
                      Next →
                    </button>
                  ) : (
                    <button className="btn btn-primary" onClick={submitQuiz}>
                      Submit Assessment →
                    </button>
                  )}
                </div>
              </div>
            )}
          </>
        )}

        {/* =====================================================

            RESULT

        ===================================================== */}

        {score !== null && (
          <>
            <div className="edusync-brand">
              <div>
                <h1>EduSync AI</h1>

                <span>Learning analysis</span>
              </div>

              <span>Results</span>
            </div>

            {/* Score */}

            <div className="result-header">
              <div className="score-card">
                <div>
                  <div className="score-number">
                    {score}/{questions.length}
                  </div>

                  <div className="score-label">Assessment Score</div>
                </div>
              </div>
            </div>

            {/* Performance Analysis */}

            {analysis && (
              <>
                <h2 className="section-title">Performance Analysis</h2>

                <div className="topic-grid">
                  {analysis.topics.map((topic) => (
                    <div className="topic-card" key={topic.topic}>
                      <div className="topic-card-header">
                        <span className="topic-name">{topic.topic}</span>

                        <span className="topic-accuracy">
                          {topic.accuracy}%
                        </span>
                      </div>

                      <div
                        style={{
                          width: "100%",

                          height: "6px",

                          background: "var(--surface-soft)",

                          borderRadius: "10px",

                          marginTop: "14px",

                          overflow: "hidden",
                        }}
                      >
                        <div
                          style={{
                            width: `${topic.accuracy}%`,

                            height: "100%",

                            background:
                              topic.accuracy >= 80
                                ? "var(--success)"
                                : "var(--danger)",

                            borderRadius: "10px",
                          }}
                        />
                      </div>

                      <p
                        style={{
                          marginBottom: "4px",

                          fontSize: "14px",
                        }}
                      >
                        Correct: {topic.correct} / {topic.total}
                      </p>

                      <p
                        style={{
                          margin: 0,

                          fontSize: "14px",
                        }}
                      >
                        Average response time: {topic.average_response_time}{" "}
                        seconds
                      </p>
                    </div>
                  ))}
                </div>

                {/* =====================================================

                    WEAK TOPIC / RECOMMENDATION

                ===================================================== */}

                {analysis.weak_topic ? (
                  <div className="practice-recommendation">
                    <span className="quiz-label">
                      Personalized Recommendation
                    </span>

                    <h2 className="practice-topic">
                      {analysis.weak_topic.topic}
                    </h2>

                    <p>
                      This topic currently needs additional practice based on
                      your assessment performance.
                    </p>

                    <p>
                      Accuracy: <strong>{analysis.weak_topic.accuracy}%</strong>
                    </p>

                    <p>
                      Average response time:{" "}
                      <strong>
                        {analysis.weak_topic.average_response_time} seconds
                      </strong>
                    </p>

                    <p>
                      <strong>Recommendation:</strong> {analysis.recommendation}
                    </p>

                    <button
                      className="btn btn-primary"
                      onClick={startPractice}
                      style={{
                        marginTop: "10px",
                      }}
                    >
                      Start Recommended Practice →
                    </button>
                  </div>
                ) : (
                  <div className="practice-recommendation">
                    <span className="quiz-label">Assessment Complete</span>

                    <h2 className="practice-topic">
                      No Major Weakness Detected
                    </h2>

                    <p>
                      <strong>Recommendation:</strong> {analysis.recommendation}
                    </p>
                  </div>
                )}
              </>
            )}

            {/* =====================================================

                PRACTICE COMPLETED

            ===================================================== */}

            {practiceScore !== null && (
              <div
                className="practice-recommendation"
                style={{
                  marginTop: "20px",
                }}
              >
                <span className="quiz-label">Practice Completed</span>

                <h2 className="practice-topic">Practice Results</h2>

                <p>
                  Practice Topic:{" "}
                  <strong>
                    {analysis?.weak_topic?.topic || "Recommended Topic"}
                  </strong>
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
                          (practiceScore / practiceQuestions.length) * 100,
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

            <div
              style={{
                marginTop: "30px",
              }}
            >
              <button className="btn btn-secondary" onClick={loadProgress}>
                View My Progress →
              </button>
            </div>

            {showProgress && progress && (
              <div className="progress-section">
                <h2 className="section-title">Student Progress</h2>

                <div className="progress-summary">
                  <div className="progress-stat">
                    <span className="progress-stat-label">
                      Quizzes Attempted
                    </span>

                    <span className="progress-stat-value">
                      {progress.total_attempts}
                    </span>
                  </div>

                  <div className="progress-stat">
                    <span className="progress-stat-label">Average Score</span>

                    <span className="progress-stat-value">
                      {progress.average_score}
                    </span>
                  </div>

                  <div className="progress-stat">
                    <span className="progress-stat-label">Latest Score</span>

                    <span className="progress-stat-value">
                      {progress.latest_score}
                    </span>
                  </div>
                </div>

                {/* Quiz History */}

                {/* =====================================================

    QUIZ HISTORY

\===================================================== */}

                <h3 className="section-title">Quiz History</h3>

                <div className="topic-grid">
                  {(showAllAttempts
                    ? [...progress.attempts].reverse()
                    : [...progress.attempts].slice(-10).reverse()
                  ).map((attempt, index) => (
                    <div className="topic-card" key={attempt.attempt_id}>
                      <div className="topic-card-header">
                        <span className="topic-name">
                          Quiz #{progress.total_attempts - index}
                        </span>

                        <span className="topic-accuracy">{attempt.score}</span>
                      </div>

                      <p
                        style={{
                          marginBottom: 0,

                          fontSize: "14px",
                        }}
                      >
                        Assessment score
                      </p>
                    </div>
                  ))}
                </div>

                {/* Show / hide older attempts */}

                {progress.attempts.length > 10 && (
                  <div
                    style={{
                      display: "flex",

                      justifyContent: "center",

                      marginTop: "18px",
                    }}
                  >
                    <button
                      className="btn btn-secondary"
                      onClick={() =>
                        setShowAllAttempts((previous) => !previous)
                      }
                    >
                      {showAllAttempts
                        ? "Show Latest 10"
                        : `View All ${progress.attempts.length} Attempts`}
                    </button>
                  </div>
                )}

                {/* Topic-wise Progress */}

                {topicProgress && (
                  <>
                    <h3 className="section-title">Topic-wise Progress</h3>

                    <div className="topic-grid">
                      {topicProgress.topics.map((topic) => (
                        <div className="topic-card" key={topic.topic}>
                          <div className="topic-card-header">
                            <span className="topic-name">{topic.topic}</span>

                            <span className="topic-accuracy">
                              {topic.accuracy}%
                            </span>
                          </div>

                          <p
                            style={{
                              fontSize: "14px",

                              marginBottom: "5px",
                            }}
                          >
                            Questions attempted: {topic.questions_attempted}
                          </p>

                          <p
                            style={{
                              fontSize: "14px",

                              marginBottom: 0,
                            }}
                          >
                            Correct answers: {topic.correct_answers}
                          </p>
                        </div>
                      ))}
                    </div>
                  </>
                )}
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
}

export default App;
