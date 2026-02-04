import { BrowserRouter as Router, Routes, Route } from 'react-router-dom';
import { ThemeProvider } from './context/ThemeContext';
import { LanguageProvider } from './context/LanguageContext';
import Layout from './components/layout/Layout';
import Home from './pages/Home';
import About from './pages/About';
import Gallery from './pages/Gallery';
import Admissions from './pages/Admissions';
import Contact from './pages/Contact';

function App() {
  return (
    <ThemeProvider>
      <LanguageProvider>
        <Router>
          <Layout>
          <Routes>
            <Route path="/" element={<Home />} />
            <Route path="/about" element={<About />} />
            <Route path="/gallery" element={<Gallery />} />
            <Route path="/admissions" element={<Admissions />} />
            <Route path="/contact" element={<Contact />} />
          </Routes>
          </Layout>
        </Router>
      </LanguageProvider>
    </ThemeProvider>
  );
}

export default App;
