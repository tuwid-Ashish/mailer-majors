// import { Configuration, OpenAIApi } from "openai-edge";
// import { Message, OpenAIStream, streamText } from "ai";

// import { NextResponse } from "next/server";
// import { OramaManager } from "@/lib/orama";
// import { db } from "@/server/db";
// import { auth } from "@clerk/nextjs/server";
// import { getSubscriptionStatus } from "@/lib/stripe-actions";
// import { FREE_CREDITS_PER_DAY } from "@/app/constants";

// // export const runtime = "edge";

// const config = new Configuration({
//     apiKey: process.env.OPENAI_API_KEY,
// });
// const openai = new OpenAIApi(config);

// export async function POST(req: Request) {
//     try {
//         const { userId } = await auth()
//         if (!userId) {
//             return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
//         }
//         const isSubscribed = await getSubscriptionStatus()
//         if (!isSubscribed) {
//             const chatbotInteraction = await db.chatbotInteraction.findUnique({
//                 where: {
//                     day: new Date().toDateString(),
//                     userId
//                 }
//             })
//             if (!chatbotInteraction) {
//                 await db.chatbotInteraction.create({
//                     data: {
//                         day: new Date().toDateString(),
//                         count: 1,
//                         userId
//                     }
//                 })
//             } else if (chatbotInteraction.count >= FREE_CREDITS_PER_DAY) {
//                 return NextResponse.json({ error: "Limit reached" }, { status: 429 });
//             }
//         }
//         const { messages, accountId } = await req.json();
//         const oramaManager = new OramaManager(accountId)
//         await oramaManager.initialize()

//         const lastMessage = messages[messages.length - 1]


//         const context = await oramaManager.vectorSearch({ prompt: lastMessage.content })
//         console.log(context.hits.length + ' hits found')
//         // console.log(context.hits.map(hit => hit.document))

//         const prompt = {
//             role: "system",
//             content: `You are an AI email assistant embedded in an email client app. Your purpose is to help the user compose emails by answering questions, providing suggestions, and offering relevant information based on the context of their previous emails.
//             THE TIME NOW IS ${new Date().toLocaleString()}
      
//       START CONTEXT BLOCK
//       ${context.hits.map((hit) => JSON.stringify(hit.document)).join('\n')}
//       END OF CONTEXT BLOCK
      
//       When responding, please keep in mind:
//       - Be helpful, clever, and articulate.
//       - Rely on the provided email context to inform your responses.
//       - If the context does not contain enough information to answer a question, politely say you don't have enough information.
//       - Avoid apologizing for previous responses. Instead, indicate that you have updated your knowledge based on new information.
//       - Do not invent or speculate about anything that is not directly supported by the email context.
//       - Keep your responses concise and relevant to the user's questions or the email being composed.`
//         };


//         const response = await openai.createChatCompletion({
//             model: "gpt-4",
//             messages: [
//                 prompt,
//                 ...messages.filter((message: Message) => message.role === "user"),
//             ],
//             stream: true,
//         });
//         const stream = OpenAIStream(response, {
//             onStart: async () => {
//             },
//             onCompletion: async (completion) => {
//                 const today = new Date().toDateString()
//                 await db.chatbotInteraction.update({
//                     where: {
//                         userId,
//                         day: today
//                     },
//                     data: {
//                         count: {
//                             increment: 1
//                         }
//                     }
//                 })
//             },
//         });
//         return new streamText.todata(stream);
//     } catch (error) {
//         console.log(error)
//         return NextResponse.json({ error: "error" }, { status: 500 });
//     }
// }


import { streamText } from "ai";
import { createGoogleGenerativeAI } from "@ai-sdk/google";
import { createStreamableValue } from "ai/rsc";

import { NextResponse } from "next/server";
import { OramaManager } from "@/lib/orama";
import { db } from "@/server/db";
import { auth } from "@clerk/nextjs/server";
import { getSubscriptionStatus } from "@/lib/stripe-actions";
import { FREE_CREDITS_PER_DAY } from "@/app/constants";

const gemini = createGoogleGenerativeAI({
    apiKey: process.env.GEMINI_API_KEY,
});

export async function POST(req: Request) {
    try {
        const { userId } = await auth();
        if (!userId) {
            return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
        }
        const isSubscribed = await getSubscriptionStatus();
        if (!isSubscribed) {
            const chatbotInteraction = await db.chatbotInteraction.findUnique({
                where: {
                    day: new Date().toDateString(),
                    userId,
                },
            });
            if (!chatbotInteraction) {
                await db.chatbotInteraction.create({
                    data: {
                        day: new Date().toDateString(),
                        count: 1,
                        userId,
                    },
                });
            } else if (chatbotInteraction.count >= FREE_CREDITS_PER_DAY) {
                return NextResponse.json({ error: "Limit reached" }, { status: 429 });
            }
        }
        const { messages, accountId } = await req.json();
        const oramaManager = new OramaManager(accountId);
        await oramaManager.initialize();

        const lastMessage = messages[messages.length - 1];
        const context = await oramaManager.vectorSearch({ prompt: lastMessage.content });
        console.log(context.hits.length + " hits found");
        
        // Format email context in a more readable way
        const emailContextString = context.hits
            .map(hit => {
                const doc = hit.document;
                return `
Email: 
- Subject: ${doc.title}
- From: ${doc.from}
- To: ${doc.to}
- Date: ${new Date(doc.sentAt).toLocaleString()}
- Preview: ${doc.body?.substring(0, 100)}...
                `;
            })
            .join('\n');
//         // Build a full prompt by combining a system prompt and user messages
//         const systemPrompt = `
// You are an AI email assistant embedded in an email client app. Your purpose is to help the user compose emails by answering questions, providing suggestions, and offering relevant information based on the context of their previous emails.
// THE TIME NOW IS ${new Date().toLocaleString()}

// START CONTEXT BLOCK
// ${context.hits.map((hit) => JSON.stringify(hit.document)).join("\n")}
// END OF CONTEXT BLOCK

// When responding, please keep in mind:
// - Be helpful, clever, and articulate.
// - Rely on the provided email context to inform your responses.
// - If the context does not contain enough information to answer a question, politely say you don't have enough information.
// - Avoid apologizing for previous responses. Instead, indicate that you have updated your knowledge based on new information.
// - Do not invent or speculate about anything that is not directly supported by the email context.
// - Keep your responses concise and relevant to the user's questions or the email being composed.
//         `;
        const prompt = `
You are an AI email assistant. Use this email context to help answer the user's question:

CONTEXT:
${emailContextString}

USER QUESTION:
${lastMessage.content}

Remember to:
- Be concise and specific
- Only use information from the provided email context
- If you don't have enough context, say so
`;
        const userPrompts = messages
            .filter((message: { role: string; content: string }) => message.role === "user")
            .map((message: { content: string }) => message.content)
            .join("\n");

        // const fullPrompt = systemPrompt + "\n" + userPrompts;

        const stream = createStreamableValue("");
        const { textStream } =  streamText({
            model: gemini("gemini-1.5-flash"),
            prompt: prompt,
        });
        
        for await (const delta of textStream) {
            stream.update(delta);
        }
        // Update the DB once streaming is complete
        const today = new Date().toDateString();
        await db.chatbotInteraction.update({
            where: {
                userId,
                day: today,
            },
            data: {
                count: {
                    increment: 1,
                },
            },
        });
        stream.done();

        return NextResponse.json({ output: stream.value });
    } catch (error) {
        console.log(error);
        return NextResponse.json({ error: "error" }, { status: 500 });
    }
}