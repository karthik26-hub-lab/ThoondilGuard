import { Router } from 'express';
import { z } from 'zod';
import { persistentRateLimit } from '../middleware/rateLimit.js';
import { AnalysisEngine } from '../services/analysis/AnalysisEngine.js';
import { AppError } from '../utils/AppError.js';
const input=z.object({text:z.string().trim().min(1).max(8000),language:z.enum(['en','ta'])}).strict();
const engine=new AnalysisEngine();
export const analysisRouter=Router();
analysisRouter.post('/',persistentRateLimit('analysis-ip',20,60000),async(req,res,next)=>{try{const parsed=input.safeParse(req.body);if(!parsed.success){next(new AppError('Invalid analysis input',400));return;}const result=await engine.analyze({inputType:'text',source:'web',content:parsed.data.text,metadata:{locale:parsed.data.language}});const risk={HIGH_CONCERN:'High concern',NEEDS_VERIFICATION:'Needs verification',NO_STRONG_WARNING_SIGNS:'No strong warning signs found'} as const;res.json({riskLevel:risk[result.riskLevel],findings:[...result.reasons.map(r=>r.message),result.uncertainty,...result.warnings.map(w=>w.provider+': '+w.message)],actions:[parsed.data.language==='ta'?'அதிகாரப்பூர்வ செயலி, இணையதளம் அல்லது நம்பகமான தொடர்பு மூலம் உறுதிசெய்யவும்.':'Verify through an official app, website or trusted contact.',parsed.data.language==='ta'?'கடவுச்சொல், PIN அல்லது OTP-ஐ பகிர வேண்டாம்.':'Do not share passwords, PINs or OTPs.'],providersUsed:result.providersUsed,analyzerVersion:result.analyzerVersion});}catch(error){next(error);}});
