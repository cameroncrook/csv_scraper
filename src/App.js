// import { ReactDOM } from 'react-dom/client';
import { BrowserRouter, Routes, Route } from 'react-router-dom';
import Layout from './components/navbar';
import Home from './views/home';
import Scraper from './views/scraperPage';

function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<Layout />}>
          <Route index element={<Home />} />
          <Route path="scraper" element={<Scraper />} />
        </Route>
      </Routes>
    </BrowserRouter>
  );
}

export default App;
