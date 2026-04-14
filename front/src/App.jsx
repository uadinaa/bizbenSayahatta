import './App.css';
import { Outlet } from "react-router-dom";
import Header from "./components/Header";
import Footer from "./components/Footer";
import { ToastProvider } from "./context/ToastContext";
import 'leaflet/dist/leaflet.css';


function App() {
  return (
    <ToastProvider>
      <div className="app-layout">
        <Header />

        <main className="app-main">
          <Outlet />
        </main>

        <Footer />
      </div>
    </ToastProvider>
  );
}

export default App;