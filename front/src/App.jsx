import './App.css';
import { Outlet } from "react-router-dom";
import Header from "./components/Header";

function App() {
  return (
    <div>
      <Header isAuth={false} />
      
      <main style={{ padding: "20px" }}>
        <Outlet />
      </main>
    </div>
  );
}

export default App;
