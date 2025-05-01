import { GoogleGenAI } from "@google/genai";

const gemini = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });

export async function getEmbeddings(text: string) {
    try {
        // Pass the text as an array so that Gemini returns an embedding for each element.
        const response = await gemini.models.embedContent({
            model: "gemini-embedding-exp-03-07",
            contents: [text.replace(/\n/g, " ")],
        });
        // Extract the first embedding vector.
        const embeddingVector = response?.embeddings?.[0]?.values ?? []

        // Optionally, check the vector length for debugging.
        if (embeddingVector.length !== 1536) {
            console.error(`Expected a vector of length 1536 but received ${embeddingVector.length}`);
        }

        return embeddingVector;
    } catch (error) {
        console.error("Error calling Gemini embeddings API", error);
        throw error;
    }
}