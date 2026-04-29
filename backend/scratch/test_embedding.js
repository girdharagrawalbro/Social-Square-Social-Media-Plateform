require('dotenv').config();
const { GoogleGenerativeAI } = require('@google/generative-ai');

async function main() {
  const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);
  const text = "Hello world";
  
  try {
    console.log(`Testing gemini-embedding-2 with outputDimensionality: 384`);
    const model = genAI.getGenerativeModel({ model: "gemini-embedding-2" });
    
    const result = await model.embedContent({
      content: { parts: [{ text }] },
      outputDimensionality: 384
    });
    
    console.log(`Success! Vector length:`, result.embedding.values.length);
    console.log(`First 5 values:`, result.embedding.values.slice(0, 5));
  } catch (err) {
    console.error(`Error with outputDimensionality 384:`, err.message);
  }
}

main();
