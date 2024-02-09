import React from 'react'
import './Register.css';
import { useState } from 'react';
import axios from 'axios';

const Register = () => {

  const [username, setusername] = useState('');
  const [email, setemail] = useState('')
  const [password, setpassword] = useState('')

  const handleSubmit = async (e) => {
    e.preventDefault();
    await axios.post('./register', { username,email,password });
    setusername('');
    setpassword('');
    setemail('');
}


  return (
    <div>
       <div class="container">
      <div class="card">
        <div class="card_title">
          <h1>Create Account</h1>
          <span>Already have an account? <a href="login">Sign In</a></span>
        </div>
        <div class="form">
        <form action="/register" method="post" onSubmit={handleSubmit}>
          <input type="text" name="username" id="username" placeholder="UserName" onChange={e=>setusername(e.target.value)} />
          <input type="email" name="email" placeholder="Email" id="email" onChange={e=>setemail(e.target.value)}/>
          <input type="password" name="password" placeholder="Password" id="password" onChange={e=>setpassword(e.target.value)}/>
          <button>Sign Up</button>
          </form>
        </div>
        <div class="card_terms">
            <input type="checkbox" name="" id="terms"/> <span>I have read and agree to the <a href="">Terms of Service</a></span>
        </div>
      </div>
    </div>
    </div>
  )
}

export default Register