import Account from "@/lib/account";
import { syncEmailsToDatabase } from "@/lib/sync-to-db";
import { db } from "@/server/db";
import { auth } from "@clerk/nextjs/server";
import { type NextRequest, NextResponse } from "next/server";

export const maxDuration = 300

export const POST = async (req: NextRequest) => {
    const body = await req.json()
    console.log('[SYNC] Request body:', body);
    const { accountId, userId } = body
    if (!accountId || !userId){
       console.log("what the check say:", body , accountId ,userId);
        
    //    return NextResponse.json({ error: "INVALID_REQUEST" }, { status: 400 });
    } 

    const dbAccount = await db.account.findUnique({
        where: {
            id: accountId,
            userId,
        }
    })
    if (!dbAccount) return NextResponse.json({ error: "ACCOUNT_NOT_FOUND" }, { status: 404 });

    const account = new Account(dbAccount.token)
    await account.createSubscription()
    console.log('the account', account);
    const response = await account.performInitialSync()
    if (!response) return NextResponse.json({ error: "FAILED_TO_SYNC" }, { status: 500 });

    const { deltaToken, emails } = response

    await syncEmailsToDatabase(emails, accountId)

    await db.account.update({
        where: {
            token: dbAccount.token,
        },
        data: {
            nextDeltaToken: deltaToken,
        },
    });
    console.log('sync complete', deltaToken)
    return NextResponse.json({ success: true, deltaToken }, { status: 200 });

}