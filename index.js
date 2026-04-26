import OpenAI from "openai";
import dotenv from "dotenv";

dotenv.config();

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

async function run() {
  const message = "50 from John haircut";

  const response = await openai.chat.completions.create({
    model: "gpt-4o-mini",
    messages: [
      {
        role: "system",
        content: `
You are a smart financial assistant.

Extract transaction data and respond.

Return ONLY JSON in this format:
{
  "amount": number,
  "type": "income" or "expense",
  "category": string,
  "person": string or null,
  "reply": string
}

Reply example:
"Logged 👍 €50 from John (haircut)"
        `,
      },
      {
        role: "user",
        content: message,
      },
    ],
  });

  const result = JSON.parse(response.choices[0].message.content);

  console.log(result);
  console.log("\nAssistant says:");
  console.log(result.reply);
}

run();