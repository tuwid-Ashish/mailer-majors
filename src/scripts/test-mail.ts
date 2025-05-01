// scripts/test-mail.ts

import { env } from "@/env";                         // or wherever you load your .env
import { prisma } from "@/server/db";                     // your Prisma client
import { auth as clerkAuth } from "@clerk/nextjs/server"; // Clerk server-side auth
import { appRouter } from "@/server/trpc/router";         // your root TRPC router
import { CreateNextContextOptions } from "@trpc/server/adapters/next";

// 1) Mock a Next.js API context, just enough for TRPC:
async function createTestContext(userId: string) {
  return {
    db: prisma,
    auth: { userId },  // simulate a logged-in Clerk user
  } as CreateNextContextOptions["req"] & { db: typeof prisma; auth: { userId: string } };
}

async function run() {
  // Replace with a real userId from your DB
  const userId = "clerk-user-id-123";
  const ctx = await createTestContext(userId);

  // 2) Create a “caller” that can invoke any procedure
  const caller = appRouter.createCaller(ctx);

  // 3) Now invoke any of your mailRouter procedures:

  console.log("→ getAccounts:");
  const accounts = await caller.mail.getAccounts();
  console.log(accounts);

  if (accounts.length === 0) {
    console.warn("No accounts found. Aborting thread tests.");
    process.exit(0);
  }

  const accountId = accounts[0].id;
  console.log("\n→ getNumThreads (inbox):");
  const inboxCount = await caller.mail.getNumThreads({ accountId, tab: "inbox" });
  console.log(inboxCount);

  console.log("\n→ getThreads (inbox, done=false):");
  const threads = await caller.mail.getThreads({ accountId, tab: "inbox", done: false });
  console.log(threads);

  console.log("\n→ getThreadById (first thread):");
  if (threads.length > 0) {
    const thread = await caller.mail.getThreadById({ accountId, threadId: threads[0].id });
    console.dir(thread, { depth: 2 });
  }

  // 4) You can similarly test other methods:
  // await caller.mail.getReplyDetails({ … })
  // await caller.mail.getEmailDetails({ … })
  // await caller.mail.getChatbotInteraction()
  // etc.
}

run().catch((err) => {
  console.error("❌ Test script error:", err);
  process.exit(1);
});
