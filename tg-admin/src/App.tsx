import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { DesktopShell } from './components/layout/DesktopShell';
import { Login } from './pages/Login';
import { Overview } from './pages/Overview';
import { Reports } from './pages/Reports';
import { ReportDetail } from './pages/ReportDetail';
import { Alerts } from './pages/Alerts';
import { ThreatIntel, Campaigns, AuditHistory, Settings, Extensions } from './pages/Operations';
import { SupportRequests } from './pages/SupportRequests';
import { LanguageProvider } from './lib/language';
import { WorkspaceProvider } from './lib/workspace';
export default function App() { return <LanguageProvider><WorkspaceProvider><BrowserRouter><Routes><Route path="/login" element={<Login />}/><Route path="/" element={<DesktopShell />}><Route index element={<Navigate to="/overview" replace/>}/><Route path="overview" element={<Overview />}/><Route path="reports" element={<Reports />}/><Route path="reports/:id" element={<ReportDetail />}/><Route path="support" element={<SupportRequests />}/><Route path="threat-intel" element={<ThreatIntel />}/><Route path="campaigns" element={<Campaigns />}/><Route path="cases" element={<Navigate to="/reports" replace/>}/><Route path="alerts" element={<Alerts />}/><Route path="extensions" element={<Extensions />}/><Route path="audit" element={<AuditHistory />}/><Route path="settings" element={<Settings />}/><Route path="*" element={<Navigate to="/overview" replace/>}/></Route></Routes></BrowserRouter></WorkspaceProvider></LanguageProvider>; }
