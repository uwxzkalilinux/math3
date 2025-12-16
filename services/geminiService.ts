import { GoogleGenAI, Type } from "@google/genai";
import { PresentationData } from "../types";

const getAiClient = () => {
  // Use process.env.API_KEY as mandated by guidelines.
  // This is configured in vite.config.ts to resolve correctly.
  const apiKey = import.meta.env.VITE_GEMINI_API_KEY;

if (!apiKey) {
  throw new Error("API Key is missing. Please check VITE_GEMINI_API_KEY in your .env file");
}
  return new GoogleGenAI({ apiKey });
};

// --- Utils ---
export const fileToBase64 = (file: File): Promise<string> => {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.readAsDataURL(file);
    reader.onload = () => {
      const result = reader.result as string;
      const base64 = result.split(',')[1];
      resolve(base64);
    };
    reader.onerror = (error) => reject(error);
  });
};

const extractImageFromResponse = (response: any): string | null => {
  for (const part of response.candidates?.[0]?.content?.parts || []) {
    if (part.inlineData) {
      return `data:image/png;base64,${part.inlineData.data}`;
    }
  }
  return null;
};

// --- Features ---

export const generateDeepTutorResponse = async (
  prompt: string, 
  history: { role: string; parts: { text: string }[] }[]
) => {
  const ai = getAiClient();
  const chat = ai.chats.create({
    model: 'gemini-3-pro-preview',
    config: {
      thinkingConfig: { thinkingBudget: 32768 },
      systemInstruction: "أنت مدرس رياضيات متقدم. اكتب جميع المعادلات الرياضية والكسور باستخدام صيغة LaTeX. استخدم $$ للمعادلات في سطر منفصل و $ للمعادلات في نفس السطر. اجعل الرد باللغة العربية ولكن الأرقام والرموز بالإنجليزية داخل LaTeX لضمان ظهورها بشكل صحيح.",
    },
    history: history,
  });

  const response = await chat.sendMessage({ message: prompt });
  return response.text;
};

export const generateMathVisual = async (prompt: string, size: "1K" | "2K" | "4K") => {
  const ai = getAiClient();
  const visualPrompt = `Create a highly accurate, educational mathematical visualization or diagram for the following concept (which might be in Arabic): ${prompt}. Clean white background, academic style.`;

  try {
    const response = await ai.models.generateContent({
      model: 'gemini-3-pro-image-preview',
      contents: {
        parts: [{ text: visualPrompt }],
      },
      config: {
        imageConfig: {
          aspectRatio: "16:9",
          imageSize: size,
        },
      },
    });
    return extractImageFromResponse(response);
  } catch (error: any) {
    if (error.status === 403 || error.message?.includes('PERMISSION_DENIED') || error.status === 404) {
      console.warn("Falling back to gemini-2.5-flash-image due to permissions/availability.");
      const response = await ai.models.generateContent({
        model: 'gemini-2.5-flash-image',
        contents: {
          parts: [{ text: visualPrompt }],
        },
        config: {
          imageConfig: {
            aspectRatio: "16:9",
          },
        },
      });
      return extractImageFromResponse(response);
    }
    throw error;
  }
};

export const solveMathProblem = async (imageBase64: string, prompt: string) => {
  const ai = getAiClient();
  const response = await ai.models.generateContent({
    model: 'gemini-3-pro-preview', 
    contents: {
      parts: [
        {
          inlineData: {
            mimeType: 'image/jpeg', 
            data: imageBase64,
          },
        },
        {
          text: prompt || `
            حل المسألة الرياضية في الصورة خطوة بخطوة باللغة العربية.
            **مهم جداً للتنسيق:**
            1. أي معادلة رياضية، كسر، جذر، أو رقم متغير يجب أن يكتب بصيغة **LaTeX**.
            2. للمعادلات الكبيرة (مثل الكسور)، ضعها في سطر منفصل محاطة بـ $$ (مثال: $$ \\frac{x}{y} $$).
            3. للرموز الصغيرة داخل النص، حطها بـ $ (مثال: $x$).
            4. لا تستخدم النص العادي للكسور أبداً (لا تكتب 1/2 بل اكتب $ \\frac{1}{2} $).
            5. اجعل الشرح بالعربي، ولكن الرياضيات بالإنجليزية داخل الـ LaTeX لضمان عدم تداخل الحروف.
          `,
        },
      ],
    },
  });
  return response.text;
};

export const quickExplain = async (prompt: string, useSearch: boolean) => {
  const ai = getAiClient();
  const arabicPrompt = `أجب باللغة العربية. استخدم LaTeX للمعادلات الرياضية ($ للمعادلات الصغيرة و $$ للكبيرة): ${prompt}`;
  
  if (useSearch) {
    const response = await ai.models.generateContent({
      model: 'gemini-2.5-flash',
      contents: arabicPrompt,
      config: {
        tools: [{ googleSearch: {} }],
      },
    });
    
    const groundingChunks = response.candidates?.[0]?.groundingMetadata?.groundingChunks || [];
    const sources = groundingChunks
      .map((c: any) => c.web ? { uri: c.web.uri, title: c.web.title } : null)
      .filter((s: any) => s !== null);

    return { text: response.text, sources };
  } else {
    const response = await ai.models.generateContent({
      model: 'gemini-flash-lite-latest',
      contents: arabicPrompt,
    });
    return { text: response.text, sources: [] };
  }
};

