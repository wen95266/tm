import { GoogleGenAI } from "@google/genai";
import { SYSTEM_INSTRUCTION } from "../constants";

let client: GoogleGenAI | null = null;

const getClient = () => {
  if (!client) {
    client = new GoogleGenAI({ apiKey: process.env.API_KEY });
  }
  return client;
};

export const generateHelpResponse = async (userQuery: string): Promise<string> => {
  try {
    const ai = getClient();
    const model = 'gemini-3-flash-preview';
    
    const response = await ai.models.generateContent({
      model,
      contents: userQuery,
      config: {
        systemInstruction: SYSTEM_INSTRUCTION,
      }
    });

    return response.text || "无法生成回复，请重试。";
  } catch (error) {
    console.error("Gemini API Error:", error);
    return "抱歉，连接 AI 助手时出现错误，请检查网络连接。";
  }
};