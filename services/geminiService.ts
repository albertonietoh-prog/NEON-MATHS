import { GoogleGenAI, Type } from "@google/genai";
import { LevelData, Coordinate, TileType, MathQuestion, MathDifficulty } from "../types";

const parseLevel = (rawMap: string[]): LevelData => {
  const map: string[][] = [];
  let pacmanStart: Coordinate = { x: 1, y: 1 };
  let ghostStart: Coordinate = { x: 10, y: 5 }; // Fallback
  let totalDots = 0;

  rawMap.forEach((rowStr, y) => {
    const row = rowStr.split('');
    const newRow: string[] = [];
    row.forEach((char, x) => {
      // Normalize input
      let tile = char;
      if (tile === 'S') {
        pacmanStart = { x, y };
        tile = TileType.EMPTY; // Clear spawn point from map data
      } else if (tile === 'G') {
        ghostStart = { x, y };
        tile = TileType.EMPTY;
      } else if (tile === '.') {
        totalDots++;
      } else if (tile === 'o') {
        totalDots++; // Power pellets count as items to clear
      }
      newRow.push(tile);
    });
    map.push(newRow);
  });

  return { map, pacmanStart, ghostStart, totalDots };
};

export const generateLevel = async (): Promise<LevelData> => {
  if (!process.env.API_KEY) {
    throw new Error("API Key is missing");
  }

  const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
  
  const width = 28;
  const height = 17;

  const prompt = `
    Generate a 2D grid map for a Pac-Man game. 
    Dimensions: ${width} width x ${height} height.
    Characters allowed:
    '#' for Wall
    '.' for Dot
    'o' for Power Pellet (place 4 in corners)
    'S' for Pacman Spawn (place 1)
    'G' for Ghost Spawn House (place a small 2x2 area in middle)
    
    Rules:
    - The outer border must be walls '#'.
    - Ensure the map is fully connected (no isolated areas).
    - Make it symmetrical horizontally.
    - Don't make it too open, include maze-like corridors.
  `;

  try {
    const response = await ai.models.generateContent({
      model: "gemini-2.5-flash",
      contents: prompt,
      config: {
        responseMimeType: "application/json",
        responseSchema: {
          type: Type.OBJECT,
          properties: {
            layout: {
              type: Type.ARRAY,
              items: {
                type: Type.STRING
              },
              description: `An array of strings representing the rows of the map. Each string must be exactly ${width} characters long.`
            }
          },
          required: ["layout"]
        }
      }
    });

    const jsonText = response.text;
    if (!jsonText) throw new Error("No response from AI");

    const data = JSON.parse(jsonText);
    
    // Validate dimensions loosely
    if (data.layout && Array.isArray(data.layout) && data.layout.length > 0) {
        return parseLevel(data.layout);
    }
    
    throw new Error("Invalid map format returned");

  } catch (error) {
    console.error("Gemini Level Gen Error:", error);
    // Fallback or re-throw
    throw error;
  }
};

export const generateMathQuestion = async (
    previousQuestions: string[] = [], 
    difficulty: MathDifficulty = MathDifficulty.LINEAR
): Promise<MathQuestion> => {
  if (!process.env.API_KEY) {
    throw new Error("API Key is missing");
  }

  const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });

  // Filter list to last 20 to keep prompt size manageable
  const historyContext = previousQuestions.slice(-20);

  let topicDescription = "";
  if (difficulty === MathDifficulty.QUADRATIC) {
      topicDescription = `
        Tema: Ecuaciones de segundo grado (completas o incompletas).
        Nivel: 3º-4º ESO (España).
        Requisitos adicionales:
        - Las soluciones deben ser números enteros.
        - Si hay dos soluciones, indicarlas en las opciones (ej: "x = 2, x = -3").
      `;
  } else {
      topicDescription = `
        Tema: Ecuaciones de primer grado.
        Nivel: 2º ESO (España).
        Requisitos adicionales:
        - El resultado (valor de x) DEBE ser un número entero.
      `;
  }

  const prompt = `
    Genera una pregunta de matemáticas tipo test (opción múltiple).
    ${topicDescription}
    
    Requisitos Generales:
    - La ecuación debe ser clara y resoluble mentalmente o con poco cálculo.
    - Proporciona 4 opciones de respuesta.
    - Solo una es correcta.
    - El idioma debe ser Español.
    
    ${historyContext.length > 0 ? `
    IMPORTANTE - NO REPETIR:
    No generes ninguna de las siguientes ecuaciones o preguntas, inventa una totalmente nueva:
    ${JSON.stringify(historyContext)}
    ` : ''}
  `;

  try {
    const response = await ai.models.generateContent({
      model: "gemini-2.5-flash",
      contents: prompt,
      config: {
        responseMimeType: "application/json",
        responseSchema: {
            type: Type.OBJECT,
            properties: {
                question: { type: Type.STRING, description: "La pregunta o ecuación a resolver." },
                options: { type: Type.ARRAY, items: { type: Type.STRING }, description: "4 posibles respuestas." },
                correctIndex: { type: Type.NUMBER, description: "El índice (0-3) de la respuesta correcta." }
            },
            required: ["question", "options", "correctIndex"]
        }
      }
    });

    const jsonText = response.text;
    if (!jsonText) throw new Error("No response from AI");
    
    return JSON.parse(jsonText) as MathQuestion;

  } catch (error) {
    console.error("Math Gen Error:", error);
    return {
        question: "Resuelve: 2x + 10 = 20",
        options: ["x = 2", "x = 5", "x = 10", "x = 0"],
        correctIndex: 1
    };
  }
};