import { GoogleGenAI, Chat, FunctionDeclaration, Type } from "@google/genai";
import { StudyMaterial } from "../types";

const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });

// Define the Tool for Image Generation
const imageGenerationTool: FunctionDeclaration = {
  name: 'generate_image',
  description: 'Generates a visual diagram, circuit, chart, or educational illustration to explain a concept.',
  parameters: {
    type: Type.OBJECT,
    properties: {
      prompt: {
        type: Type.STRING,
        description: 'A detailed description of the image to generate (e.g., "A circuit diagram of a buck converter", "A labeled diagram of a mitochondria").',
      },
    },
    required: ['prompt'],
  },
};

export const createSubjectChat = (subject: string, materials: StudyMaterial[] = []): Chat => {
  // Create a context string listing available materials
  const materialList = materials.map(m => 
    `- [${m.type.toUpperCase()}] "${m.title}" (Link: ${m.url})`
  ).join('\n');

  const materialContext = materials.length > 0 
    ? `\n\n**Available Study Resources:**\nYou have access to the following files in the FusionHub library for this subject. actively recommend these videos or notes when they explain the user's question well:\n${materialList}\n`
    : '';

  return ai.chats.create({
    model: 'gemini-2.5-flash',
    config: {
      tools: [{ functionDeclarations: [imageGenerationTool] }],
      systemInstruction: `You are an expert, patient, and friendly tutor for the subject: ${subject}.
      
      **Context & Abbreviations:**
      - **DCC**: Direct Current Circuit
      - **EDC**: Electrotonic Devices and Circuit
      - **CSE**: Communication Skills in English
      - **FICT**: Fundamentals of ICT
      - **Maths**: Engineering Mathematics
      
      ${materialContext}

      **Visual Explanations:**
      You have the ability to generate images to help explain concepts. 
      - If a student asks for a diagram, graph, circuit, or visual example, **you MUST use the 'generate_image' tool**.
      - Do not just describe a circuit in text if a diagram would be better. Generate it!
      - Example: If asked "Show me a parallel circuit", call the tool with prompt "Circuit diagram of three resistors in parallel connected to a battery".
      
      **Role:**
      - Help the student understand complex concepts, solve problems, and prepare for exams.
      - Provide clear, concise, and accurate explanations.
      - Use formatting effectively: **bold** for key terms, lists for steps.
      - Keep answers strictly related to ${subject} and Electrical Engineering Polytechnic curriculum.
      - If you recommend a study material from the provided list, explicitly mention it's available in their library.
      
      Tone: Encouraging, academic but accessible.`,
    },
  });
};

/**
 * Generates an image using the dedicated image model.
 * This is called by the frontend when the Chat model requests it via a Tool Call.
 */
export const generateVisualContent = async (prompt: string): Promise<string | null> => {
  try {
    const response = await ai.models.generateContent({
      model: 'gemini-2.5-flash-image',
      contents: {
        parts: [{ text: prompt }]
      },
      config: {
        // Image generation specific config
        // Note: SDK handles this, we just need the text prompt
      }
    });

    // Iterate through parts to find the image
    const parts = response.candidates?.[0]?.content?.parts;
    if (parts) {
      for (const part of parts) {
        if (part.inlineData && part.inlineData.data) {
          return `data:image/png;base64,${part.inlineData.data}`;
        }
      }
    }
    return null;
  } catch (error) {
    console.error("Image generation failed:", error);
    return null;
  }
};