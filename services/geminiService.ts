import OpenAI from "openai";
import { StudyMaterial } from "../types";

// Initialize OpenAI Client (configured for OpenRouter)
const getAiClient = (): OpenAI => {
  // Access the injected env variable and ensure it's a string
  const rawKey = process.env.API_KEY; 
  const apiKey = typeof rawKey === 'string' ? rawKey.trim() : "";
  
  if (!apiKey || apiKey.includes('placeholder')) {
    console.warn("FusionAI API Key might be missing or invalid.");
  }

  return new OpenAI({
    baseURL: "https://openrouter.ai/api/v1",
    apiKey: apiKey,
    dangerouslyAllowBrowser: true, // Required for client-side usage
    defaultHeaders: {
      "HTTP-Referer": typeof window !== 'undefined' ? window.location.origin : "http://localhost:3000", // Required for OpenRouter
      "X-Title": "FusionHub Study", // Required for OpenRouter
    }
  });
};

// Define the Tool for Image Generation (OpenAI Format)
const imageGenerationTool = {
  type: "function" as const,
  function: {
    name: 'generate_image',
    description: 'Generates a visual diagram, circuit, chart, or educational illustration to explain a concept.',
    parameters: {
      type: 'object',
      properties: {
        prompt: {
          type: 'string',
          description: 'A detailed description of the image to generate (e.g., "A circuit diagram of a buck converter").',
        },
      },
      required: ['prompt'],
    },
  }
};

export class FusionAISession {
  private client: OpenAI;
  private history: OpenAI.Chat.Completions.ChatCompletionMessageParam[];
  private model: string;

  constructor(systemInstruction: string) {
    this.client = getAiClient();
    // Use gpt-4o-mini via OpenRouter
    this.model = 'openai/gpt-4o-mini'; 
    this.history = [
      { role: 'system', content: systemInstruction }
    ];
  }

  async sendMessage(params: { message?: string, parts?: any[] }): Promise<{ text: string, functionCalls: any[] }> {
    // 1. Handle Tool Responses (Adapter for legacy Gemini-style calls from Subject.tsx)
    if (params.parts && params.parts[0]?.functionResponse) {
       const { name, response } = params.parts[0].functionResponse;
       
       // Find the last assistant message with a tool call to link this response
       let toolCallId = null;
       for (let i = this.history.length - 1; i >= 0; i--) {
           const msg = this.history[i];
           if (msg.role === 'assistant' && msg.tool_calls) {
               const call = msg.tool_calls.find(tc => tc.function.name === name);
               if (call) {
                   toolCallId = call.id;
                   break;
               }
           }
       }

       if (toolCallId) {
           this.history.push({
               role: 'tool',
               tool_call_id: toolCallId,
               content: JSON.stringify(response)
           });
       }
    } 
    
    // 2. Handle User Message
    if (params.message) {
        this.history.push({ role: 'user', content: params.message });
    }

    try {
        const completion = await this.client.chat.completions.create({
            model: this.model,
            messages: this.history,
            tools: [imageGenerationTool],
            tool_choice: 'auto'
        });

        const choice = completion.choices[0];
        const message = choice.message;
        
        // Add assistant response to history
        this.history.push(message);

        const result = {
            text: message.content || "",
            functionCalls: [] as any[]
        };

        // Normalize OpenAI tool_calls to the app's expected structure
        if (message.tool_calls) {
            result.functionCalls = message.tool_calls.map(tc => ({
                name: tc.function.name,
                args: JSON.parse(tc.function.arguments),
                id: tc.id 
            }));
        }

        return result;

    } catch (error) {
        console.error("FusionAI Request Failed:", error);
        throw error; 
    }
  }
}

export const createSubjectChat = (subject: string, materials: StudyMaterial[] = []): FusionAISession => {
  // Create a context string listing available materials
  const materialList = materials.map(m => 
    `- [${m.type.toUpperCase()}] "${m.title}" (Link: ${m.url})`
  ).join('\n');

  const materialContext = materials.length > 0 
    ? `\n\n**Available Study Resources:**\nYou have access to the following files in the FusionHub library for this subject. Actively recommend these videos or notes when they explain the user's question well:\n${materialList}\n`
    : '';

  const systemInstruction = `You are FusionAI, an expert, patient, and friendly tutor for the subject: ${subject}.
      
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
      
      **Role:**
      - Help the student understand complex concepts, solve problems, and prepare for exams.
      - Provide clear, concise, and accurate explanations.
      - Use formatting effectively: **bold** for key terms, lists for steps.
      - Keep answers strictly related to ${subject} and Electrical Engineering Polytechnic curriculum.
      
      Tone: Encouraging, academic but accessible.`;

  return new FusionAISession(systemInstruction);
};

/**
 * Generates an image using OpenAI DALL-E (via OpenRouter).
 */
export const generateVisualContent = async (prompt: string): Promise<string | null> => {
  try {
    const client = getAiClient();
    // Using dall-e-3 via OpenRouter standard interface
    const response = await client.images.generate({
      model: "openai/dall-e-3", 
      prompt: prompt,
      size: "1024x1024",
      quality: "standard",
      n: 1,
      response_format: "b64_json"
    });

    const b64 = response.data[0].b64_json;
    if (b64) {
      return `data:image/png;base64,${b64}`;
    }
    return null;
  } catch (error) {
    console.error("FusionAI Image generation failed:", error);
    return null;
  }
};