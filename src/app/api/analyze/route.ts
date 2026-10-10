import { NextRequest, NextResponse } from "next/server";
import Groq from "groq-sdk";

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { lastMonthData, currentMonthData, apiKey } = body;

    if (!lastMonthData || !currentMonthData) {
      return NextResponse.json(
        { error: "Both lastMonthData and currentMonthData are required." },
        { status: 400 }
      );
    }

    const effectiveApiKey = apiKey || process.env.GROQ_API_KEY;

    if (!effectiveApiKey) {
      return NextResponse.json(
        {
          error:
            "Groq API key is missing. Please set GROQ_API_KEY in your .env.local file or configure your key in the dashboard header.",
        },
        { status: 401 }
      );
    }

    const groq = new Groq({
      apiKey: effectiveApiKey,
    });

    const lastMonthString =
      typeof lastMonthData === "string"
        ? lastMonthData
        : JSON.stringify(lastMonthData, null, 2);

    const currentMonthString =
      typeof currentMonthData === "string"
        ? currentMonthData
        : JSON.stringify(currentMonthData, null, 2);

    const messages: Array<{
      role: "system" | "user";
      content: string;
    }> = [
      {
        role: "system",
        content:
          "Act as a strict CFO. Analyze these two months of financial data. Write a concise, professional variance report highlighting the top 3 biggest expense increases, any unusual anomalies, and a brief summary. Format the response in clean Markdown.",
      },
      {
        role: "user",
        content: `Analyze the following two months of general ledger financial data:

### Last Month's General Ledger Data:
${lastMonthString}

### Current Month's General Ledger Data:
${currentMonthString}`,
      },
    ];

    let completion;
    let modelUsed = "llama-3.1-70b-versatile";

    try {
      // Primary model: llama-3.1-70b-versatile as requested
      completion = await groq.chat.completions.create({
        model: modelUsed,
        messages,
        temperature: 0.2,
      });
    } catch (modelError: unknown) {
      const errObj = modelError as {
        status?: number;
        error?: { code?: string; message?: string };
        message?: string;
      };

      const isDecommissioned =
        errObj?.error?.code === "model_decommissioned" ||
        errObj?.error?.code === "model_not_found" ||
        errObj?.message?.includes("decommissioned") ||
        errObj?.message?.includes("does not exist");

      if (isDecommissioned) {
        // Groq decommissioned llama-3.1-70b-versatile; gracefully fallback to available 120B/20B model
        console.warn(
          `Groq model ${modelUsed} is decommissioned or unavailable. Falling back to active Groq reasoning model.`
        );
        modelUsed = "openai/gpt-oss-120b";
        try {
          completion = await groq.chat.completions.create({
            model: modelUsed,
            messages,
            temperature: 0.2,
          });
        } catch {
          modelUsed = "openai/gpt-oss-20b";
          completion = await groq.chat.completions.create({
            model: modelUsed,
            messages,
            temperature: 0.2,
          });
        }
      } else {
        throw modelError;
      }
    }

    const report = completion.choices[0]?.message?.content || "";

    return NextResponse.json({
      report,
      model: modelUsed,
      usage: completion.usage,
    });
  } catch (error: unknown) {
    console.error("Error in /api/analyze:", error);
    const errorMessage =
      error instanceof Error
        ? error.message
        : "An unexpected error occurred during variance analysis.";
    return NextResponse.json({ error: errorMessage }, { status: 500 });
  }
}
