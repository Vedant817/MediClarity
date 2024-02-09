import React from 'react'
import './About.css'

const About = () => {
  return (
    <div>
      <div class="company">
    <div class="img">
      <img src="https://raw.githubusercontent.com/pico-india/main-django/main/static/about-team.jpg" alt="" />
    </div>
    <div class="company-info">
      <span className='medi'>MediClarity <span class="our">FOR EVERYONE</span></span>
      <p>
        <b>MediClarity</b> is a  medical website that summarizes medical reports could serve various purposes, such as providing patients with simplified explanations of their medical records, offering healthcare professionals with concise summaries of complex cases, or delivering educational content to the general public.
      </p>
    </div>
  </div>
    </div>
  )
}

export default About