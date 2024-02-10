import React from 'react';
import {BrowserRouter,Route,Routes} from 'react-router-dom';
import Contact from './Pages/Contact.jsx';
import About from './Pages/About.jsx';
import Landing from './Pages/Landing.jsx';
import Login from './Pages/Login.jsx';
import Register from './Pages/Register.jsx';
import Main from './Pages/Main.jsx';



const AppRoute = () => {
    return(
        <BrowserRouter>
            <Routes>
                <Route path = '/' element = {<Landing/>}/>
                <Route path = '/main' element = {<Main/>}/>
                <Route path = '/about' element={<About/>}/>
                <Route path = '/contact' element={<Contact/>}/>
                <Route path = '/login' element={<Login/>}/>
                <Route path = '/register' element={<Register/>}/>
            </Routes>
        </BrowserRouter>
    )
}

export default AppRoute;