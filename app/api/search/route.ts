import { NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import Anthropic from "@anthropic-ai/sdk";
import { Pinecone } from "@pinecone-database/pinecone";
import { z } from "zod";

const Body = z.object({ query: z.string().min(3).max(500) });

const claude = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY! });
const pc = new Pinecone({ apiKey: process.env.PINECONE_API_KEY! });
const index = pc.index(process.env.PINECONE_INDEX || "projectpulse-docs");

/**
 * POST /api/search  { query: "What did we decide about the Q4 launch?" }
 *
 * 1. Embed the query via the Python pipeline's embed endpoint
 *    (sentence-transformers, 1536-d, cosine).
 * 2. Top-k against Pinecone scoped by org_id.
 * 3. Synthesise an answer via Claude with retrieved chunks as context.
 */
export async function POST(req: Request) {
  const { orgId } = auth();
  if (!orgId) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  const parsed = Body.safeParse(await req.json());
  if (!parsed.success) return NextResponse.json({ error: "bad_request" }, { status: 400 });
  const { query } = parsed.data;

  // Embed query (delegated to the Python pipeline so we keep one
  // sentence-transformers model loaded in memory there).
  const embedRes = await fetch(`${process.env.PIPELINE_URL}/embed`, {
    method: "POST",
    headers: {
      "content-type": "application/json",
      authorization: `Bearer ${process.env.PIPELINE_SECRET}`,
    },
    body: JSON.stringify({ text: query }),
  });
  if (!embedRes.ok) return NextResponse.json({ error: "embed_failed" }, { status: 502 });
  const { vector } = (await embedRes.json()) as { vector: number[] };

  const matches = await index.namespace(orgId).query({
    vector,
    topK: 6,
    includeMetadata: true,
  });

  const context = matches.matches
    .map((m, i) => `[${i + 1}] ${(m.metadata?.text as string) ?? ""}`)
    .join("\n\n");

  const completion = await claude.messages.create({
    model: process.env.ANTHROPIC_MODEL || "claude-sonnet-4-6",
    max_tokens: 700,
    system:
      "You are an executive assistant for a PMO. Answer using ONLY the supplied context. " +
      "Cite source numbers like [2]. If the context does not answer the question, say so.",
    messages: [{ role: "user", content: `Question: ${query}\n\nContext:\n${context}` }],
  });

  const answer =
    completion.content
      .filter((c): c is Anthropic.TextBlock => c.type === "text")
      .map((c) => c.text)
      .join("\n") || "";

  return NextResponse.json({
    answer,
    sources: matches.matches.map((m) => ({
      id: m.id,
      score: m.score,
      title: m.metadata?.title,
      url: m.metadata?.url,
    })),
  });
}
