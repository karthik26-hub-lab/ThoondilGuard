import {AppError} from '../utils/AppError.js';
import nodemailer from 'nodemailer';

export async function deliverCode(channel:'sms'|'email',contact:string,code:string){
  if(channel==='sms'){
    const sid=process.env.TWILIO_ACCOUNT_SID;
    const token=process.env.TWILIO_AUTH_TOKEN;
    const from=process.env.TWILIO_FROM;
    if(!sid||!token||!from) throw new AppError('SMS delivery is not configured',503);
    
    const response=await fetch('https://api.twilio.com/2010-04-01/Accounts/'+encodeURIComponent(sid)+'/Messages.json',{
      method:'POST',
      headers:{
        Authorization:'Basic '+Buffer.from(sid+':'+token).toString('base64'),
        'Content-Type':'application/x-www-form-urlencoded'
      },
      body:new URLSearchParams({
        To:contact,
        From:from,
        Body:'ThoondilGuard verification code: '+code+'. Valid for 5 minutes. Do not share it.'
      }),
      signal:AbortSignal.timeout(10000)
    });
    if(!response.ok) throw new AppError('Verification code could not be sent',502);
  } else {
    const user=process.env.SMTP_USER;
    const pass=process.env.SMTP_PASS;
    const from=process.env.EMAIL_FROM || user;
    if(!user||!pass||!from) throw new AppError('Email delivery is not configured',503);

    const transporter = nodemailer.createTransport({
      service: 'gmail',
      auth: {
        user: user,
        pass: pass
      }
    });

    try {
      await transporter.sendMail({
        from: from,
        to: contact,
        subject: 'ThoondilGuard verification',
        text: 'Your verification code is '+code+'. Valid for 5 minutes. Do not share it.'
      });
    } catch (error) {
      console.error('Email delivery error:', error);
      throw new AppError('Verification code could not be sent', 502);
    }
  }
}

export async function deliverReceiptEmail(contact: string, reference: string, accessKey: string) {
  const user = process.env.SMTP_USER;
  const pass = process.env.SMTP_PASS;
  const from = process.env.EMAIL_FROM || user;
  if (!user || !pass || !from) return;

  const transporter = nodemailer.createTransport({
    service: 'gmail',
    auth: { user, pass }
  });

  const trackingLink = `http://localhost:5173/track?reference=${encodeURIComponent(reference)}&key=${encodeURIComponent(accessKey)}`;
  const text = `Thank you for reporting to ThoondilGuard.\n\nYour Report Reference ID: ${reference}\nYour Private Access Key: ${accessKey}\n\nYou can track the status of your report here:\n${trackingLink}\n\nKeep this information safe.`;

  try {
    await transporter.sendMail({
      from: from,
      to: contact,
      subject: 'ThoondilGuard Report Receipt - ' + reference,
      text: text
    });
  } catch (error) {
    console.error('Receipt email delivery error:', error);
  }
}

export async function deliverDecisionEmail(contact: string, reference: string, decision: string, notes: string) {
  const user = process.env.SMTP_USER;
  const pass = process.env.SMTP_PASS;
  const from = process.env.EMAIL_FROM || user;
  if (!user || !pass || !from) return;
  const transporter = nodemailer.createTransport({service: 'gmail', auth: { user, pass }});
  const text = "ThoondilGuard Update - Report " + reference + "\n\nAn administrator has reviewed your report and made a decision.\n\nDecision: " + decision + "\n" + (notes ? 'Notes: ' + notes + '\n' : '') + "Thank you for helping keep the community safe.";
  try { await transporter.sendMail({from, to: contact, subject: 'ThoondilGuard Decision Update - ' + reference, text}); } catch (e) { console.error('Decision email error', e); }
}
