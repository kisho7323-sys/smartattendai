import { GoogleGenAI } from '@google/genai';

let aiInstance: GoogleGenAI | null = null;

function getAiClient(): GoogleGenAI | null {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    console.warn('[AI] GEMINI_API_KEY not configured.');
    return null;
  }
  if (!aiInstance) {
    aiInstance = new GoogleGenAI({
      apiKey,
      httpOptions: {
        headers: {
          'User-Agent': 'aistudio-build',
        },
      },
    });
  }
  return aiInstance;
}

export async function askAiTutor(params: {
  question: string;
  subjectName: string;
  materials: { title: string; content: string; fileName: string }[];
  history: { sender: string; text: string }[];
}): Promise<{ answer: string; sources: { title: string; snippet: string }[] }> {
  const ai = getAiClient();
  if (!ai) {
    return {
      answer:
        'AI Assistant requires a configured GEMINI_API_KEY in the environment secrets. Please ensure your API key is enabled in Settings.',
      sources: [],
    };
  }

  const contextBlocks = params.materials
    .map(
      (m, idx) =>
        `[SOURCE ${idx + 1}: ${m.title} (${m.fileName})]\n${m.content.slice(0, 3000)}\n[END SOURCE ${idx + 1}]`
    )
    .join('\n\n');

  const systemInstruction = `You are the academic AI Study Tutor for the course "${params.subjectName}".
Your role:
1. Answer the student's question accurately using ONLY the provided verified course materials whenever available.
2. Clearly cite the exact source document title and relevant section in your explanation.
3. If the provided materials do not contain sufficient information to answer the question accurately, explicitly state: "The uploaded study materials do not contain sufficient information regarding this topic." Never fabricate source citations or invent course content.
4. Keep explanations instructional, clear, and academically rigorous.`;

  const prompt = `Course Materials:\n${contextBlocks || 'No course documents currently uploaded for this subject.'}\n\nStudent Query: ${params.question}`;

  try {
    const response = await ai.models.generateContent({
      model: 'gemini-3.8-flash',
      contents: prompt,
      config: {
        systemInstruction,
        temperature: 0.2,
      },
    });

    const text = response.text || 'No response generated.';

    // Extract sources if mentioned
    const sources: { title: string; snippet: string }[] = [];
    params.materials.forEach((m) => {
      if (text.toLowerCase().includes(m.title.toLowerCase()) || params.materials.length === 1) {
        sources.push({
          title: m.title,
          snippet: m.content.slice(0, 160) + '...',
        });
      }
    });

    return {
      answer: text,
      sources,
    };
  } catch (err: any) {
    console.error('[AI] Gemini Tutor generation error:', err);
    return {
      answer: `Unable to generate tutor response: ${err.message || 'API service error'}`,
      sources: [],
    };
  }
}

export async function generateQuizQuestions(params: {
  topic: string;
  subjectName: string;
  count: number;
  studyMaterialText?: string;
}): Promise<any[]> {
  const ai = getAiClient();
  if (!ai) {
    throw new Error('GEMINI_API_KEY is not configured in the server environment.');
  }

  const prompt = `Generate ${params.count} multiple-choice academic quiz questions for the subject "${params.subjectName}" on the topic: "${params.topic}".
Reference Material:
${params.studyMaterialText ? params.studyMaterialText.slice(0, 4000) : 'General curriculum standard for ' + params.subjectName}

Return strict JSON array of objects with keys:
- question: string
- options: array of 4 string options
- correctOptionIndex: integer 0-3
- explanation: string explaining why the answer is correct
- topic: string
`;

  try {
    const response = await ai.models.generateContent({
      model: 'gemini-3.8-flash',
      contents: prompt,
      config: {
        systemInstruction: 'You are an academic exam creator. Output only valid JSON without markdown wrapping.',
        responseMimeType: 'application/json',
      },
    });

    const text = response.text || '[]';
    return JSON.parse(text);
  } catch (err: any) {
    console.error('[AI] Quiz generation error:', err);
    throw err;
  }
}

export async function generateRevisionPlan(params: {
  studentName: string;
  subjectName: string;
  score: number;
  total: number;
  weakTopics: string[];
}): Promise<string> {
  const ai = getAiClient();
  if (!ai) {
    return 'Revision plan generation requires GEMINI_API_KEY.';
  }

  const prompt = `Student ${params.studentName} scored ${params.score}/${params.total} in ${params.subjectName}.
Identified weak topics requiring reinforcement: ${params.weakTopics.join(', ') || 'General revision'}.
Generate a structured, actionable 5-step personalized revision plan with specific reading focus, practice exercises, and conceptual checkpoints.`;

  try {
    const response = await ai.models.generateContent({
      model: 'gemini-3.8-flash',
      contents: prompt,
      config: {
        systemInstruction: 'You are an academic advisor. Write clear, encouraging, structured study plans with bullet points.',
      },
    });

    return response.text || 'No revision plan generated.';
  } catch (err: any) {
    return `Could not generate revision plan: ${err.message}`;
  }
}
