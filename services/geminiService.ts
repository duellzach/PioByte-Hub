
import { GoogleGenAI, Type } from "@google/genai";

const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });

export async function suggestSuccessCriteria(taskTitle: string, department: string) {
  try {
    const response = await ai.models.generateContent({
      model: "gemini-3-flash-preview",
      contents: `You are an FRC (FIRST Robotics Competition) mentor. For the following task in the ${department} department, suggest 3-5 clearly defined success criteria.
      Task: ${taskTitle}`,
      config: {
        responseMimeType: "application/json",
        responseSchema: {
          type: Type.ARRAY,
          items: { type: Type.STRING },
        },
      },
    });
    
    // Fix: access text property safely and trim before parsing to ensure valid JSON extraction
    const text = response.text;
    if (!text) return [];
    return JSON.parse(text.trim());
  } catch (error) {
    console.error("Gemini failed to suggest criteria:", error);
    return [];
  }
}

export async function summarizeProjectProgress(projectTasks: any[]) {
  try {
    const response = await ai.models.generateContent({
      model: "gemini-3-flash-preview",
      contents: `Provide a high-level executive summary of this FRC project's current status based on these tasks: ${JSON.stringify(projectTasks.map(t => ({title: t.title, status: t.status, department: t.departments})))}`,
      config: {
        systemInstruction: "You are a lead FRC Team Captain summarizing progress for the team.",
      }
    });
    // Fix: Access text property directly and provide a fallback if undefined
    return response.text || "Unable to generate summary at this time.";
  } catch (error) {
    console.error("Gemini failed to summarize progress:", error);
    return "Unable to generate summary at this time.";
  }
}
