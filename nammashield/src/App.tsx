import { lazy, Suspense } from 'react';
import { BrowserRouter as Router, Routes, Route } from 'react-router-dom';
import { Layout } from './components/Layout';
const Landing = lazy(() => import('./pages/Landing').then(module => ({ default: module.Landing })));
const CheckResult = lazy(() => import('./pages/CheckResult').then(module => ({ default: module.CheckResult })));
import { Checker } from './pages/Checker';
const Report = lazy(() => import('./pages/Report').then(module => ({ default: module.Report })));
const Alerts = lazy(() => import('./pages/Alerts').then(module => ({ default: module.Alerts })));
const About = lazy(() => import('./pages/About').then(module => ({ default: module.About })));
const Chat = lazy(() => import('./pages/Chat').then(module => ({ default: module.Chat })));
const Analyst = lazy(() => import('./pages/Analyst').then(module => ({ default: module.Analyst })));
const HowItWorksPrototype = lazy(() => import('./pages/HowItWorksPrototype').then(module => ({ default: module.HowItWorksPrototype })));

const TrackReport = lazy(() => import('./pages/TrackReport').then(m => ({ default: m.TrackReport })));
const ExtensionPreview = lazy(() => import('./pages/ExtensionPreview').then(m => ({ default: m.ExtensionPreview })));

const PageAnalysis = lazy(() => import('./pages/PageAnalysis').then(m=>({default:m.PageAnalysis})));
const ReportVerification = lazy(() => import('./pages/ReportVerification').then(m=>({default:m.ReportVerification})));
function App() {
  return (
    <Router>
      <Suspense fallback={<div className="mx-auto w-full max-w-2xl p-8" role="status" aria-label="Loading"><div className="h-4 w-24 rounded bg-stone-200"/><div className="mt-5 h-40 rounded-2xl bg-stone-100"/></div>}><Routes>
        <Route path="/" element={<Layout />}>
          <Route index element={<Landing />} />
          <Route path="check" element={<Checker />} /><Route path="check/result" element={<CheckResult />} />
          <Route path="report" element={<Report />} /><Route path="report/verify" element={<ReportVerification />} /><Route path="report/preview" element={<ReportVerification />} />
          <Route path="analyze" element={<PageAnalysis />} /><Route path="track" element={<TrackReport />} /><Route path="extension" element={<ExtensionPreview />} />
          <Route path="alerts" element={<Alerts />} />
          <Route path="about" element={<About />} />
          <Route path="help" element={<Chat />} /><Route path="chat" element={<Chat />} />
          <Route path="analyst" element={<Analyst />} />
          <Route path="prototype" element={<HowItWorksPrototype />} />
        </Route>
      </Routes></Suspense>
    </Router>
  );
}

export default App;

