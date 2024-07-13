import React from 'react';
import { BrowserRouter, Route, Routes } from 'react-router-dom';
import Contact from './Pages/Contact.jsx';
import About from './Pages/About.jsx';
import Landing from './Pages/Landing.jsx';
import Main from './Pages/Main.jsx';

function App() {
  return (
    <div className="App bg-neutral-900 p-2 text-white">
      <BrowserRouter>
        <Routes>
          <Route path='/' element={<Landing />} />
          <Route path='/main' element={<Main />} />
          <Route path='/about' element={<About />} />
          <Route path='/contact' element={<Contact />} />
        </Routes>
      </BrowserRouter>
    </div>
  );
}

export default App;
