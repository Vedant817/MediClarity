import React from 'react'
import './Login.css'

const Login = () => {
  return (
    <div>
      <div className='big-container'>
      <div class="container">
  <div class="card">
    <h2 className='Login'>Login</h2>
    <form className='form-div'>
      <input type="text" className="username" name="username" placeholder="Username" required/>
      <input type="password" className="password" name="password" placeholder="Password" required/>
      <br/>
      <button className="submit">Login</button>
    </form>
  </div>
</div>
      </div>
      
    </div>
  )
}

export default Login