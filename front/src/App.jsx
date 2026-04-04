// import './App.css';
import { Outlet } from "react-router-dom";
import Header from "./components/Header";
import Footer from "./components/Footer";
import 'leaflet/dist/leaflet.css';


function App() {
  return (
    <div className="app-layout">
      <Header />

      <main className="app-main">
        <Outlet />
      </main>

      <Footer />
    </div>
  );
}

export default App;