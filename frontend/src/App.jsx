import { useEffect, useState } from "react";

import "./App.css";



function App() {
  const [isOnline, setIsOnline] = useState(navigator.onLine);


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



  // =====================================================

  // LOAD NORMAL QUIZ

  useEffect(() => {
    const loadQuestions = async () => {

      // OFFLINE: use local cache directly
      if (!navigator.onLine) {
        const cachedQuestions =
          localStorage.getItem("edusync_questions");

        if (cachedQuestions) {
          try {
            const data = JSON.parse(cachedQuestions);

            setQuestions(data);
            setLoading(false);
            setQuestionStartTime(Date.now());

            console.log(
              "Offline mode: questions loaded from local cache."
            );
          } catch (error) {
            console.error(
              "Cached questions are invalid.",
              error
            );
            setLoading(false);
          }
        } else {
          console.error(
            "Offline mode: no cached questions available."
          );
          setLoading(false);
        }

        return;
      }

      // ONLINE: load from backend
      try {
        const response = await fetch(
          "http://127.0.0.1:8000/questions"
        );

        if (!response.ok) {
          throw new Error("Failed to fetch questions");
        }

        const data = await response.json();

        // Save questions locally for offline use
        localStorage.setItem(
          "edusync_questions",
          JSON.stringify(data)
        );

        setQuestions(data);
        setLoading(false);
        setQuestionStartTime(Date.now());

        console.log(
          "Online mode: questions loaded from backend and cached locally."
        );

      } catch (error) {
        console.log(
          "Backend unavailable. Trying cached questions..."
        );

        const cachedQuestions =
          localStorage.getItem("edusync_questions");

        if (cachedQuestions) {
          try {
            const data = JSON.parse(cachedQuestions);

            setQuestions(data);
            setLoading(false);
            setQuestionStartTime(Date.now());

            console.log(
              "Fallback mode: questions loaded from local cache."
            );
          } catch (cacheError) {
            console.error(
              "Cached questions are invalid.",
              cacheError
            );
            setLoading(false);
          }
        } else {
          console.error(
            "No cached questions available.",
            error
          );
          setLoading(false);
        }
      }
    };

    loadQuestions();
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

          student_id: 1,

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

        "http://127.0.0.1:8000/performance-analysis/1",

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



  // =====================================================

  // LOAD STUDENT PROGRESS

  // =====================================================



  const loadProgress = async () => {

    try {

      const response = await fetch("http://127.0.0.1:8000/student-progress/1");



      const data = await response.json();



      if (!response.ok) {

        throw new Error("Could not load overall progress");

      }



      setProgress(data);



      const topicResponse = await fetch(

        "http://127.0.0.1:8000/student-topic-progress/1",

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

                      answers[question.question_id] === option ? "selected" : ""

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

                  ).map((attempt) => (

                    <div className="topic-card" key={attempt.attempt_id}>

                      <div className="topic-card-header">

                        <span className="topic-name">

                          Quiz #{attempt.attempt_id}

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
