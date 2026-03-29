import { useState } from 'react';

function Login({ onLogin }) {
  const [name, setName] = useState('');
  const [mobile, setMobile] = useState('');
  const [error, setError] = useState('');

  const handleStart = (event) => {
    event.preventDefault();

    const cleanName = name.trim();
    const cleanMobile = mobile.trim();

    // Keep the form simple, but still avoid moving ahead with empty details.
    if (!cleanName || !cleanMobile) {
      setError('Please enter your name and mobile number.');
      return;
    }

    if (!/^\d{10}$/.test(cleanMobile)) {
      setError('Please enter a valid 10-digit mobile number.');
      return;
    }

    setError('');
    onLogin({
      name: cleanName,
      mobile: cleanMobile,
    });
  };

  return (
    <div className="login-wrapper">
      <div className="login-panel page-card">
        <div className="login-info">
          <span className="login-badge">GovTech Learning App</span>
          <h1 className="page-title">Student Login</h1>
          <p className="page-subtitle">Enter your details to continue learning.</p>
        </div>

        <div className="login-card">
          <form onSubmit={handleStart}>
            <div className="form-group">
              <label className="form-label" htmlFor="student-name">
                Student Name
              </label>
              <input
                id="student-name"
                className="form-input"
                type="text"
                value={name}
                onChange={(event) => setName(event.target.value)}
                placeholder="Enter your name"
              />
            </div>

            <div className="form-group">
              <label className="form-label" htmlFor="student-mobile">
                Mobile Number
              </label>
              <input
                id="student-mobile"
                className="form-input"
                type="tel"
                value={mobile}
                onChange={(event) => setMobile(event.target.value)}
                placeholder="Enter your mobile number"
              />
            </div>

            {error ? <p className="form-error">{error}</p> : null}

            <div className="button-row">
              <button type="submit" className="primary-button">
                Login to Dashboard
              </button>
            </div>
          </form>
        </div>
      </div>
    </div>
  );
}

export default Login;