export const generatePresentationContent = async (topic: string, slideCount: number): Promise<PresentationData> => {
  const ai = getAiClient();
  
  const prompt = `
    أنت صانع محتوى تعليمي خبير.
    قم بإنشاء عرض تقديمي حول الموضوع التالي: "${topic}".
    يجب أن يحتوي العرض على ${slideCount} شرائح محتوى (غير شامل شريحة العنوان).
    
    المتطلبات:
    1. المحتوى يجب أن يكون باللغة العربية، دقيقاً وغنياً بالمعلومات.
    2. imageDescription يجب أن يكون وصفاً مفصلاً باللغة الإنجليزية للمساعدة في توليد صورة توضيحية.
    3. أرجع النتيجة بتنسيق JSON فقط.

    Schema:
    {
      "title": "عنوان العرض التقديمي",
      "slides": [
        {
          "title": "عنوان الشريحة",
          "bullets": ["نقطة 1", "نقطة 2", "نقطة 3"],
          "examples": ["مثال واقعي 1", "مثال 2"],
          "imageDescription": "Detailed English prompt for image generation...",
          "speakerNotes": "ملاحظات مفصلة للمتحدث بالعربية..."
        }
      ]
    }
  `;

  try {
    const response = await ai.models.generateContent({
      model: 'gemini-2.5-flash',
      contents: prompt,
      config: {
        responseMimeType: 'application/json',
        responseSchema: {
          type: Type.OBJECT,
          properties: {
            title: { type: Type.STRING },
            slides: {
              type: Type.ARRAY,
              items: {
                type: Type.OBJECT,
                properties: {
                  title: { type: Type.STRING },
                  bullets: { type: Type.ARRAY, items: { type: Type.STRING } },
                  examples: { type: Type.ARRAY, items: { type: Type.STRING } },
                  imageDescription: { type: Type.STRING },
                  speakerNotes: { type: Type.STRING }
                }
              }
            }
          }
        }
      }
    });

    const jsonStr = response.text;
    return JSON.parse(jsonStr) as PresentationData;

  } catch (e) {
    console.error("Presentation generation error:", e);
    throw new Error("فشل في توليد محتوى العرض التقديمي. تأكد من صحة المفتاح وإعادة نشر الموقع (Redeploy).");
  }
};

export const generateSlideImage = async (prompt: string): Promise<string | null> => {
  const ai = getAiClient();
  const imagePrompt = `Educational illustration, clean, academic, white background. ${prompt}`;

  try {
    const response = await ai.models.generateContent({
      model: 'gemini-3-pro-image-preview',
      contents: {
        parts: [{ text: imagePrompt }],
      },
      config: {
        imageConfig: {
          aspectRatio: "16:9",
          imageSize: "1K", 
        },
      },
    });
    return extractImageFromResponse(response);
  } catch (error: any) {
    if (error.status === 403 || error.message?.includes('PERMISSION_DENIED') || error.status === 404) {
      console.warn("Falling back to gemini-2.5-flash-image for slide image.");
      try {
        const response = await ai.models.generateContent({
          model: 'gemini-2.5-flash-image',
          contents: {
            parts: [{ text: imagePrompt }],
          },
          config: {
            imageConfig: {
              aspectRatio: "16:9",
            },
          },
        });
        return extractImageFromResponse(response);
      } catch (fallbackError) {
        console.error("Fallback image gen failed", fallbackError);
        return null;
      }
    }
    console.error("Image generation error:", error);
    return null;
  }
};

export const generateSpeech = async (text: string): Promise<ArrayBuffer> => {
  const ai = getAiClient();
  if (!text || text.trim().length === 0) throw new Error("Text is empty");

  const response = await ai.models.generateContent({
    model: 'gemini-2.5-flash-preview-tts',
    contents: { parts: [{ text: text.substring(0, 500) }] }, 
    config: {
      responseModalities: ['AUDIO'], 
      speechConfig: {
        voiceConfig: {
          prebuiltVoiceConfig: { voiceName: 'Puck' }, 
        },
      },
    },
  });

  const base64Audio = response.candidates?.[0]?.content?.parts?.[0]?.inlineData?.data;
  if (!base64Audio) throw new Error("No audio generated");
  
  const binaryString = window.atob(base64Audio);
  const len = binaryString.length;
  const bytes = new Uint8Array(len);
  for (let i = 0; i < len; i++) {
    bytes[i] = binaryString.charCodeAt(i);
  }
  return bytes.buffer;
};