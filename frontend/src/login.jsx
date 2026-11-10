
import { useState } from "react";

function Login({ onLogin }) {
  const [studentId, setStudentId] = useState("");
  const [pin, setPin] = useState("");
  const [error, setError] = useState("");
  const [submitting, setSubmitting] = useState(false);

  const handleSubmit = async (event) => {
    event.preventDefault();
    setError("");
    setSubmitting(true);

    try {
      const response = await fetch(
        "http://127.0.0.1:8000/auth/login",
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            student_id: Number(studentId),
            pin,
          }),
        }
      );

      const data = await response.json();

      if (!response.ok) {
        throw new Error(
          typeof data.detail === "string"
            ? data.detail
            : "Please check your Student ID and PIN."
        );
      }

      onLogin(data.student);
    } catch (err) {
      setError(
        err.message || "Could not connect to the server."
      );
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="login-page">
      <form className="login-card" onSubmit={handleSubmit}>
        <h1>EduSync AI</h1>
        <p>Sign in to your learning dashboard</p>

        <label htmlFor="studentId">Student ID</label>
        <input
          id="studentId"
          type="number"
          min="1"
          value={studentId}
          onChange={(event) => setStudentId(event.target.value)}
          placeholder="Enter your student ID"
          required
        />

        <label htmlFor="pin">PIN</label>
        <input
          id="pin"
          type="password"
          value={pin}
          onChange={(event) => setPin(event.target.value)}
          placeholder="Enter your PIN"
          minLength={4}
          maxLength={12}
          required
        />

        {error && <p className="login-error">{error}</p>}

        <button
          className="btn btn-primary"
          type="submit"
          disabled={submitting}
        >
          {submitting ? "Signing in..." : "Sign In"}
        </button>
      </form>
    </div>
  );
}

export default Login;
