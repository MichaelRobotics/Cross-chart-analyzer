import React from 'react'
import ReactDOM from 'react-dom/client'
import AppWrapper from './Demo.js' // Lub './App.jsx' jeśli zmienisz nazwę pliku
import './index.css' // Załóżmy, że masz plik index.css dla stylów Tailwind

ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <AppWrapper />
  </React.StrictMode>,
)
