import { GoogleGenAI, Chat } from "@google/genai";

// Use the provided key, falling back to env var if present
const apiKey = process.env.API_KEY || 'AIzaSyARwSO6VjOYIRIDQy4U2oEqF2tf0m95aC0';

const ai = new GoogleGenAI({ apiKey });

export const createSubjectChat = (subject: string): Chat => {
  return ai.chats.create({
    model: 'gemini-2.5-flash',
    config: {
      systemInstruction: `You are an expert, patient, and friendly tutor for the subject: ${subject}.
      
      Your Role:
      - Help the student understand complex concepts, solve problems, and prepare for exams.
      - Provide clear, concise, and accurate explanations.
      - Use formatting effectively: use bullet points for lists and steps, and **bold text** for key terms or important takeaways.
      - If the student asks a question unrelated to ${subject}, politely guide them back to the topic or answer briefly if it's general knowledge.
      
      Tone: Encouraging, academic but accessible.`,
    },
  });
};