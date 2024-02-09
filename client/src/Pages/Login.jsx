import React from "react";
import "./Login.css";

const Login = () => {
  return (
    <div className="container">
      <div className="card">
        <div className="card_title">
          <h1>Login</h1>
        </div>
        <form className="form">
          <input type="text" placeholder="Username" />
          <input type="password" placeholder="Password" />
          <button type="submit">Login</button>
        </form>
        <div className="card_terms">
          <input type="checkbox" />
          <span>Remember me</span>
        </div>
        <div className="card_links">
          <a href="#">Forgot password?</a>
          <span>|</span>
          <a href="#">Create account</a>
        </div>
      </div>
    </div>
  );
};

export default Login;
