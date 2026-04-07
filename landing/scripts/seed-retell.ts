const WEBHOOK_URL = "https://convometrics.vercel.app/api/webhooks/retell";
const SECRET = "06c79662-7d6f-4236-8bcf-edeb3430e091";
const ANALYZE_URL = "https://convometrics.vercel.app/api/analyze";

interface Turn {
  role: "agent" | "user";
  content: string;
}

interface SimCall {
  call_id: string;
  transcript_object: Turn[];
  duration_ms: number;
}

const calls: SimCall[] = [
  // 1. schedule_appointment — resolved
  {
    call_id: "retell_sim_001",
    duration_ms: 142000,
    transcript_object: [
      { role: "agent", content: "Thank you for calling Valley Medical. How can I help you today?" },
      { role: "user", content: "Hi, I'd like to schedule an appointment with Dr. Chen please." },
      { role: "agent", content: "Of course! I have availability next Tuesday at 10am or Thursday at 2:30pm. Which works better for you?" },
      { role: "user", content: "Tuesday at 10 works great." },
      { role: "agent", content: "Perfect. I've booked you with Dr. Chen on Tuesday, April 8th at 10:00 AM. Can I confirm your date of birth for our records?" },
      { role: "user", content: "March 15th, 1988." },
      { role: "agent", content: "Got it. You're all set. You'll receive a confirmation text shortly. Please arrive 15 minutes early to complete any paperwork." },
      { role: "user", content: "Will do. Thanks so much!" },
      { role: "agent", content: "You're welcome! Have a great day." },
    ],
  },

  // 2. insurance_confusion — gave_up + polite_churner
  {
    call_id: "retell_sim_002",
    duration_ms: 198000,
    transcript_object: [
      { role: "agent", content: "Valley Medical, how can I help?" },
      { role: "user", content: "Hi, I just switched insurance to Blue Cross and I'm not sure if you guys still take it. My old plan was Aetna." },
      { role: "agent", content: "We accept most major insurance plans! I'd recommend checking with your insurance provider to confirm that our facility is in-network." },
      { role: "user", content: "But can't you just look it up? I have my new member ID right here." },
      { role: "agent", content: "I understand. Unfortunately, I'm not able to verify specific plan coverage. You can also check our website for a list of accepted insurers." },
      { role: "user", content: "I already looked at the website. It just says 'most major plans' which doesn't help." },
      { role: "agent", content: "I apologize for the inconvenience. Your best option would be to call Blue Cross directly at the number on the back of your card and ask if Valley Medical is in-network." },
      { role: "user", content: "Ok thanks I guess. I'll figure it out." },
      { role: "agent", content: "Is there anything else I can help you with?" },
      { role: "user", content: "No, that's fine." },
    ],
  },

  // 3. wait_time_complaint — escalated + frustration_transfer
  {
    call_id: "retell_sim_003",
    duration_ms: 156000,
    transcript_object: [
      { role: "agent", content: "Valley Medical, how can I help you today?" },
      { role: "user", content: "Yeah, I've been waiting THREE WEEKS for a callback from Dr. Patel about my MRI results. This is unacceptable." },
      { role: "agent", content: "I'm sorry to hear about the delay. Let me check on the status of your results." },
      { role: "user", content: "I've called twice already. Each time I'm told someone will call me back and nobody does." },
      { role: "agent", content: "I understand your frustration. I can see your MRI was completed on March 14th. The results are typically reviewed within 5-7 business days." },
      { role: "user", content: "It's been 21 days! I need to talk to someone who can actually do something. A manager or the doctor directly." },
      { role: "agent", content: "Let me transfer you to our patient services coordinator who can help escalate this." },
      { role: "user", content: "Finally. Yes, do that." },
      { role: "agent", content: "Transferring you now. Please hold." },
    ],
  },

  // 4. cancel_appointment — resolved
  {
    call_id: "retell_sim_004",
    duration_ms: 87000,
    transcript_object: [
      { role: "agent", content: "Valley Medical, how can I help?" },
      { role: "user", content: "I need to cancel my appointment for tomorrow with Dr. Park." },
      { role: "agent", content: "I can help with that. Can I have your name and date of birth?" },
      { role: "user", content: "Sarah Mitchell, July 22nd 1992." },
      { role: "agent", content: "I see your appointment tomorrow at 3:15 PM with Dr. Park. I've cancelled it. Would you like to reschedule?" },
      { role: "user", content: "Not right now. I'll call back when I know my work schedule." },
      { role: "agent", content: "No problem. Your appointment has been cancelled. Just give us a call whenever you're ready to reschedule." },
      { role: "user", content: "Thanks!" },
    ],
  },

  // 5. urgent_symptoms — escalated
  {
    call_id: "retell_sim_005",
    duration_ms: 112000,
    transcript_object: [
      { role: "agent", content: "Valley Medical, how can I assist you?" },
      { role: "user", content: "I've been having chest pain since this morning. It's like a pressure on my left side. Should I come in?" },
      { role: "agent", content: "I want to make sure you get the right care. Can you describe the pain? Is it sharp or dull? Any shortness of breath?" },
      { role: "user", content: "It's more of a squeezing feeling. And yeah, I've been a little short of breath when I walk upstairs." },
      { role: "agent", content: "Given your symptoms, I'm going to connect you with our triage nurse right away. If the pain gets worse or you feel dizzy, please call 911 immediately." },
      { role: "user", content: "Ok, should I be worried?" },
      { role: "agent", content: "It's important we get a nurse to assess you quickly. I'm transferring you now. Please stay on the line." },
      { role: "user", content: "Alright, thank you." },
    ],
  },

  // 6. abandoned_hold — abandoned
  {
    call_id: "retell_sim_006",
    duration_ms: 32000,
    transcript_object: [
      { role: "agent", content: "Thank you for calling Valley Medical. All of our representatives are currently assisting other patients. Your call is important to us. Please hold and we'll be with you shortly." },
      { role: "user", content: "Hello?" },
      { role: "agent", content: "Thank you for your patience. We're experiencing higher than normal call volume. Your estimated wait time is approximately 8 minutes." },
    ],
  },

  // 7. prescription_refill — resolved
  {
    call_id: "retell_sim_007",
    duration_ms: 134000,
    transcript_object: [
      { role: "agent", content: "Valley Medical, how can I help you?" },
      { role: "user", content: "Hi, I need to refill my metformin prescription. I'm running low." },
      { role: "agent", content: "I can help with that. Can I have your name and date of birth?" },
      { role: "user", content: "James Rivera, November 3rd 1975." },
      { role: "agent", content: "I see your metformin 500mg, prescribed by Dr. Nguyen. Your last refill was February 28th. I've submitted the refill request. It should be ready at your pharmacy within 24-48 hours." },
      { role: "user", content: "Great. It goes to the CVS on Main Street, right?" },
      { role: "agent", content: "That's correct. CVS on 450 Main Street. You'll get a text from them when it's ready." },
      { role: "user", content: "Perfect, thank you!" },
    ],
  },

  // 8. billing_dispute — gave_up + polite_churner
  {
    call_id: "retell_sim_008",
    duration_ms: 224000,
    transcript_object: [
      { role: "agent", content: "Valley Medical billing department, how can I help?" },
      { role: "user", content: "I got a bill for $200 for a lab test but my insurance was supposed to cover it completely." },
      { role: "agent", content: "I can look into that. Can I have your name and the date of the lab work?" },
      { role: "user", content: "Maria Lopez. The lab was done on March 5th." },
      { role: "agent", content: "I see the charge. It looks like the lab work was processed as out-of-network, which resulted in the $200 charge to you." },
      { role: "user", content: "But I was referred by my in-network doctor. To YOUR lab. How is it out of network?" },
      { role: "agent", content: "I understand the confusion. Sometimes there's a discrepancy between the referring provider and the lab's network status. I'd recommend calling your insurance to dispute the claim." },
      { role: "user", content: "So you can't fix this on your end?" },
      { role: "agent", content: "Unfortunately, the network determination is made by the insurance company. We can provide documentation to support your dispute if needed." },
      { role: "user", content: "Fine, whatever. I'll call them." },
      { role: "agent", content: "Would you like us to send a letter of medical necessity to your insurer?" },
      { role: "user", content: "Sure, fine." },
    ],
  },

  // 9. reschedule_appointment — resolved
  {
    call_id: "retell_sim_009",
    duration_ms: 105000,
    transcript_object: [
      { role: "agent", content: "Valley Medical, how can I assist you?" },
      { role: "user", content: "I need to reschedule my Thursday appointment. Something came up at work." },
      { role: "agent", content: "No problem. Can I have your name?" },
      { role: "user", content: "David Kim." },
      { role: "agent", content: "I see your appointment Thursday at 11am with Dr. Chen. I have openings next Monday at 9am or next Wednesday at 4pm." },
      { role: "user", content: "Monday at 9 works." },
      { role: "agent", content: "Done. You're now booked for Monday, April 14th at 9:00 AM with Dr. Chen. Confirmation text on its way." },
      { role: "user", content: "Appreciate it. Thanks." },
    ],
  },

  // 10. test_results_confusion — escalated
  {
    call_id: "retell_sim_010",
    duration_ms: 178000,
    transcript_object: [
      { role: "agent", content: "Valley Medical, how can I help?" },
      { role: "user", content: "I got my blood work results in the portal but I don't understand them. Some of the numbers are flagged in red." },
      { role: "agent", content: "I understand that can be concerning. Which values are you looking at?" },
      { role: "user", content: "My A1C is 7.2 and it says 'high' next to it. And my cholesterol says 'borderline'. What does that mean for me?" },
      { role: "agent", content: "I'm not able to interpret specific lab results, but I can have a nurse or your doctor call you back to discuss them. Would you like that?" },
      { role: "user", content: "I'd really rather talk to someone now. I've been stressed about this all day." },
      { role: "agent", content: "I understand. Let me see if a nurse is available to speak with you. One moment please." },
      { role: "user", content: "Yes please." },
      { role: "agent", content: "I'm connecting you with Nurse Johnson now. She can review your results with you." },
      { role: "user", content: "Thank you so much." },
    ],
  },

  // 11. appointment_confirmation — resolved
  {
    call_id: "retell_sim_011",
    duration_ms: 62000,
    transcript_object: [
      { role: "agent", content: "Valley Medical, how can I help?" },
      { role: "user", content: "Hi, just calling to confirm my appointment tomorrow." },
      { role: "agent", content: "Of course. Can I have your name?" },
      { role: "user", content: "Lisa Thompson." },
      { role: "agent", content: "Yes, I see your appointment tomorrow, April 8th at 2:00 PM with Dr. Patel. You're confirmed." },
      { role: "user", content: "Great, do I need to bring anything?" },
      { role: "agent", content: "Just your insurance card and photo ID. And if you have any new medications to report, please bring those names as well." },
      { role: "user", content: "Got it. See you tomorrow!" },
    ],
  },

  // 12. wrong_diagnosis_complaint — escalated + frustration_transfer
  {
    call_id: "retell_sim_012",
    duration_ms: 203000,
    transcript_object: [
      { role: "agent", content: "Valley Medical, how can I assist you?" },
      { role: "user", content: "I need to file a complaint. Dr. Ramirez told me I had tendinitis and it turned out to be a stress fracture. I walked on it for two weeks!" },
      { role: "agent", content: "I'm very sorry to hear about your experience. Can I take down some details?" },
      { role: "user", content: "I've already given details to three different people. Nobody has done anything." },
      { role: "agent", content: "I understand your frustration. I can file a formal complaint on your behalf and have our patient advocate reach out to you." },
      { role: "user", content: "I don't want another callback. I want to talk to a supervisor right now." },
      { role: "agent", content: "Let me check if a supervisor is available." },
      { role: "user", content: "Please. This is serious. I had to go to the ER because of this misdiagnosis." },
      { role: "agent", content: "I completely understand. I'm transferring you to our clinical supervisor now." },
      { role: "user", content: "Thank you. Finally." },
    ],
  },

  // 13. referral_request — gave_up
  {
    call_id: "retell_sim_013",
    duration_ms: 167000,
    transcript_object: [
      { role: "agent", content: "Valley Medical, how can I help?" },
      { role: "user", content: "I need a referral to see a dermatologist. I've had this rash for three weeks and it's getting worse." },
      { role: "agent", content: "Referrals need to be initiated by your primary care provider. Do you have an upcoming appointment with your doctor?" },
      { role: "user", content: "No, and I can't get one for another two weeks. Can't you just put in the referral?" },
      { role: "agent", content: "Unfortunately, I'm not able to initiate referrals. Your doctor needs to assess the condition and determine the appropriate specialist." },
      { role: "user", content: "But it's getting worse. What am I supposed to do for two more weeks?" },
      { role: "agent", content: "I can check if there are any earlier openings with your primary care doctor. I also recommend our nurse advice line if you're concerned about the symptoms worsening." },
      { role: "user", content: "What's the nurse line number?" },
      { role: "agent", content: "It's 555-0199. They're available 24/7." },
      { role: "user", content: "Alright, I'll try that. Thanks." },
    ],
  },

  // 14. followup_appointment — resolved
  {
    call_id: "retell_sim_014",
    duration_ms: 118000,
    transcript_object: [
      { role: "agent", content: "Valley Medical, how can I assist you?" },
      { role: "user", content: "Dr. Nguyen told me to schedule a follow-up in two weeks. Can I do that now?" },
      { role: "agent", content: "Absolutely. Let me check Dr. Nguyen's availability. I have April 22nd at 10:30am or April 23rd at 3pm." },
      { role: "user", content: "April 22nd works." },
      { role: "agent", content: "You're booked. Dr. Nguyen, April 22nd at 10:30 AM. She mentioned you'll need blood work done before the visit. Our lab is open Monday through Friday, 7am to 5pm. No appointment needed." },
      { role: "user", content: "Oh good, I'll come in that morning then. Do I need to fast?" },
      { role: "agent", content: "Yes, please fast for 12 hours before the blood draw. Water is fine." },
      { role: "user", content: "Got it. Thanks!" },
    ],
  },

  // 15. medication_side_effects — gave_up + polite_churner
  {
    call_id: "retell_sim_015",
    duration_ms: 189000,
    transcript_object: [
      { role: "agent", content: "Valley Medical, how can I help?" },
      { role: "user", content: "I started a new medication last week — lisinopril — and I've been having this dry cough that won't go away. Is that normal?" },
      { role: "agent", content: "A dry cough can be a side effect of lisinopril. I'd recommend discussing this with your prescribing doctor to see if an adjustment is needed." },
      { role: "user", content: "Can I talk to a nurse about it? It's really bothering me, especially at night." },
      { role: "agent", content: "I can have a nurse call you back within 24-48 hours. Would you like that?" },
      { role: "user", content: "48 hours? I've barely slept in three days because of this cough." },
      { role: "agent", content: "I understand. Unfortunately our nurses are currently handling other patient calls. I can also suggest calling our after-hours nurse line at 555-0199." },
      { role: "user", content: "You know what, it's fine. I'll just Google it." },
      { role: "agent", content: "I would recommend speaking with your doctor before making any changes to your medication." },
      { role: "user", content: "Yeah, sure. Thanks." },
    ],
  },
];

