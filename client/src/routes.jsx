import React from 'react';
import {BrowserRouter as Router,Route,Routes} from 'react';
import Contact from './Pages/Contact.jsx';
import About from './Pages/About.jsx';
import Landing from './Pages/Landing.jsx';
import Login from './Pages/Login.jsx';
import Register from './Pages/Register.jsx'
import Main from './Pages/Main.jsx'



const AppRoute = () => {
    return(
        <Router>
            <Routes>
                <Route path = '/' element = {<Main/>}/>
                <Route path = '/landing' element = {<Landing/>}/>
                <Route path = '/about' element={<About/>}/>
                <Route path = '/contact' element={<Contact/>}/>
                <Route path = '/login' element={<Login/>}/>
                <Route path = '/register' element={<Register/>}/>
            </Routes>
        </Router>
    )
}

export default AppRoute;