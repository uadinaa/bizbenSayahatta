import './App.css'
import { Link } from 'react-router-dom'

function App() {

  return (
    <>
      <h1>Vite + React</h1>
      <Link to="/login"> login</Link>
      <br></br>
      <Link to="/signup"> sign up</Link>
      <br></br>
      <Link to="/profile"> profile</Link>
      <br></br>
      <Link to="/inspiration"> inspiration</Link>
    </>
  )
}

export default App