async function main() {
  console.log("Sending 15 Retell webhook calls...\n");

  // Spread calls across the last 7 days
  const now = Date.now();

  for (const call of calls) {
    const daysAgo = Math.floor(Math.random() * 7);
    const hoursOffset = 8 + Math.floor(Math.random() * 10);
    const startTs = now - daysAgo * 86400000 - hoursOffset * 3600000;
    const endTs = startTs + call.duration_ms;

    const payload = {
      event: "call_ended",
      call: {
        call_id: call.call_id,
        transcript_object: call.transcript_object,
        duration_ms: call.duration_ms,
        start_timestamp: startTs,
        end_timestamp: endTs,
        from_number: "+1555" + String(Math.floor(Math.random() * 9000000) + 1000000),
        disconnection_reason: "customer_ended_call",
      },
    };

    const res = await fetch(WEBHOOK_URL + "?secret=" + SECRET, {
      method: "POST",
      headers: { "Content-Type": "application/json", "x-webhook-secret": SECRET },
      body: JSON.stringify(payload),
    });

    const data = await res.json();
    console.log(`  ${call.call_id}: ${res.status} ${JSON.stringify(data)}`);
  }

  console.log("\nAll 15 calls sent. Waiting 5 seconds then triggering analysis...\n");
  await new Promise((r) => setTimeout(r, 5000));

  const analyzeRes = await fetch(ANALYZE_URL, { method: "POST" });
  const analyzeData = await analyzeRes.json();
  console.log(`Analysis triggered: ${JSON.stringify(analyzeData)}\n`);

  console.log("Waiting 30 seconds for analysis to complete...\n");
  await new Promise((r) => setTimeout(r, 30000));

  // Query DB for results
  console.log("Querying results...\n");
}

main().catch(console.error);
